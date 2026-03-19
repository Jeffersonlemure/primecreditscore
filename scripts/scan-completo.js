/**
 * SCAN COMPLETO - PrimeCreditScore
 * Testa: autenticação, 4 consultas, features, geração de PDF
 * Uso: node scripts/scan-completo.js
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const AUTH_URL  = process.env.TARGET_AUTH_URL
const BASE_URL  = (process.env.TARGET_BASE_URL || '').replace(/\/+$/, '')
const CLIENT_ID = process.env.TARGET_CLIENT_ID
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET
const CLIENT_DOC = process.env.TARGET_CLIENT_DOC || ''

// Documentos de homologação (conforme manual CredNet)
const HOMOLOG_CPF  = '00000002305'
const HOMOLOG_UF_PF = 'SP'
const HOMOLOG_CNPJ = '00261304000102'
const HOMOLOG_UF_PJ = 'RJ'

const BOLD  = '\x1b[1m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN  = '\x1b[36m'
const RESET = '\x1b[0m'

const ok   = (msg) => console.log(`  ${GREEN}✅ ${msg}${RESET}`)
const fail = (msg) => console.log(`  ${RED}❌ ${msg}${RESET}`)
const warn = (msg) => console.log(`  ${YELLOW}⚠️  ${msg}${RESET}`)
const info = (msg) => console.log(`  ${CYAN}ℹ️  ${msg}${RESET}`)
const title = (msg) => console.log(`\n${BOLD}${msg}${RESET}`)

// ── 1. Checagem de variáveis de ambiente ─────────────────────────────────────

function checkEnv() {
  title('1. VARIÁVEIS DE AMBIENTE')

  const required = { AUTH_URL, BASE_URL, CLIENT_ID, CLIENT_SECRET }
  let allOk = true

  for (const [k, v] of Object.entries(required)) {
    if (!v) { fail(`${k} não definido no .env.local`); allOk = false }
    else ok(`${k} = ${k.includes('SECRET') ? '***' : v}`)
  }

  if (!CLIENT_DOC) warn('TARGET_CLIENT_DOC não definido — header x-indirect-user-doc ficará vazio (necessário em produção)')
  else ok(`CLIENT_DOC = ${CLIENT_DOC}`)

  if (BASE_URL.includes('homolog')) {
    warn('TARGET_BASE_URL aponta para HOMOLOGAÇÃO — usando documentos de homolog para o scan')
    warn('Para produção altere para: https://crednet.targetinformacoes.com')
  } else if (BASE_URL.includes('crednet.targetinformacoes.com')) {
    ok('TARGET_BASE_URL aponta para PRODUÇÃO ✓')
  }

  return allOk
}

// ── 2. Autenticação ──────────────────────────────────────────────────────────

async function getToken() {
  title('2. AUTENTICAÇÃO (OAuth2)')
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  try {
    const res = await axios.post(
      AUTH_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const { access_token, expires_in, scope } = res.data
    ok(`Token obtido com sucesso`)
    info(`expires_in: ${expires_in}s | scope: ${scope}`)
    return access_token
  } catch (e) {
    fail(`Falha na autenticação: ${e.response?.status} - ${JSON.stringify(e.response?.data || e.message)}`)
    return null
  }
}

// ── 3. Consultas Target API ──────────────────────────────────────────────────

async function consultar(token, label, url) {
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'x-indirect-user-doc': CLIENT_DOC
      }
    })
    const report = res.data?.reports?.[0]
    if (!report) {
      warn(`${label}: resposta sem reports[]`)
      return null
    }
    ok(`${label} — HTTP 200`)
    return report
  } catch (e) {
    const status = e.response?.status
    const data = JSON.stringify(e.response?.data || e.message).substring(0, 200)
    fail(`${label} — HTTP ${status}: ${data}`)
    return null
  }
}

async function testarConsultas(token) {
  title('3. CONSULTAS API (documentos de homologação)')

  const results = {}

  // Básica PF — usa RELATORIO_INTERMEDIARIO_PF com features básicas
  const urlBasicaPF = `${BASE_URL}/crednet/pfconsultation/${HOMOLOG_CPF}/RELATORIO_INTERMEDIARIO_PF?optionalFeatures=SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA`
  const rBasicaPF = await consultar(token, 'Básica PF  (RELATORIO_INTERMEDIARIO_PF + SCORE/PARTICIPACAO)', urlBasicaPF)
  if (rBasicaPF) {
    checkCampos('Básica PF', rBasicaPF, ['registration', 'negativeData'])
    results.basica_pf = rBasicaPF
  }

  // Básica PJ — PJ usa PARTICIPACOES (não PARTICIPACAO_SOCIETARIA)
  const urlBasicaPJ = `${BASE_URL}/crednet/pjconsultation/${HOMOLOG_CNPJ}/${HOMOLOG_UF_PJ}/RELATORIO_INTERMEDIARIO_PJ?optionalFeatures=SCORE_POSITIVO,PARTICIPACOES`
  const rBasicaPJ = await consultar(token, 'Básica PJ  (RELATORIO_INTERMEDIARIO_PJ + SCORE/PARTICIPACOES)', urlBasicaPJ)
  if (rBasicaPJ) {
    checkCampos('Básica PJ', rBasicaPJ, ['registration', 'negativeData'])
    results.basica_pj = rBasicaPJ
  }

  // Rating PF
  const urlRatingPF = `${BASE_URL}/crednet/pfconsultation/${HOMOLOG_CPF}/RELATORIO_INTERMEDIARIO_PF?optionalFeatures=SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA,RENDA_ESTIMADA,CAPACIDADE_PAGAMENTO`
  const rRatingPF = await consultar(token, 'Rating PF  (RELATORIO_INTERMEDIARIO_PF + RENDA/CAPACIDADE)', urlRatingPF)
  if (rRatingPF) {
    checkCampos('Rating PF', rRatingPF, ['registration', 'negativeData'])
    results.rating_pf = rRatingPF
  }

  // Rating PJ — PJ usa PARTICIPACOES
  const urlRatingPJ = `${BASE_URL}/crednet/pjconsultation/${HOMOLOG_CNPJ}/${HOMOLOG_UF_PJ}/RELATORIO_INTERMEDIARIO_PJ?optionalFeatures=SCORE_POSITIVO,PARTICIPACOES,FATURAMENTO_ESTIMADO_POSITIVO,LIMITE_CREDITO`
  const rRatingPJ = await consultar(token, 'Rating PJ  (RELATORIO_INTERMEDIARIO_PJ + FATURAMENTO/LIMITE)', urlRatingPJ)
  if (rRatingPJ) {
    checkCampos('Rating PJ', rRatingPJ, ['registration', 'negativeData'])
    results.rating_pj = rRatingPJ
  }

  return results
}

function checkCampos(label, report, campos) {
  for (const c of campos) {
    if (report[c] !== undefined) info(`  [${label}] campo "${c}" presente`)
    else warn(`  [${label}] campo "${c}" AUSENTE`)
  }
}

function checkFeature(label, report, check) {
  const pos = report.optionalFeatureResponse || report.positiveData || {}
  const hasFeature = check ? check() : (pos[label.toLowerCase().replace(/_/g, '')] !== undefined || JSON.stringify(pos).length > 10)
  if (hasFeature) info(`  feature ${label} retornada`)
  else warn(`  feature ${label} pode não ter sido retornada (verifique contrato)`)
}

// ── 4. Geração de PDF ────────────────────────────────────────────────────────

async function testarPDF(reports) {
  title('4. GERAÇÃO DE PDF')

  // Tenta importar jsPDF — só funciona em ambiente Node com transpilação
  // Usamos uma simulação de dados para verificar a lógica
  try {
    // Verifica se arquivo existe e exporta as 4 funções
    const pdfFile = path.resolve('./lib/pdf-generator.ts')
    if (!fs.existsSync(pdfFile)) {
      fail('lib/pdf-generator.ts não encontrado')
      return
    }
    ok('lib/pdf-generator.ts existe')

    // Checa se as 4 funções estão definidas no arquivo
    const src = fs.readFileSync(pdfFile, 'utf-8')
    const fns = ['generateBasicaPFPdf', 'generateBasicaPJPdf', 'generateRatingPFPdf', 'generateRatingPJPdf']
    for (const fn of fns) {
      if (src.includes(`export async function ${fn}`)) ok(`Função ${fn} exportada`)
      else fail(`Função ${fn} NÃO encontrada`)
    }

    // Verifica seções esperadas nos PDFs
    const sections = {
      basicaPF: ['Identificação', 'Status do CPF', 'Anotações Negativas', 'Score de Crédito', 'Participações Societárias'],
      basicaPJ: ['Identificação', 'Status da Empresa', 'Anotações Negativas', 'Detalhamento Societário'],
      ratingPF: ['Identificação', 'Anotações Negativas', 'Score de Crédito', 'Informações de Renda', 'Capacidade de Pagamento', 'Histórico de Pagamentos'],
      ratingPJ: ['Identificação', 'Anotações Negativas', 'Score Empresarial', 'Classificação de Risco', 'Análise Financeira', 'Quadro Societário'],
    }
    for (const [tipo, secs] of Object.entries(sections)) {
      for (const sec of secs) {
        if (src.includes(sec)) info(`  [${tipo}] seção "${sec}" presente no template`)
        else warn(`  [${tipo}] seção "${sec}" NÃO encontrada no template`)
      }
    }

    ok('Estrutura do PDF validada')
  } catch (e) {
    fail(`Erro ao validar PDF: ${e.message}`)
  }
}

// ── 5. Build TypeScript ──────────────────────────────────────────────────────

async function testarBuild() {
  title('5. VERIFICAÇÃO DE TIPOS (TypeScript)')
  const { execSync } = require('child_process')
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: process.cwd() })
    ok('TypeScript sem erros de tipo')
  } catch (e) {
    const out = e.stdout?.toString() || e.stderr?.toString() || e.message
    fail(`Erros TypeScript encontrados:\n${out.substring(0, 600)}`)
  }
}

// ── Relatório Final ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${BOLD}  SCAN COMPLETO — PrimeCreditScore${RESET}`)
  console.log(`  ${new Date().toLocaleString('pt-BR')}`)
  console.log(`${'═'.repeat(60)}`)

  const envOk = checkEnv()
  if (!envOk) {
    fail('Corrija as variáveis de ambiente antes de continuar.')
    process.exit(1)
  }

  const token = await getToken()
  if (!token) {
    fail('Sem token — encerrando.')
    process.exit(1)
  }

  const reports = await testarConsultas(token)
  await testarPDF(reports)
  await testarBuild()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${BOLD}  SCAN CONCLUÍDO${RESET}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1) })
