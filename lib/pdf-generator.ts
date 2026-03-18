// PDF Generator for PrimeCreditScore
// Generates professional PDFs for 4 consultation types

import { jsPDF } from 'jspdf'
import type { BasicaPFResult, BasicaPJResult, RatingPFResult, RatingPJResult } from './types'
import { SERASA_LOGO_BASE64 } from './logoBase64'

const COLORS = {
  primary: [26, 86, 219] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [243, 244, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  scoreGreen: [34, 197, 94] as [number, number, number],
  scoreBlue: [59, 130, 246] as [number, number, number],
  scoreYellow: [234, 179, 8] as [number, number, number],
  scoreRed: [239, 68, 68] as [number, number, number],
  orange: [183, 121, 80] as [number, number, number],
}

function getScoreColor(score: number): [number, number, number] {
  if (score >= 700) return COLORS.scoreGreen
  if (score >= 500) return COLORS.scoreBlue
  if (score >= 300) return COLORS.scoreYellow
  return COLORS.scoreRed
}

function getScoreLabel(score: number): string {
  if (score >= 700) return 'EXCELENTE'
  if (score >= 500) return 'BOM'
  if (score >= 300) return 'REGULAR'
  return 'BAIXO'
}

function formatCPF(cpf: string): string {
  const c = cpf.replace(/\D/g, '')
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatCNPJ(cnpj: string): string {
  const c = cnpj.replace(/\D/g, '')
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}

// ─── PDF Base Helpers ─────────────────────────────────────────────────────────

function createPDF(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth()

  // Informativo Box
  doc.setDrawColor(...COLORS.warning)
  doc.setLineWidth(0.3)
  doc.roundedRect(14, 10, pageW - 28, 14, 2, 2, 'D')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.warning)
  doc.text('Informativo', 18, 15)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('Ressaltamos que a análise de crédito e seu resultado são de responsabilidade exclusiva do cliente associado.', 18, 21)

  // Logo Serasa
  try {
    doc.addImage(SERASA_LOGO_BASE64, 'PNG', 14, 30, 36, 12)
  } catch (e) {
    console.warn('Erro ao carregar logo', e)
  }

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.orange)
  doc.text(title, 14, 55)

  // Date
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.dark)
  const data = new Date().toLocaleString('pt-BR')
  doc.text(data, pageW - 14, 55, { align: 'right' })
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFillColor(...COLORS.primary)
  doc.rect(0, pageH - 12, pageW, 12, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('PrimeCreditScore — Consulta de Crédito Profissional', 14, pageH - 4)
  doc.text('Dados sujeitos a confirmação. Uso exclusivo para fins de crédito.', pageW - 14, pageH - 4, { align: 'right' })
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth()

  doc.setTextColor(...COLORS.orange)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), 14, y + 5)

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(14, y + 7, pageW - 14, y + 7)

  return y + 12
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, labelW = 40): number {
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text(label + ':', x, y)

  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(value || '-', x + labelW, y)
  return y + 5.5
}

function drawTwoColumns(doc: jsPDF, fields: Array<[string, string]>, startY: number, startX = 14): number {
  let y = startY
  const colW = 92
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i]) drawField(doc, fields[i][0], fields[i][1], startX, y)
    if (fields[i + 1]) drawField(doc, fields[i + 1][0], fields[i + 1][1], startX + colW, y)
    y += 5.5
  }
  return y
}

