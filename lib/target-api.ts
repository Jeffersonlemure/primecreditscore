// Target Informações API Integration (Serasa)
import axios from 'axios'

const AUTH_URL = process.env.TARGET_AUTH_URL!
const BASE_URL = process.env.TARGET_BASE_URL!
const CLIENT_ID = process.env.TARGET_CLIENT_ID!
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET!

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
    },
    params,
  })
  return response.data
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function consultarBasicaPF(cpf: string) {
  try {
    const data = await apiGet(`/pf/basica`, { 
      documento: cpf,
      relatorio: 'RELATORIO_INTERMEDIARIO_PF',
      features: 'SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA'
    })
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error), data: getMockBasicaPF(cpf) }
  }
}

export async function consultarBasicaPJ(cnpj: string) {
  try {
    const data = await apiGet(`/pj/basica`, { 
      documento: cnpj,
      relatorio: 'RELATORIO_INTERMEDIARIO_PJ',
      features: 'SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA'
    })
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error), data: getMockBasicaPJ(cnpj) }
  }
}

export async function consultarRatingPF(cpf: string) {
  try {
    const data = await apiGet(`/pf/rating`, { 
      documento: cpf,
      relatorio: 'RELATORIO_INTERMEDIARIO_PF',
      features: 'SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA,Renda_estimada,Capacidade_pagamento'
    })
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error), data: getMockRatingPF(cpf) }
  }
}

export async function consultarRatingPJ(cnpj: string) {
  try {
    const data = await apiGet(`/pj/rating`, { 
      documento: cnpj,
      relatorio: 'RELATORIO_INTERMEDIARIO_PJ',
      features: 'SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA,Faturamento_estimado_positivo,Limite_crédito'
    })
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error), data: getMockRatingPJ(cnpj) }
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Erro desconhecido'
}

// ─── Mock Data (Homologação) ─────────────────────────────────────────────────

function getMockBasicaPF(cpf: string) {
  return {
    tipo: 'basica_pf',
    documento: cpf,
    identificacao: {
      nome: 'JOÃO SILVA SANTOS',
      cpf: cpf,
      dataNascimento: '1985-06-15',
      sexo: 'M',
      situacaoCpf: 'REGULAR',
    },
    status: {
      situacaoReceita: 'REGULAR',
      obitos: false,
      pep: false,
    },
    anotacoes: {
      totalDividas: 2,
      valorTotal: 4850.00,
      itens: [
        { credor: 'BANCO XYZ', valor: 2500.00, data: '2024-03-15', tipo: 'CHEQUE SEM FUNDO' },
        { credor: 'FINANCEIRA ABC', valor: 2350.00, data: '2024-01-20', tipo: 'DÍVIDA BANCÁRIA' },
      ],
    },
    score: {
      pontuacao: 720,
      faixa: 'BOM',
      percentilBrasil: 68,
    },
    participacoes: {
      empresas: [
        { razaoSocial: 'SANTOS COMÉRCIO LTDA', cnpj: '12.345.678/0001-90', participacao: 'SÓCIO', dataEntrada: '2018-01-01' },
      ],
    },
    consultadoEm: new Date().toISOString(),
  }
}

function getMockBasicaPJ(cnpj: string) {
  return {
    tipo: 'basica_pj',
    documento: cnpj,
    identificacao: {
      razaoSocial: 'EMPRESA TESTE LTDA',
      nomeFantasia: 'EMPRESA TESTE',
      cnpj: cnpj,
      situacaoCadastral: 'ATIVA',
      dataAbertura: '2015-03-20',
      naturezaJuridica: 'SOCIEDADE LIMITADA',
      porte: 'MICRO EMPRESA',
      atividadePrincipal: 'COMÉRCIO VAREJISTA',
    },
    status: {
      situacaoReceita: 'ATIVA',
      dividaAtiva: false,
    },
    anotacoes: {
      totalDividas: 1,
      valorTotal: 12500.00,
      itens: [
        { credor: 'BANCO NACIONAL', valor: 12500.00, data: '2024-02-10', tipo: 'PROTESTO' },
      ],
    },
    detalhamento: {
      capitalSocial: 50000.00,
      socios: [
        { nome: 'JOÃO SILVA SANTOS', cpf: '000.000.023-05', participacao: '60%', cargo: 'SÓCIO-ADMINISTRADOR' },
        { nome: 'MARIA OLIVEIRA', cpf: '111.111.111-11', participacao: '40%', cargo: 'SÓCIA' },
      ],
      enderecos: [
        { tipo: 'PRINCIPAL', logradouro: 'RUA DAS FLORES, 123', bairro: 'CENTRO', cidade: 'SÃO PAULO', uf: 'SP', cep: '01310-100' },
      ],
    },
    consultadoEm: new Date().toISOString(),
  }
}

function getMockRatingPF(cpf: string) {
  const basica = getMockBasicaPF(cpf)
  return {
    ...basica,
    tipo: 'rating_pf',
    renda: {
      rendaEstimada: 8500.00,
      faixaRenda: 'MÉDIA-ALTA',
      fonteRenda: 'ASSALARIADO',
    },
    capacidadePagamento: {
      limiteRecomendado: 25500.00,
      comprometimentoRenda: 15.2,
      probabilidadeInadimplencia: 4.8,
      classificacaoRisco: 'BAIXO',
    },
    historicoPagamentos: {
      pontualidade: 94,
      pagamentosEmDia: 47,
      pagamentosAtrasados: 3,
    },
  }
}

function getMockRatingPJ(cnpj: string) {
  return {
    tipo: 'rating_pj',
    documento: cnpj,
    identificacao: {
      razaoSocial: 'EMPRESA TESTE LTDA',
      cnpj: cnpj,
      situacaoCadastral: 'ATIVA',
      dataAbertura: '2015-03-20',
    },
    anotacoes: {
      totalDividas: 1,
      valorTotal: 12500.00,
      itens: [
        { credor: 'BANCO NACIONAL', valor: 12500.00, data: '2024-02-10', tipo: 'PROTESTO' },
      ],
    },
    score: {
      pontuacao: 650,
      faixa: 'BOM',
      percentilBrasil: 55,
    },
    risco: {
      classificacao: 'MÉDIO',
      probabilidadeInadimplencia: 8.2,
      rating: 'BB+',
    },
    faturamento: {
      estimativaAnual: 480000.00,
      faixa: 'R$ 360k - R$ 720k',
    },
    limiteCredito: {
      recomendado: 48000.00,
      emUso: 12500.00,
      disponivel: 35500.00,
    },
    socios: [
      { nome: 'JOÃO SILVA SANTOS', cpf: '000.000.023-05', participacao: '60%', cargo: 'SÓCIO-ADMINISTRADOR', scoreIndividual: 720 },
      { nome: 'MARIA OLIVEIRA', cpf: '111.111.111-11', participacao: '40%', cargo: 'SÓCIA', scoreIndividual: 680 },
    ],
    consultadoEm: new Date().toISOString(),
  }
}

export type ConsultaResultado = Awaited<ReturnType<typeof consultarBasicaPF>>
