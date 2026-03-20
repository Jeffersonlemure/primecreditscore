// Target Informações API Integration (Serasa)
import axios from 'axios'
import type {
  BasicaPFResult,
  BasicaPJResult,
  RatingPFResult,
  RatingPJResult,
  AnotacoesData,
  ResumoAnotacao,
  PefinDetalhe,
  ProtestoDetalhe,
  AcaoJudicialDetalhe,
  Participacao,
} from './types'

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
      'x-indirect-user-doc': CLIENT_DOC,
    },
    params,
  })
  return response.data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateBR(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  // Handles "YYYY-MM-DD", "YYYY-MM", "YYYY" formats
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`
  return dateStr
}

function buildPeriodo(firstOccurrence: string | undefined, lastOccurrence: string | undefined): string {
  if (!firstOccurrence && !lastOccurrence) return '-'
  const first = fmtDateBR(firstOccurrence)
  const last = fmtDateBR(lastOccurrence)
  if (first === last) return first
  return `${first} a ${last}`
}

function safeNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// ─── Anotações Builder ────────────────────────────────────────────────────────

function buildAnotacoes(report: any): AnotacoesData {
  const neg = report.negativeData || {}
  const facts = report.facts || {}
  const opt = report.optionalFeatureResponse || {}

  // ── PEFIN ──
  const pefinSummary = neg.pefin?.summary || {}
  const pefinItems: any[] = neg.pefin?.pefinResponse || []
  const pefinResumo: ResumoAnotacao = {
    tipo: 'Pendências Comerciais (PEFIN)',
    quantidade: safeNum(pefinSummary.count) || pefinItems.length,
    periodo: buildPeriodo(pefinSummary.firstOccurrence, pefinSummary.lastOccurrence),
    valor: safeNum(pefinSummary.balance),
    maisRecente: fmtDateBR(pefinSummary.lastOccurrence),
  }
  const pefinDetalhes: PefinDetalhe[] = pefinItems.map((i: any) => ({
    contrato: i.contractId || '-',
    modalidade: i.legalNature || '-',
    empresa: i.creditorName || '-',
    data: fmtDateBR(i.occurrenceDate),
    valor: safeNum(i.amount),
    avalista: i.principal ? 'Principal' : '-',
    local: i.legalSquare || i.city || '-',
  }))

  // ── REFIN ──
  const refinSummary = neg.refin?.summary || {}
  const refinItems: any[] = neg.refin?.refinResponse || []
  const refinResumo: ResumoAnotacao = {
    tipo: 'Pendências Bancárias (REFIN)',
    quantidade: safeNum(refinSummary.count) || refinItems.length,
    periodo: buildPeriodo(refinSummary.firstOccurrence, refinSummary.lastOccurrence),
    valor: safeNum(refinSummary.balance),
    maisRecente: fmtDateBR(refinSummary.lastOccurrence),
  }
  const refinDetalhes: PefinDetalhe[] = refinItems.map((i: any) => ({
    contrato: i.contractId || '-',
    modalidade: i.legalNature || '-',
    empresa: i.creditorName || '-',
    data: fmtDateBR(i.occurrenceDate),
    valor: safeNum(i.amount),
    avalista: i.principal ? 'Principal' : '-',
    local: i.city || i.legalSquare || '-',
  }))

  // ── Cheques sem fundos ──
  const badChequeSummary = neg.badCheck?.summary || neg.check?.summary || {}
  const badChequeItems: any[] = neg.badCheck?.badCheckResponse || neg.check?.checkResponse || []
  const chequeResumo: ResumoAnotacao = {
    tipo: 'Cheques sem fundos',
    quantidade: safeNum(badChequeSummary.count) || badChequeItems.length,
    periodo: buildPeriodo(badChequeSummary.firstOccurrence, badChequeSummary.lastOccurrence),
    valor: safeNum(badChequeSummary.balance),
    maisRecente: fmtDateBR(badChequeSummary.lastOccurrence),
  }

  // ── Protestos ──
  const notarySummary = neg.notary?.summary || {}
  const notaryItems: any[] = neg.notary?.notaryResponse || []
  const protestoResumo: ResumoAnotacao = {
    tipo: 'Protestos',
    quantidade: safeNum(notarySummary.count) || notaryItems.length,
    periodo: buildPeriodo(notarySummary.firstOccurrence, notarySummary.lastOccurrence),
    valor: safeNum(notarySummary.balance),
    maisRecente: fmtDateBR(notarySummary.lastOccurrence),
  }
  const protestoDetalhes: ProtestoDetalhe[] = notaryItems.map((i: any) => ({
    cartorio: i.officeNumber || '-',
    cidade: i.city || '-',
    uf: i.federalUnit || '-',
    data: fmtDateBR(i.occurrenceDate),
    valor: safeNum(i.amount),
  }))

  // ── Ações Judiciais ──
  const ajItems: any[] =
    facts.judgementFilings?.judgementFilingsResponse ||
    neg.lawsuit?.lawsuitResponse ||
    []
  const ajSummary = facts.judgementFilings?.summary || neg.lawsuit?.summary || {}
  const ajResumo: ResumoAnotacao = {
    tipo: 'Ações Judiciais',
    quantidade: safeNum(ajSummary.count) || ajItems.length,
    periodo: buildPeriodo(ajSummary.firstOccurrence, ajSummary.lastOccurrence),
    valor: safeNum(ajSummary.balance),
    maisRecente: fmtDateBR(ajSummary.lastOccurrence),
  }
  const ajDetalhes: AcaoJudicialDetalhe[] = ajItems.map((i: any) => ({
    natureza: i.legalNature || '-',
    distribuidor: i.distributor || '-',
    vara: i.civilCourt || '-',
    cidade: i.city || '-',
    uf: i.state || i.federalUnit || '-',
    data: fmtDateBR(i.occurrenceDate),
    valor: safeNum(i.amount),
  }))

  // ── Participação em Falências ──
  const falenciaItems: any[] =
    facts.bankrupts?.bankruptResponse ||
    neg.bankruptcy?.bankruptcyResponse ||
    []
  const falenciaSummary = facts.bankrupts?.summary || neg.bankruptcy?.summary || {}
  const falenciaResumo: ResumoAnotacao = {
    tipo: 'Participação em Falências',
    quantidade: safeNum(falenciaSummary.count) || falenciaItems.length,
    periodo: buildPeriodo(falenciaSummary.firstOccurrence, falenciaSummary.lastOccurrence),
    valor: safeNum(falenciaSummary.balance),
    maisRecente: fmtDateBR(falenciaSummary.lastOccurrence),
  }

  // ── Dívidas Vencidas ──
  const dividaSummary = neg.debt?.summary || neg.overdueBills?.summary || {}
  const dividaItems: any[] = neg.debt?.debtResponse || neg.overdueBills?.overdueBillsResponse || []
  const dividaResumo: ResumoAnotacao = {
    tipo: 'Dívidas Vencidas',
    quantidade: safeNum(dividaSummary.count) || dividaItems.length,
    periodo: buildPeriodo(dividaSummary.firstOccurrence, dividaSummary.lastOccurrence),
    valor: safeNum(dividaSummary.balance),
    maisRecente: fmtDateBR(dividaSummary.lastOccurrence),
  }

  // ── Falência/Concordata/Recuperação Judicial ──
  const recoveryItems: any[] =
    facts.judicialRecovery?.judicialRecoveryResponse ||
    neg.judicialRecovery?.judicialRecoveryResponse ||
    []
  const recoverySummary = facts.judicialRecovery?.summary || neg.judicialRecovery?.summary || {}
  const recuperacaoResumo: ResumoAnotacao = {
    tipo: 'Falência/Concordata/Recuperação Judicial',
    quantidade: safeNum(recoverySummary.count) || recoveryItems.length,
    periodo: buildPeriodo(recoverySummary.firstOccurrence, recoverySummary.lastOccurrence),
    valor: safeNum(recoverySummary.balance),
    maisRecente: fmtDateBR(recoverySummary.lastOccurrence),
  }

  // ── Pendências Internas ──
  const internaSummary = neg.internalPendency?.summary || {}
  const internaItems: any[] = neg.internalPendency?.internalPendencyResponse || []
  const internaResumo: ResumoAnotacao = {
    tipo: 'Pendências Internas',
    quantidade: safeNum(internaSummary.count) || internaItems.length,
    periodo: buildPeriodo(internaSummary.firstOccurrence, internaSummary.lastOccurrence),
    valor: safeNum(internaSummary.balance),
    maisRecente: fmtDateBR(internaSummary.lastOccurrence),
  }

  return {
    resumo: [
      pefinResumo,
      refinResumo,
      chequeResumo,
      protestoResumo,
      ajResumo,
      falenciaResumo,
      dividaResumo,
      recuperacaoResumo,
      internaResumo,
    ],
    pefin: pefinDetalhes,
    refin: refinDetalhes,
    protestos: protestoDetalhes,
    acoesJudiciais: ajDetalhes,
  }
}

// ─── Participações Builder ────────────────────────────────────────────────────

// opt = targetData.optionalFeatures (top-level, not inside report)
function buildParticipacoes(opt: any): Participacao[] {
  // PF: opt.partner.partnershipResponse
  const rawList: any[] = opt.partner?.partnershipResponse || []

  return rawList.map((p: any) => ({
    razaoSocial: p.companyName || '-',
    cnpj: p.businessDocument || '-',
    participacao: p.participationPercentage != null ? `${p.participationPercentage}%` : '-',
    uf: p.companyState || '-',
    statusCnpj: p.companyStatus || '-',
    desde: fmtDateBR(p.participationInitialDate),
    ultimaAtualizacao: fmtDateBR(p.updateDate),
  }))
}

// ─── Score Extractors ─────────────────────────────────────────────────────────

// Normaliza defaultRate: "19,50" → 19.5, "10000" → 100.0
function parseDefaultRate(s: string | undefined): number {
  if (!s) return 0
  const raw = parseFloat(s.replace(',', '.'))
  if (isNaN(raw)) return 0
  return raw > 100 ? Math.min(100, raw / 100) : raw
}

// opt = targetData.optionalFeatures
function extractScorePF(opt: any): { pontuacao: number; chancePagamento: number } {
  const scoreObj = opt.score || {}
  const defaultRate = parseDefaultRate(scoreObj.defaultRate)
  return {
    pontuacao: safeNum(scoreObj.score),
    // defaultRate é a chance de inadimplência → chance de pagamento = 100 - defaultRate
    chancePagamento: Math.max(0, Math.round((100 - defaultRate) * 100) / 100),
  }
}

// opt = targetData.optionalFeatures
function extractScorePJ(opt: any, consultationType: string): {
  pontuacao: number
  probabilidadeInadimplencia: number
  risco: string
  praticasMercado: string
  interpretacao: string
} {
  if (consultationType === 'rating_pj') {
    // Rating PJ: opt.scores.scoreResponse[] — HIP2 = score principal
    const scores: any[] = opt.scores?.scoreResponse || []
    const main = scores.find((s: any) => s.scoreModel === 'HIP2') || scores[0] || {}
    return {
      pontuacao: safeNum(main.score),
      probabilidadeInadimplencia: parseDefaultRate(main.defaultRate),
      risco: main.message || '-',
      praticasMercado: scores.map((s: any) => s.scoreModel).filter(Boolean).join(', ') || '-',
      interpretacao: main.message || '-',
    }
  }
  // Básica PJ: opt.score
  const scoreObj = opt.score || {}
  return {
    pontuacao: safeNum(scoreObj.score),
    probabilidadeInadimplencia: parseDefaultRate(scoreObj.defaultRate),
    risco: scoreObj.message || '-',
    praticasMercado: scoreObj.scoreModel || '-',
    interpretacao: scoreObj.message || '-',
  }
}

// ─── Sócios / Administradores Builder (PJ) ────────────────────────────────────

function buildSociosAdmins(report: any, opt: any = {}): {
  socios: Array<{ documento: string; nome: string; participacao: string }>
  administradores: Array<{ documento: string; nome: string; cargo: string }>
} {
  const reg = report.registration || {}

  // Try PARTICIPACOES.partnerships for equity partners
  const partnerList: any[] =
    opt.PARTICIPACOES?.partnerships ||
    opt.QSA?.boardMembers ||
    reg.partners ||
    []

  // Try QSA.boardMembers for board/admin members
  const boardList: any[] =
    opt.QSA?.boardMembers ||
    opt.PARTICIPACOES?.boardMembers ||
    []

  const socios = partnerList
    .filter((m: any) => !m.role || /soci|acion|partner/i.test(m.role))
    .map((m: any) => ({
      documento: m.document || m.cpf || m.cnpj || '-',
      nome: m.name || m.companyName || '-',
      participacao: m.participationPercentage != null ? `${m.participationPercentage}%` : '-',
    }))

  const administradores = boardList
    .filter((m: any) => m.role && /admin|diretor|gerente|president/i.test(m.role))
    .map((m: any) => ({
      documento: m.document || m.cpf || m.cnpj || '-',
      nome: m.name || '-',
      cargo: m.role || '-',
    }))

  // Fallback: if boardList has admin entries not already covered, add them
  if (administradores.length === 0 && boardList.length > 0) {
    boardList.forEach((m: any) => {
      administradores.push({
        documento: m.document || m.cpf || m.cnpj || '-',
        nome: m.name || '-',
        cargo: m.role || '-',
      })
    })
  }

  return { socios, administradores }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapTargetToGeneric(
  targetData: any,
  type: 'PF' | 'PJ',
  consultationType: string
): BasicaPFResult | BasicaPJResult | RatingPFResult | RatingPJResult {
  const report = targetData.reports?.[0] || targetData
  const reg = report.registration || {}
  // optionalFeatures fica na RAIZ da resposta, não dentro do report
  const opt = targetData.optionalFeatures || {}

  const anotacoes = buildAnotacoes(report)
  const consultadoEm = new Date().toLocaleString('pt-BR')

  if (type === 'PF') {
    const score = extractScorePF(opt)
    const participacoes = buildParticipacoes(opt)

    const situacaoCpf: string = reg.statusRegistration || 'REGULAR'

    if (consultationType === 'rating_pf') {
      // Renda Estimada — opt.attributes.estimatedIncome.scoring (valor do modelo HRP2)
      const estimatedIncome = opt.attributes?.estimatedIncome?.scoring ||
        opt.attributes?.attributesResponse?.[0]?.scoring || 0
      const renda = {
        min: safeNum(estimatedIncome),
        max: safeNum(estimatedIncome),
      }

      // Capacidade de Pagamento — opt.attributes.affordability.scoring (modelo HCPA)
      const affordability = opt.attributes?.affordability?.scoring || 0
      const capacidadePagamento = {
        min: safeNum(affordability),
        max: safeNum(affordability),
      }

      const result: RatingPFResult = {
        tipo: 'rating_pf',
        documento: reg.documentNumber || '',
        identificacao: {
          nome: reg.consumerName || '-',
          cpf: reg.documentNumber || '',
          dataNascimento: fmtDateBR(reg.birthDate),
          nomeMae: reg.motherName || '-',
          situacaoCpf,
        },
        anotacoes,
        score,
        participacoes,
        renda,
        capacidadePagamento,
        consultadoEm,
      }
      return result
    }

    const result: BasicaPFResult = {
      tipo: 'basica_pf',
      documento: reg.documentNumber || '',
      identificacao: {
        nome: reg.consumerName || '-',
        cpf: reg.documentNumber || '',
        dataNascimento: fmtDateBR(reg.birthDate),
        nomeMae: reg.motherName || '-',
        situacaoCpf,
      },
      anotacoes,
      score,
      participacoes,
      consultadoEm,
    }
    return result
  } else {
    // PJ
    const score = extractScorePJ(opt, consultationType)
    const { socios, administradores } = buildSociosAdmins(report, opt)

    const situacaoCnpj: string = reg.statusRegistration || 'ATIVA'

    // Faturamento — Rating PJ: opt.scores.scoreResponse HFE3 (valorEmMilhares)
    let faturamento = 0
    {
      const scores: any[] = opt.scores?.scoreResponse || []
      const hfe3 = scores.find((s: any) => s.scoreModel === 'HFE3')
      const param = hfe3?.scoreParam?.find((p: any) => p.key === 'valorEmMilhares')
      faturamento = safeNum(param?.value)
    }

    if (consultationType === 'rating_pj') {
      // Limite de Crédito — HLC1 score (valor em reais)
      const scores: any[] = opt.scores?.scoreResponse || []
      const hlc1 = scores.find((s: any) => s.scoreModel === 'HLC1')
      const limiteCredito = safeNum(hlc1?.score)

      const result: RatingPJResult = {
        tipo: 'rating_pj',
        documento: reg.companyDocument || '',
        identificacao: {
          razaoSocial: reg.companyName || '-',
          cnpj: reg.companyDocument || '',
          dataFundacao: fmtDateBR(reg.foundationDate),
          uf: reg.federalUnit || reg.address?.federalUnit || '-',
          municipio: reg.city || reg.address?.city || '-',
          situacaoCnpj,
        },
        anotacoes,
        score: {
          pontuacao: score.pontuacao,
          probabilidadeInadimplencia: score.probabilidadeInadimplencia,
          risco: score.risco,
          praticasMercado: score.praticasMercado,
          interpretacao: score.interpretacao,
        },
        faturamento,
        limiteCredito,
        socios,
        administradores,
        consultadoEm,
      }
      return result
    }

    const result: BasicaPJResult = {
      tipo: 'basica_pj',
      documento: reg.companyDocument || '',
      identificacao: {
        razaoSocial: reg.companyName || '-',
        cnpj: reg.companyDocument || '',
        dataFundacao: fmtDateBR(reg.foundationDate),
        uf: reg.federalUnit || reg.address?.federalUnit || '-',
        municipio: reg.city || reg.address?.city || '-',
        situacaoCnpj,
      },
      anotacoes,
      score: {
        pontuacao: score.pontuacao,
        risco: score.risco,
        probabilidadeInadimplencia: score.probabilidadeInadimplencia,
        praticasMercado: score.praticasMercado,
        interpretacao: score.interpretacao,
      },
      faturamento,
      socios,
      administradores,
      consultadoEm,
    }
    return result
  }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

export async function consultarBasicaPF(cpf: string) {
  try {
    // SCORE_POSITIVO_PME é o modelo contratado (SCORE_POSITIVO não está liberado)
    const features = 'SCORE_POSITIVO_PME,PARTICIPACAO_SOCIETARIA'
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PF', 'basica_pf') as BasicaPFResult }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarBasicaPJ(cnpj: string) {
  try {
    // SCORE_POSITIVO para PJ só funciona com RELATORIO_BASICO_PJ; PARTICIPACOES não é compatível com esse relatório
    const features = 'SCORE_POSITIVO'
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_BASICO_PJ`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PJ', 'basica_pj') as BasicaPJResult }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPF(cpf: string) {
  try {
    // SCORE_POSITIVO_PME é o modelo contratado; HISTORICO_PAGAMENTO disponível no contrato
    const features = 'SCORE_POSITIVO_PME,PARTICIPACAO_SOCIETARIA,RENDA_ESTIMADA,CAPACIDADE_PAGAMENTO,HISTORICO_PAGAMENTO'
    const data = await apiGet(`/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PF', 'rating_pf') as RatingPFResult }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function consultarRatingPJ(cnpj: string) {
  try {
    // PJ usa PARTICIPACOES; SCORE_POSITIVO não disponível no contrato para PJ
    const features = 'PARTICIPACOES,FATURAMENTO_ESTIMADO_POSITIVO,LIMITE_CREDITO,PONTUALIDADE_PAGAMENTO'
    const data = await apiGet(`/crednet/pjconsultation/${cnpj}/SP/RELATORIO_INTERMEDIARIO_PJ`, { optionalFeatures: features })
    return { success: true, data: mapTargetToGeneric(data, 'PJ', 'rating_pj') as RatingPJResult }
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
