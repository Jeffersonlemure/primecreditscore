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
  const cleanBaseUrl = BASE_URL.replace(/\/+$/, '')
  const response = await axios.get(`${cleanBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'x-indirect-user-doc': CLIENT_DOC
    },
    params,
  })
  return response.data
}

// ─── Mapper ──────────────────────────────────────────────────────────────
function mapTargetToGeneric(targetData: any, type: 'PF' | 'PJ', consultationType: string) {
  const report = targetData.reports?.[0] || targetData;
  const reg = report.registration || {};
  const neg = report.negativeData || {};
  const pos = report.positiveData || {};
  
  const pefinItens = (neg.pefin?.pefinResponse || []).map((i: any) => ({ credor: i.creditorName, tipo: 'PEFIN', data: i.occurrenceDate, valor: i.amount }));
  const refinItens = (neg.refin?.refinResponse || []).map((i: any) => ({ credor: i.creditorName, tipo: 'REFIN', data: i.occurrenceDate, valor: i.amount }));
  const protestoItens = (neg.notary?.notaryResponse || []).map((i: any) => ({ credor: `Cartório ${i.city || ''} ${i.federalUnit || ''}`, tipo: 'PROTESTO', data: i.occurrenceDate, valor: i.amount }));
  
  const allItens = [...pefinItens, ...refinItens, ...protestoItens];
  const totalBalance = (neg.pefin?.summary?.balance || 0) + (neg.refin?.summary?.balance || 0) + (neg.notary?.summary?.balance || 0);

  // Extract Score if available
  const scoreData = pos.score || {};
  const score = scoreData.score || 0;
  const percentil = scoreData.percentile || 0;

  // Extract Participações Societárias
  const participacoes = (reg.partnerships || []).map((p: any) => ({
    razaoSocial: p.companyName,
    cnpj: p.companyDocument,
    participacao: p.participationPercentage ? `${p.participationPercentage}%` : '-',
    dataEntrada: p.entryDate
  }));

  if (type === 'PF') {
    const basePF = {
      tipo: consultationType,
      identificacao: {
        nome: reg.consumerName,
        cpf: reg.documentNumber,
        dataNascimento: reg.birthDate,
        sexo: reg.consumerGender,
        nomeMae: reg.motherName,
        situacaoCadastral: reg.statusRegistration
      },
      status: {
        situacaoReceita: reg.statusRegistration || 'REGULAR',
        obitos: !!reg.deathDate,
        pep: false
      },
      score: {
        pontuacao: score,
        faixa: score >= 700 ? 'EXCELENTE' : score >= 500 ? 'BOM' : score >= 300 ? 'REGULAR' : 'BAIXO',
        percentilBrasil: percentil
      },
      anotacoes: {
        totalDividas: allItens.length,
        valorTotal: totalBalance,
        itens: allItens
      },
      participacoes: {
        empresas: participacoes
      }
    };

    if (consultationType === 'rating_pf') {
      const ratingData = pos.rating || {};
      const capacity = pos.paymentCapacity || {};
      return {
        ...basePF,
        renda: {
          rendaEstimada: capacity.estimatedIncome || 0,
          faixaRenda: capacity.incomeRange || '-',
          fonteRenda: capacity.incomeSource || '-'
        },
        capacidadePagamento: {
          limiteRecomendado: capacity.recommendedLimit || 0,
          comprometimentoRenda: capacity.incomeCommitment || 0,
          probabilidadeInadimplencia: ratingData.defaultProbability || 0,
          classificacaoRisco: ratingData.riskClassification || '-'
        },
        historicoPagamentos: {
          pontualidade: pos.paymentHistory?.punctuality || 0,
          pagamentosEmDia: pos.paymentHistory?.onTimePayments || 0,
          pagamentosAtrasados: pos.paymentHistory?.latePayments || 0
        }
      };
    }
    return basePF;
  } else {
    // PJ Mapping
    const basePJ = {
      tipo: consultationType,
      identificacao: {
        razaoSocial: reg.companyName,
        nomeFantasia: reg.tradingName,
        cnpj: reg.companyDocument,
        dataAbertura: reg.foundationDate,
        situacaoCadastral: reg.statusRegistration,
        naturezaJuridica: reg.legalNature,
        porte: reg.companySize,
        atividadePrincipal: reg.mainActivity
      },
      status: {
        situacaoReceita: reg.statusRegistration || 'ATIVA',
        dividaAtiva: false
      },
      score: {
        pontuacao: score,
        faixa: score >= 700 ? 'EXCELENTE' : score >= 500 ? 'BOM' : score >= 300 ? 'REGULAR' : 'BAIXO',
        percentilBrasil: percentil
      },
      anotacoes: {
        totalDividas: allItens.length,
        valorTotal: totalBalance,
        itens: allItens
      },
      detalhamento: {
        capitalSocial: itauCapitalSocial(reg.shareCapital),
        socios: participacoes.map((p: any) => ({
           nome: p.razaoSocial,
           cpf: p.cnpj,
           participacao: p.participacao,
           cargo: 'SÓCIO'
        }))
      }
    };

    if (consultationType === 'rating_pj') {
      const ratingData = pos.rating || {};
      const billing = pos.estimatedBilling || {};
      const limit = pos.creditLimit || {};
      return {
        ...basePJ,
        risco: {
          classificacao: ratingData.riskClassification || '-',
          probabilidadeInadimplencia: ratingData.defaultProbability || 0,
          rating: ratingData.ratingCode || '-'
        },
        faturamento: {
          estimativaAnual: billing.annualEstimation || 0,
          faixa: billing.billingRange || '-'
        },
        limiteCredito: {
          recomendado: limit.recommendedLimit || 0,
          emUso: limit.usedLimit || 0,
          disponivel: limit.availableLimit || 0
        },
        socios: basePJ.detalhamento.socios.map((s: any) => ({ ...s, scoreIndividual: 0 }))
      };
    }
    return basePJ;
  }
}

function itauCapitalSocial(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/\D/g, '')) / 100;
  return 0;
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function consultarBasicaPF(cpf: string) {
  try {
    // SCORE_POSITIVO_PME é o modelo contratado (SCORE_POSITIVO não está liberado)
    const features = 'SCORE_POSITIVO_PME,PARTICIPACAO_SOCIETARIA'
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PF', 'basica_pf') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarBasicaPJ(cnpj: string) {
  try {
    // SCORE_POSITIVO para PJ só funciona com RELATORIO_BASICO_PJ
    const features = 'SCORE_POSITIVO,PARTICIPACOES'
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_BASICO_PJ`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PJ', 'basica_pj') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPF(cpf: string) {
  try {
    // SCORE_POSITIVO_PME é o modelo contratado; HISTORICO_PAGAMENTO disponível no contrato
    const features = 'SCORE_POSITIVO_PME,PARTICIPACAO_SOCIETARIA,RENDA_ESTIMADA,CAPACIDADE_PAGAMENTO,HISTORICO_PAGAMENTO'
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PF', 'rating_pf') }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPJ(cnpj: string) {
  try {
    // PJ usa PARTICIPACOES; SCORE_POSITIVO não disponível no contrato para PJ
    const features = 'PARTICIPACOES,FATURAMENTO_ESTIMADO_POSITIVO,LIMITE_CREDITO,PONTUALIDADE_PAGAMENTO'
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_INTERMEDIARIO_PJ`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PJ', 'rating_pj') }
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