function drawStatusBadge(doc: jsPDF, status: string, x: number, y: number) {
  const isPositive = ['REGULAR', 'ATIVA', 'BOA', 'BAIXO'].includes(status?.toUpperCase())
  const color = isPositive ? COLORS.success : COLORS.danger

  doc.setFillColor(...color)
  doc.roundedRect(x, y - 4, 30, 6, 1, 1, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text(status || '-', x + 15, y, { align: 'center' })

  doc.setTextColor(...COLORS.dark)
}


function checkPageBreak(doc: any, currentY: number, requiredSpace: number): number {
  if (currentY + requiredSpace > 280) {
    doc.addPage()
    drawHeader(doc, doc.__title || '', doc.__subtitle || '')
    return 62
  }
  return currentY
}

function drawScoreGauge(doc: jsPDF, score: number, cx: number, startY: number, r = 18) {
  const gaugeW = r * 2 + 20
  const gaugeH = r + 15

  // Background box
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(cx - gaugeW / 2, startY, gaugeW, gaugeH, 3, 3, 'F')

  const cy = startY + r + 8

  const START_ANGLE = Math.PI // 180 deg
  const END_ANGLE = 0 // 0 deg

  const drawSegment = (startVal: number, endVal: number, color: [number, number, number]) => {
    const minScore = 0
    const maxScore = 1000
    
    const a1 = Math.PI + (startVal / maxScore) * Math.PI
    const a2 = Math.PI + (endVal / maxScore) * Math.PI
    
    const steps = 30
    const lines = []
    
    const gap = 0.05
    const drawA1 = a1 + (startVal === 0 ? 0 : gap)
    const drawA2 = a2 - (endVal === 1000 ? 0 : gap)
    
    if (drawA2 <= drawA1) return
    
    const p0x = cx + r * Math.cos(drawA1)
    const p0y = cy + r * Math.sin(drawA1)
    
    let prevX = p0x
    let prevY = p0y
    
    for (let i = 1; i <= steps; i++) {
        const a = drawA1 + (i / steps) * (drawA2 - drawA1)
        const px = cx + r * Math.cos(a)
        const py = cy + r * Math.sin(a)
        lines.push([px - prevX, py - prevY])
        prevX = px
        prevY = py
    }
    
    doc.setDrawColor(...color)
    doc.setLineWidth(5)
    // @ts-ignore
    doc.setLineCap(1)
    doc.lines(lines, p0x, p0y, [1, 1], 'S')
  }

  // Segment 1 (0 - 300)
  const isSeg1Active = score >= 0
  drawSegment(0, 300, isSeg1Active ? COLORS.scoreRed : [230, 230, 230])
  
  // Segment 2 (300 - 700)
  const isSeg2Active = score >= 300
  drawSegment(300, 700, isSeg2Active ? COLORS.scoreYellow : [230, 230, 230])
  
  // Segment 3 (700 - 1000)
  const isSeg3Active = score >= 700
  drawSegment(700, 1000, isSeg3Active ? COLORS.scoreGreen : [230, 230, 230])

  // Center Score Number
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(String(score), cx, cy + 1, { align: 'center' })

  // "de 1000" text
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('de 1000', cx, cy + 6, { align: 'center' })

  // Reset line styles
  // @ts-ignore
  doc.setLineCap(0)
  doc.setTextColor(...COLORS.dark)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)

  return startY + gaugeH + 5
}

// ─── Anotações Table ──────────────────────────────────────────────────────────

