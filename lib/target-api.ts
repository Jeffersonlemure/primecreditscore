// Target Informações API Integration (Serasa)
import axios from 'axios'

const AUTH_URL = process.env.TARGET_AUTH_URL!
const BASE_URL = process.env.TARGET_BASE_URL!
const CLIENT_ID = process.env.TARGET_CLIENT_ID!
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET!
const CLIENT_DOC = process.env.TARGET_CLIENT_DOC || '' // CNPJ do cliente perante a Target

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await axios.post(
    AUTH_URL,
    new URLSearchParams({
      grant_type: 'client_credentials',
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  const { access_token, expires_in } = response.data
  cachedToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in - 60) * 1000,
  }

  return access_token
}

async function apiGet(path: string, params?: Record<string, string>) {
  const token = await getAccessToken()
  const response = await axios.get(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(CLIENT_DOC ? { 'x-indirect-user-doc': CLIENT_DOC } : {})
    },
    params,
  })
  return response.data
}

// ─── Mapper ──────────────────────────────────────────────────────────────
function mapTargetToGeneric(targetData: any, type: 'PF' | 'PJ') {
  const report = targetData.reports?.[0] || targetData;
  const reg = report.registration || {};
  const neg = report.negativeData || {};
  
  const pefinItens = (neg.pefin?.pefinResponse || []).map((i: any) => ({ credor: i.creditorName, tipo: 'PEFIN', data: i.occurrenceDate, valor: i.amount }));
  const refinItens = (neg.refin?.refinResponse || []).map((i: any) => ({ credor: i.creditorName, tipo: 'REFIN', data: i.occurrenceDate, valor: i.amount }));
  const protestoItens = (neg.notary?.notaryResponse || []).map((i: any) => ({ credor: `Cartório ${i.city || ''} ${i.federalUnit || ''}`, tipo: 'PROTESTO', data: i.occurrenceDate, valor: i.amount }));
  
  const allItens = [...pefinItens, ...refinItens, ...protestoItens];
  const totalBalance = (neg.pefin?.summary?.balance || 0) + (neg.refin?.summary?.balance || 0) + (neg.notary?.summary?.balance || 0);

  if (type === 'PF') {
    return {
      tipo: 'PF',
      identificacao: {
        nome: reg.consumerName,
        cpf: reg.documentNumber,
        dataNascimento: reg.birthDate,
        sexo: reg.consumerGender,
        nomeMae: reg.motherName,
        situacaoCadastral: reg.statusRegistration
      },
      score: null, // Target accounts sem autorização para score
      anotacoes: {
        totalDividas: allItens.length,
        valorTotal: totalBalance,
        itens: allItens
      }
    };
  } else {
    return {
      tipo: 'PJ',
      identificacao: {
        razaoSocial: reg.companyName,
        cnpj: reg.companyDocument,
        dataAbertura: reg.foundationDate,
        situacaoCadastral: reg.statusRegistration
      },
      score: null,
      anotacoes: {
        totalDividas: allItens.length,
        valorTotal: totalBalance,
        itens: allItens
      }
    };
  }
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function consultarBasicaPF(cpf: string) {
  try {
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`)
    return { success: true, data: mapTargetToGeneric(data, 'PF') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarBasicaPJ(cnpj: string) {
  try {
    // URL requires UF, using defaulting to SP if not known
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_INTERMEDIARIO_PJ`)
    return { success: true, data: mapTargetToGeneric(data, 'PJ') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPF(cpf: string) {
  try {
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`)
    return { success: true, data: mapTargetToGeneric(data, 'PF') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPJ(cnpj: string) {
  try {
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_INTERMEDIARIO_PJ`)
    return { success: true, data: mapTargetToGeneric(data, 'PJ') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Erro desconhecido'
}

export type ConsultaResultado = Awaited<ReturnType<typeof consultarBasicaPF>>
