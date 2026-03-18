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
    return { success: false, error: getErrorMessage(error) }
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
    return { success: false, error: getErrorMessage(error) }
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
    return { success: false, error: getErrorMessage(error) }
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
    return { success: false, error: getErrorMessage(error) }
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Erro desconhecido'
}

// Mock data removed for production

export type ConsultaResultado = Awaited<ReturnType<typeof consultarBasicaPF>>