function drawAnotacoesTable(
  doc: jsPDF,
  anotacoes: { totalDividas: number; valorTotal: number; itens: Array<{ credor: string; valor: number; data: string; tipo: string }> },
  y: number
): number {
  const pageW = doc.internal.pageSize.getWidth()

  if (anotacoes.totalDividas === 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.success)
    doc.text('✓ Nenhuma anotação negativa encontrada', 14, y + 5)
    doc.setTextColor(...COLORS.dark)
    return y + 12
  }

  // Summary row
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Total: ${anotacoes.totalDividas} ocorrência(s) — Valor: ${formatCurrency(anotacoes.valorTotal)}`, 14, y + 5)
  doc.setTextColor(...COLORS.dark)

  y += 10

  // Table header
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.3)
  doc.rect(14, y, pageW - 28, 7, 'S')
  doc.setTextColor(...COLORS.dark)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Credor', 17, y + 5)
  doc.text('Tipo', 80, y + 5)
  doc.text('Data', 130, y + 5)
  doc.text('Valor', pageW - 17, y + 5, { align: 'right' })

  y += 7
  anotacoes.itens.forEach((item, i) => {
    y = checkPageBreak(doc, y, 10);
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, pageW - 28, 6.5, 'F')
    }
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(item.credor?.substring(0, 30) || '-', 17, y + 4.5)
    doc.text(item.tipo?.substring(0, 20) || '-', 80, y + 4.5)
    doc.text(formatDate(item.data), 130, y + 4.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.danger)
    doc.text(formatCurrency(item.valor), pageW - 17, y + 4.5, { align: 'right' })
    doc.setTextColor(...COLORS.dark)
    doc.setFont('helvetica', 'normal')
    y += 6.5
  })

  return y + 5
}

// ─── PDF: Básica PF ──────────────────────────────────────────────────────────

export async function generateBasicaPFPdf(data: BasicaPFResult): Promise<Uint8Array> {
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()

  ;(doc as any).__title = 'CONSULTA BÁSICA PF'; (doc as any).__subtitle = 'Pessoa Física'; drawHeader(doc, (doc as any).__title, (doc as any).__subtitle)
  let y = 62

  // Identificação
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '1. Identificação', y)
  y = drawTwoColumns(doc, [
    ['Nome', data.identificacao?.nome],
    ['CPF', formatCPF(data.identificacao?.cpf || '')],
    ['Nascimento', formatDate(data.identificacao?.dataNascimento)],
    ['Sexo', data.identificacao?.sexo === 'M' ? 'Masculino' : 'Feminino'],
  ], y)
  y += 4

  // Status
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '2. Status do CPF', y)
  drawField(doc, 'Situação Receita', '', 14, y + 3)
  drawStatusBadge(doc, data.status?.situacaoReceita || 'REGULAR', 55, y + 3)
  drawField(doc, 'Óbito', data.status?.obitos ? 'SIM' : 'NÃO', 14 + 92, y + 3)
  drawField(doc, 'PEP', data.status?.pep ? 'SIM' : 'NÃO', 14 + 92 + 55, y + 3)
  y += 12

  // Anotações
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '3. Anotações Negativas', y)
  y = drawAnotacoesTable(doc, data.anotacoes, y)
  y += 4

  // Score Gauge
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '4. Score de Crédito', y)
  const score = data.score?.pontuacao || 0
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Percentil Brasil: ${data.score?.percentilBrasil || 0}%`, 14, y + 4)
  doc.setTextColor(...COLORS.dark)
  y = drawScoreGauge(doc, score, pageW / 2, y + 8)
  y += 5

  // Participações Societárias
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '5. Participações Societárias', y)
  if (!data.participacoes?.empresas?.length) {
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.gray)
    doc.text('Nenhuma participação societária encontrada.', 14, y + 5)
    doc.setTextColor(...COLORS.dark)
    y += 10
  } else {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.rect(14, y, pageW - 28, 7, 'S')
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Empresa', 17, y + 5)
    doc.text('CNPJ', 100, y + 5)
    doc.text('Participação', 150, y + 5)
    y += 7

    data.participacoes.empresas.forEach((emp, i) => {
      y = checkPageBreak(doc, y, 10);
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, pageW - 28, 6.5, 'F')
      }
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(emp.razaoSocial?.substring(0, 45) || '-', 17, y + 4.5)
      doc.text(formatCNPJ(emp.cnpj) || '-', 100, y + 4.5)
      doc.text(emp.participacao || '-', 150, y + 4.5)
      y += 6.5
    })
    y += 5
  }

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Básica PJ ──────────────────────────────────────────────────────────

export async function generateBasicaPJPdf(data: BasicaPJResult): Promise<Uint8Array> {
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()

  ;(doc as any).__title = 'CONSULTA BÁSICA PJ'; (doc as any).__subtitle = 'Pessoa Jurídica'; drawHeader(doc, (doc as any).__title, (doc as any).__subtitle)
  let y = 62

  // Identificação
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '1. Identificação', y)
  y = drawTwoColumns(doc, [
    ['Razão Social', data.identificacao?.razaoSocial],
    ['CNPJ', formatCNPJ(data.identificacao?.cnpj || '')],
    ['Nome Fantasia', data.identificacao?.nomeFantasia],
    ['Abertura', formatDate(data.identificacao?.dataAbertura)],
    ['Natureza Jurídica', data.identificacao?.naturezaJuridica],
    ['Porte', data.identificacao?.porte],
    ['Atividade Principal', data.identificacao?.atividadePrincipal],
    ['Situação', data.identificacao?.situacaoCadastral],
  ], y)
  y += 4

  // Status
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '2. Status da Empresa', y)
  drawField(doc, 'Situação Receita', '', 14, y + 3)
  drawStatusBadge(doc, data.status?.situacaoReceita || 'ATIVA', 55, y + 3)
  drawField(doc, 'Dívida Ativa', data.status?.dividaAtiva ? 'SIM' : 'NÃO', 14 + 92, y + 3)
  y += 12

  // Anotações
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '3. Anotações Negativas', y)
  y = drawAnotacoesTable(doc, data.anotacoes, y)
  y += 4

  // Detalhamento societário
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '4. Detalhamento Societário', y)
  drawField(doc, 'Capital Social', formatCurrency(data.detalhamento?.capitalSocial || 0), 14, y + 5)
  y += 10

  // Sócios
  if (data.detalhamento?.socios?.length) {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.rect(14, y, pageW - 28, 7, 'S')
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Nome', 17, y + 5)
    doc.text('CPF', 80, y + 5)
    doc.text('Cargo', 120, y + 5)
    doc.text('Participação', pageW - 17, y + 5, { align: 'right' })
    y += 7

    data.detalhamento.socios.forEach((s, i) => {
      y = checkPageBreak(doc, y, 10);
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, pageW - 28, 6.5, 'F')
      }
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(s.nome || '-', 17, y + 4.5)
      doc.text(formatCPF(s.cpf || ''), 80, y + 4.5)
      doc.text(s.cargo || '-', 120, y + 4.5)
      doc.text(s.participacao || '-', pageW - 17, y + 4.5, { align: 'right' })
      y += 6.5
    })
  }

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Rating PF ──────────────────────────────────────────────────────────

export async function generateRatingPFPdf(data: RatingPFResult): Promise<Uint8Array> {
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()

  ;(doc as any).__title = 'CONSULTA RATING PF'; (doc as any).__subtitle = 'Análise Completa — Pessoa Física'; drawHeader(doc, (doc as any).__title, (doc as any).__subtitle)
  let y = 62

  // Identificação
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '1. Identificação', y)
  y = drawTwoColumns(doc, [
    ['Nome', data.identificacao?.nome],
    ['CPF', formatCPF(data.identificacao?.cpf || '')],
    ['Nascimento', formatDate(data.identificacao?.dataNascimento)],
    ['Situação CPF', data.status?.situacaoReceita],
  ], y)
  y += 4

  // Anotações
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '2. Anotações Negativas', y)
  y = drawAnotacoesTable(doc, data.anotacoes, y)
  y += 4

  // Score
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '3. Score de Crédito', y)
  doc.setFontSize(8)
  doc.text(`Percentil Brasil: ${data.score?.percentilBrasil || 0}%`, 14, y + 4)
  y = drawScoreGauge(doc, data.score?.pontuacao || 0, pageW / 2, y + 8)
  y += 5

  // Renda
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '4. Informações de Renda', y)
  y = drawTwoColumns(doc, [
    ['Renda Estimada', formatCurrency(data.renda?.rendaEstimada || 0)],
    ['Faixa de Renda', data.renda?.faixaRenda],
    ['Fonte', data.renda?.fonteRenda],
    ['', ''],
  ], y)
  y += 4

  // Capacidade de Pagamento
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '5. Capacidade de Pagamento', y)
  const risco = data.capacidadePagamento?.classificacaoRisco || '-'
  const riscoColor = risco === 'BAIXO' ? COLORS.success : risco === 'MÉDIO' ? COLORS.warning : COLORS.danger

  doc.setFillColor(...COLORS.lightGray)
  doc.roundedRect(14, y, pageW - 28, 28, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.text('Limite Recomendado', 20, y + 8)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(formatCurrency(data.capacidadePagamento?.limiteRecomendado || 0), 20, y + 18)

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Comprometimento de Renda', pageW / 2, y + 8, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(`${data.capacidadePagamento?.comprometimentoRenda || 0}%`, pageW / 2, y + 18, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Classificação de Risco', pageW - 20, y + 8, { align: 'right' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...riscoColor)
  doc.text(risco, pageW - 20, y + 18, { align: 'right' })

  y += 34

  // Histórico
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '6. Histórico de Pagamentos', y)
  y = drawTwoColumns(doc, [
    ['Pontualidade', `${data.historicoPagamentos?.pontualidade || 0}%`],
    ['Em Dia', String(data.historicoPagamentos?.pagamentosEmDia || 0)],
    ['Atrasados', String(data.historicoPagamentos?.pagamentosAtrasados || 0)],
    ['', ''],
  ], y)

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Rating PJ ──────────────────────────────────────────────────────────

export async function generateRatingPJPdf(data: RatingPJResult): Promise<Uint8Array> {
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()

  ;(doc as any).__title = 'CONSULTA RATING PJ'; (doc as any).__subtitle = 'Análise Completa — Pessoa Jurídica'; drawHeader(doc, (doc as any).__title, (doc as any).__subtitle)
  let y = 62

  // Identificação
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '1. Identificação', y)
  y = drawTwoColumns(doc, [
    ['Razão Social', data.identificacao?.razaoSocial],
    ['CNPJ', formatCNPJ(data.identificacao?.cnpj || '')],
    ['Situação', data.identificacao?.situacaoCadastral],
    ['Abertura', formatDate(data.identificacao?.dataAbertura)],
  ], y)
  y += 4

  // Anotações
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '2. Anotações Negativas', y)
  y = drawAnotacoesTable(doc, data.anotacoes, y)
  y += 4

  // Score
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '3. Score Empresarial', y)
  y = drawScoreGauge(doc, data.score?.pontuacao || 0, pageW / 2, y + 5)
  y += 8

  // Risco e Rating
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '4. Classificação de Risco', y)
  doc.setFillColor(...COLORS.lightGray)
  doc.roundedRect(14, y, pageW - 28, 22, 2, 2, 'F')

  const riscoClass = data.risco?.classificacao || '-'
  const riscoColor = riscoClass === 'BAIXO' ? COLORS.success : riscoClass === 'MÉDIO' ? COLORS.warning : COLORS.danger

  doc.setFontSize(8); doc.setTextColor(...COLORS.gray)
  doc.text('Rating', 20, y + 8)
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.primary)
  doc.text(data.risco?.rating || '-', 20, y + 18)

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.gray)
  doc.text('Classificação', pageW / 2, y + 8, { align: 'center' })
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...riscoColor)
  doc.text(riscoClass, pageW / 2, y + 18, { align: 'center' })

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.gray)
  doc.text('Prob. Inadimplência', pageW - 20, y + 8, { align: 'right' })
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.dark)
  doc.text(`${data.risco?.probabilidadeInadimplencia || 0}%`, pageW - 20, y + 18, { align: 'right' })

  y += 30

  // Faturamento e Limite
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '5. Análise Financeira', y)
  y = drawTwoColumns(doc, [
    ['Faturamento Estimado', formatCurrency(data.faturamento?.estimativaAnual || 0)],
    ['Faixa de Faturamento', data.faturamento?.faixa],
    ['Limite Recomendado', formatCurrency(data.limiteCredito?.recomendado || 0)],
    ['Limite em Uso', formatCurrency(data.limiteCredito?.emUso || 0)],
    ['Limite Disponível', formatCurrency(data.limiteCredito?.disponivel || 0)],
    ['', ''],
  ], y)
  y += 4

  // Sócios
  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitle(doc, '6. Quadro Societário', y)
  if (data.socios?.length) {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.rect(14, y, pageW - 28, 7, 'S')
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Sócio', 17, y + 5)
    doc.text('CPF', 75, y + 5)
    doc.text('Cargo', 115, y + 5)
    doc.text('Part.', 150, y + 5)
    doc.text('Score', pageW - 17, y + 5, { align: 'right' })
    y += 7

    data.socios.forEach((s, i) => {
      y = checkPageBreak(doc, y, 10);
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, pageW - 28, 6.5, 'F')
      }
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(s.nome || '-', 17, y + 4.5)
      doc.text(formatCPF(s.cpf || ''), 75, y + 4.5)
      doc.text(s.cargo || '-', 115, y + 4.5)
      doc.text(s.participacao || '-', 150, y + 4.5)
      doc.setTextColor(...getScoreColor(s.scoreIndividual || 0))
      doc.setFont('helvetica', 'bold')
      doc.text(String(s.scoreIndividual || '-'), pageW - 17, y + 4.5, { align: 'right' })
      doc.setTextColor(...COLORS.dark)
      doc.setFont('helvetica', 'normal')
      y += 6.5
    })
  }

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}
