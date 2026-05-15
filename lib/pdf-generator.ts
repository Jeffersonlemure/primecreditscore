// PDF Generator for PrimeCreditScore
// Generates professional PDFs matching Serasa Concentre layout

import { jsPDF } from 'jspdf'
import type {
  BasicaPFResult,
  BasicaPJResult,
  RatingPFResult,
  RatingPJResult,
  AnotacoesData,
  PefinDetalhe,
  ProtestoDetalhe,
  AcaoJudicialDetalhe,
  Participacao,
} from './types'
import { SERASA_LOGO_BASE64 } from './logoBase64'

const COLORS = {
  primary:   [26, 86, 219]   as [number, number, number],
  dark:      [17, 24, 39]    as [number, number, number],
  gray:      [107, 114, 128] as [number, number, number],
  lightGray: [243, 244, 246] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  success:   [34, 197, 94]   as [number, number, number],
  warning:   [234, 179, 8]   as [number, number, number],
  danger:    [239, 68, 68]   as [number, number, number],
  orange:    [183, 121, 80]  as [number, number, number],
  // Gauge PJ 4-band colors
  gaugeGreen:  [34, 139, 34]  as [number, number, number],
  gaugeYellow: [234, 179, 8]  as [number, number, number],
  gaugeOrange: [230, 100, 20] as [number, number, number],
  gaugeRed:    [200, 30, 30]  as [number, number, number],
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatCPF(cpf: string): string {
  const c = (cpf || '').replace(/\D/g, '')
  if (c.length !== 11) return cpf || '-'
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatCNPJ(cnpj: string): string {
  const c = (cnpj || '').replace(/\D/g, '')
  if (c.length !== 14) return cnpj || '-'
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function formatCurrencyRange(min: number, max: number): string {
  return `${formatCurrency(min)} a ${formatCurrency(max)}`
}

// ─── PDF Base Helpers ─────────────────────────────────────────────────────────

function createPDF(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
}

function drawHeader(doc: jsPDF, title: string) {
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
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
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

function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number, title: string): number {
  if (currentY + requiredSpace > 277) {
    doc.addPage()
    drawHeader(doc, title)
    return 62
  }
  return currentY
}

// ─── Score Gauge (PF - 3 segment) ────────────────────────────────────────────

function drawScoreGaugePF(doc: jsPDF, score: number, chancePagamento: number, cx: number, startY: number, r = 18): number {
  const gaugeW = r * 2 + 24
  const gaugeH = r + 20

  doc.setFillColor(248, 249, 250)
  doc.roundedRect(cx - gaugeW / 2, startY, gaugeW, gaugeH, 3, 3, 'F')

  const cy = startY + r + 8

  const drawArc = (startVal: number, endVal: number, color: [number, number, number]) => {
    const a1 = Math.PI + (startVal / 1000) * Math.PI
    const a2 = Math.PI + (endVal / 1000) * Math.PI
    const steps = 30
    const gap = 0.05
    const dA1 = a1 + (startVal === 0 ? 0 : gap)
    const dA2 = a2 - (endVal === 1000 ? 0 : gap)
    if (dA2 <= dA1) return
    const p0x = cx + r * Math.cos(dA1)
    const p0y = cy + r * Math.sin(dA1)
    let prevX = p0x
    let prevY = p0y
    const lines: number[][] = []
    for (let i = 1; i <= steps; i++) {
      const a = dA1 + (i / steps) * (dA2 - dA1)
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
    doc.lines(lines as [number, number][], p0x, p0y, [1, 1], 'S')
  }

  const gray: [number, number, number] = [210, 210, 210]
  drawArc(0,   300,  score >= 1   ? COLORS.danger   : gray)
  drawArc(300, 700,  score >= 300 ? COLORS.warning  : gray)
  drawArc(700, 1000, score >= 700 ? COLORS.success  : gray)

  // Score number
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(String(score), cx, cy + 1, { align: 'center' })

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('de 1000', cx, cy + 6, { align: 'center' })

  // "XX% Chance de Pagamento"
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(`${chancePagamento.toFixed(1)}% Chance de Pagamento`, cx, startY + gaugeH - 2, { align: 'center' })

  // @ts-ignore
  doc.setLineCap(0)
  doc.setTextColor(...COLORS.dark)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)

  return startY + gaugeH + 5
}

// ─── Score Gauge (PJ - 4 segment) ────────────────────────────────────────────

function drawScoreGaugePJ(doc: jsPDF, score: number, _risco: string, cx: number, startY: number, r = 18): number {
  const isDefault = score === 0
  const gaugeW = r * 2 + 24
  const gaugeH = r + 30

  doc.setFillColor(248, 249, 250)
  doc.roundedRect(cx - gaugeW / 2, startY, gaugeW, gaugeH, 3, 3, 'F')

  const cy = startY + r + 8

  const drawArc = (startVal: number, endVal: number, color: [number, number, number]) => {
    const a1 = Math.PI + (startVal / 1000) * Math.PI
    const a2 = Math.PI + (endVal / 1000) * Math.PI
    const steps = 30
    const gap = 0.05
    const dA1 = a1 + (startVal === 0 ? 0 : gap)
    const dA2 = a2 - (endVal === 1000 ? 0 : gap)
    if (dA2 <= dA1) return
    const p0x = cx + r * Math.cos(dA1)
    const p0y = cy + r * Math.sin(dA1)
    let prevX = p0x
    let prevY = p0y
    const lines: number[][] = []
    for (let i = 1; i <= steps; i++) {
      const a = dA1 + (i / steps) * (dA2 - dA1)
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
    doc.lines(lines as [number, number][], p0x, p0y, [1, 1], 'S')
  }

  if (isDefault) {
    drawArc(0, 1000, COLORS.gaugeRed)
  } else {
    // 4 bands: 0-200 verde mínimo, 200-500 amarelo baixo, 500-750 laranja médio, 750-1000 vermelho iminente
    drawArc(0,    200,  score >= 1   ? COLORS.gaugeGreen  : [210, 210, 210])
    drawArc(200,  500,  score >= 200 ? COLORS.gaugeYellow : [210, 210, 210])
    drawArc(500,  750,  score >= 500 ? COLORS.gaugeOrange : [210, 210, 210])
    drawArc(750, 1000,  score >= 750 ? COLORS.gaugeRed    : [210, 210, 210])
  }

  // Score number or "Default"
  doc.setFontSize(isDefault ? 10 : 14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(isDefault ? 'Default' : String(score), cx, cy + 1, { align: 'center' })

  if (!isDefault) {
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text('de 1000', cx, cy + 6, { align: 'center' })
  }

  // Legend (2 rows × 2 items)
  const legendY = startY + gaugeH - 16
  const legendX = cx - gaugeW / 2 + 2
  const halfW = gaugeW / 2
  const bands = [
    { color: COLORS.gaugeGreen,  label: 'Verde: Mínimo' },
    { color: COLORS.gaugeYellow, label: 'Amarelo: Baixo' },
    { color: COLORS.gaugeOrange, label: 'Laranja: Médio' },
    { color: COLORS.gaugeRed,    label: 'Vermelho: Default' },
  ]
  bands.forEach((band, idx) => {
    const row = Math.floor(idx / 2)
    const col = idx % 2
    const bx = legendX + col * halfW
    const by = legendY + row * 7
    doc.setFillColor(...band.color)
    doc.rect(bx, by, 3.5, 3.5, 'F')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.gray)
    doc.setFont('helvetica', 'normal')
    doc.text(band.label, bx + 5, by + 3)
  })

  // @ts-ignore
  doc.setLineCap(0)
  doc.setTextColor(...COLORS.dark)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)

  return startY + gaugeH + 5
}

// ─── Anotações Resumo Table (9 rows) ─────────────────────────────────────────

function drawAnotacoesResumo(doc: jsPDF, anotacoes: AnotacoesData, y: number, title: string): number {
  const pageW = doc.internal.pageSize.getWidth()
  const colWidths = [68, 18, 38, 28, 28]  // Tipo | Qtd | Período | Valor | Mais Recente
  const headers = ['Tipo de Anotação', 'Qtd', 'Período', 'Valor (R$)', 'Mais Recente']
  const startX = 14

  // Header row
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(startX, y, pageW - 28, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.rect(startX, y, pageW - 28, 7, 'S')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)

  let xPos = startX + 2
  headers.forEach((h, idx) => {
    if (idx === 0) {
      doc.text(h, xPos, y + 5)
    } else if (idx === 3 || idx === 2) {
      doc.text(h, xPos + colWidths[idx] - 2, y + 5, { align: 'right' })
    } else {
      doc.text(h, xPos, y + 5)
    }
    xPos += colWidths[idx]
  })
  y += 7

  anotacoes.resumo.forEach((row, i) => {
    y = checkPageBreak(doc, y, 7, title)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(startX, y, pageW - 28, 6.5, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)

    const hasData = row.quantidade > 0
    let cx = startX + 2

    // Tipo
    doc.text(row.tipo, cx, y + 4.5)
    cx += colWidths[0]

    // Quantidade
    if (hasData) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.danger)
      doc.text(String(row.quantidade), cx, y + 4.5)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.success)
      doc.text('NADA CONSTA', cx, y + 4.5)
    }
    cx += colWidths[1]

    // Período
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(hasData ? row.periodo : '-', cx + colWidths[2] - 2, y + 4.5, { align: 'right' })
    cx += colWidths[2]

    // Valor
    if (hasData) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.danger)
      doc.text(formatCurrency(row.valor), cx + colWidths[3] - 2, y + 4.5, { align: 'right' })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.gray)
      doc.text('-', cx + colWidths[3] - 2, y + 4.5, { align: 'right' })
    }
    cx += colWidths[3]

    // Mais Recente
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(hasData ? row.maisRecente : '-', cx, y + 4.5)

    y += 6.5
  })

  doc.setTextColor(...COLORS.dark)
  return y + 4
}

// ─── PEFIN / REFIN Detail Table ───────────────────────────────────────────────

function drawPefinTable(doc: jsPDF, items: PefinDetalhe[], sectionLabel: string, y: number, title: string): number {
  if (!items.length) return y

  const pageW = doc.internal.pageSize.getWidth()

  y = checkPageBreak(doc, y, 16, title)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.orange)
  doc.text(`Detalhe ${sectionLabel}`, 14, y + 5)
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y + 7, pageW - 14, y + 7)
  y += 12

  // Header
  const headers = ['Contrato', 'Modalidade', 'Empresa', 'Data', 'Valor', 'Avalista']
  const colW =    [20,         32,            60,         18,    22,      28]
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, y, pageW - 28, 7, 'S')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  let xh = 16
  headers.forEach((h, idx) => {
    doc.text(h, xh, y + 5)
    xh += colW[idx]
  })
  y += 7

  items.forEach((item, i) => {
    y = checkPageBreak(doc, y, 7, title)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, pageW - 28, 6.5, 'F')
    }
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    let xc = 16
    const vals = [
      item.contrato.substring(0, 10),
      item.modalidade.substring(0, 18),
      item.empresa.substring(0, 30),
      item.data,
      formatCurrency(item.valor),
      item.avalista.substring(0, 14),
    ]
    vals.forEach((v, idx) => {
      if (idx === 4) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.danger)
      }
      doc.text(v, xc, y + 4.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      xc += colW[idx]
    })
    y += 6.5
  })

  return y + 4
}

// ─── Protestos Detail Table ───────────────────────────────────────────────────

function drawProtestosTable(doc: jsPDF, items: ProtestoDetalhe[], y: number, title: string): number {
  if (!items.length) return y

  const pageW = doc.internal.pageSize.getWidth()

  y = checkPageBreak(doc, y, 16, title)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.orange)
  doc.text('Detalhe Protestos', 14, y + 5)
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y + 7, pageW - 14, y + 7)
  y += 12

  const headers = ['Cartório', 'Cidade', 'UF', 'Data', 'Valor']
  const colW =    [28,         60,        15,   22,     55]
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, y, pageW - 28, 7, 'S')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  let xh = 16
  headers.forEach((h, idx) => {
    doc.text(h, xh, y + 5)
    xh += colW[idx]
  })
  y += 7

  items.forEach((item, i) => {
    y = checkPageBreak(doc, y, 7, title)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, pageW - 28, 6.5, 'F')
    }
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    let xc = 16
    const vals = [item.cartorio, item.cidade.substring(0, 30), item.uf, item.data, formatCurrency(item.valor)]
    vals.forEach((v, idx) => {
      if (idx === 4) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.danger) }
      doc.text(v, xc, y + 4.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      xc += colW[idx]
    })
    y += 6.5
  })

  return y + 4
}

// ─── Ações Judiciais Detail Table ─────────────────────────────────────────────

function drawAcoesJudiciaisTable(doc: jsPDF, items: AcaoJudicialDetalhe[], y: number, title: string): number {
  if (!items.length) return y

  const pageW = doc.internal.pageSize.getWidth()

  y = checkPageBreak(doc, y, 16, title)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.orange)
  doc.text('Detalhe Ações Judiciais', 14, y + 5)
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y + 7, pageW - 14, y + 7)
  y += 12

  const headers = ['Natureza', 'Distr', 'Vara', 'Cidade', 'UF', 'Data', 'Valor']
  const colW =    [40,          12,      12,     42,        12,   18,     42]
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, y, pageW - 28, 7, 'S')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  let xh = 16
  headers.forEach((h, idx) => {
    doc.text(h, xh, y + 5)
    xh += colW[idx]
  })
  y += 7

  items.forEach((item, i) => {
    y = checkPageBreak(doc, y, 7, title)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, pageW - 28, 6.5, 'F')
    }
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    let xc = 16
    const vals = [
      item.natureza.substring(0, 20),
      item.distribuidor.substring(0, 6),
      item.vara.substring(0, 6),
      item.cidade.substring(0, 22),
      item.uf,
      item.data,
      formatCurrency(item.valor),
    ]
    vals.forEach((v, idx) => {
      if (idx === 6) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.danger) }
      doc.text(v, xc, y + 4.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      xc += colW[idx]
    })
    y += 6.5
  })

  return y + 4
}

// ─── Participações Table (PF) ─────────────────────────────────────────────────

function drawParticipacoes(doc: jsPDF, participacoes: Participacao[], y: number, title: string): number {
  const pageW = doc.internal.pageSize.getWidth()

  if (!participacoes.length) {
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.gray)
    doc.text('Nenhuma participação societária encontrada.', 14, y + 5)
    doc.setTextColor(...COLORS.dark)
    return y + 10
  }

  // Header
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, y, pageW - 28, 7, 'S')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Empresa', 17, y + 5)
  doc.text('CNPJ', 90, y + 5)
  doc.text('Part.(%)', 132, y + 5)
  doc.text('UF', 155, y + 5)
  y += 7

  participacoes.forEach((emp, i) => {
    y = checkPageBreak(doc, y, 14, title)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, pageW - 28, 13, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(emp.razaoSocial.substring(0, 38), 17, y + 4.5)
    doc.text(formatCNPJ(emp.cnpj), 90, y + 4.5)
    doc.text(emp.participacao, 132, y + 4.5)
    doc.text(emp.uf, 155, y + 4.5)

    // Status line below
    doc.setFontSize(6)
    doc.setTextColor(...COLORS.gray)
    const statusLine = `${emp.statusCnpj !== '-' ? emp.statusCnpj : ''}${emp.desde !== '-' ? ` | Desde: ${emp.desde}` : ''}${emp.ultimaAtualizacao !== '-' ? ` | Últ. Atualiz.: ${emp.ultimaAtualizacao}` : ''}`
    doc.text(statusLine.trim() || '-', 17, y + 9.5)
    doc.setTextColor(...COLORS.dark)

    y += 13
  })

  return y + 4
}

// ─── Sócios e Administradores (PJ) ────────────────────────────────────────────

function drawSociosAdmin(
  doc: jsPDF,
  socios: Array<{ documento: string; nome: string; participacao: string }>,
  administradores: Array<{ documento: string; nome: string; cargo: string }>,
  y: number,
  title: string
): number {
  const pageW = doc.internal.pageSize.getWidth()

  // Sócios e Acionistas
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Sócios e Acionistas', 14, y + 4)
  y += 7

  if (!socios.length) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text('Nenhum sócio/acionista encontrado.', 14, y + 4)
    doc.setTextColor(...COLORS.dark)
    y += 10
  } else {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(14, y, pageW - 28, 7, 'S')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text('CPF/CNPJ', 17, y + 5)
    doc.text('Nome', 65, y + 5)
    doc.text('% Capital', pageW - 17, y + 5, { align: 'right' })
    y += 7

    socios.forEach((s, i) => {
      y = checkPageBreak(doc, y, 7, title)
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, pageW - 28, 6.5, 'F')
      }
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text(s.documento.length === 11 ? formatCPF(s.documento) : formatCNPJ(s.documento), 17, y + 4.5)
      doc.text(s.nome.substring(0, 55), 65, y + 4.5)
      doc.text(s.participacao, pageW - 17, y + 4.5, { align: 'right' })
      y += 6.5
    })
    y += 4
  }

  // Administradores
  y = checkPageBreak(doc, y, 16, title)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Administradores', 14, y + 4)
  y += 7

  if (!administradores.length) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text('Nenhum administrador encontrado.', 14, y + 4)
    doc.setTextColor(...COLORS.dark)
    y += 10
  } else {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(14, y, pageW - 28, 7, 'S')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text('CPF/CNPJ', 17, y + 5)
    doc.text('Nome', 65, y + 5)
    doc.text('Cargo', pageW - 17, y + 5, { align: 'right' })
    y += 7

    administradores.forEach((a, i) => {
      y = checkPageBreak(doc, y, 7, title)
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, pageW - 28, 6.5, 'F')
      }
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text(a.documento.length === 11 ? formatCPF(a.documento) : formatCNPJ(a.documento), 17, y + 4.5)
      doc.text(a.nome.substring(0, 55), 65, y + 4.5)
      doc.text(a.cargo.substring(0, 25), pageW - 17, y + 4.5, { align: 'right' })
      y += 6.5
    })
    y += 4
  }

  return y
}

// ─── PDF: Básica PF ───────────────────────────────────────────────────────────

export async function generateBasicaPFPdf(data: BasicaPFResult): Promise<Uint8Array> {
  const TITLE = 'CONSULTA BÁSICA PF'
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()
  drawHeader(doc, TITLE)
  let y = 62

  // 1. Identificação
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '1. Identificação', y)
  const id = data.identificacao

  // Row 1: Nome (left) + CPF label + value (right)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Nome', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.nome || '-').substring(0, 55), 30, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  const cpfValue = formatCPF(id.cpf)
  const cpfValueW = doc.getTextWidth(cpfValue)
  doc.text('CPF: ', pageW - 14 - cpfValueW, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(cpfValue, pageW - 14, y, { align: 'right' })
  y += 5.5

  // Row 2: Data de Nascimento (left) + Nome da Mãe (right side)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Data de Nascimento:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(id.dataNascimento || '-', 54, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Nome da Mãe:', 110, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.nomeMae || '-').substring(0, 35), 134, y)
  y += 5.5

  // Row 3: Situação do CPF
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('Situação do CPF:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(id.situacaoCpf || 'REGULAR', 48, y)
  y += 7

  // 2. Anotações Negativas - Resumo
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '2. Anotações Negativas — Resumo', y)
  y = drawAnotacoesResumo(doc, data.anotacoes, y, TITLE)

  // Detail tables (only when data exists)
  if (data.anotacoes.pefin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.pefin, 'PEFIN', y, TITLE)
  }
  if (data.anotacoes.refin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.refin, 'REFIN', y, TITLE)
  }
  if (data.anotacoes.protestos.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawProtestosTable(doc, data.anotacoes.protestos, y, TITLE)
  }
  if (data.anotacoes.acoesJudiciais.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawAcoesJudiciaisTable(doc, data.anotacoes.acoesJudiciais, y, TITLE)
  }
  y += 4

  // 3. Participação Societária
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '3. Participação Societária', y)
  y = drawParticipacoes(doc, data.participacoes, y, TITLE)

  // 4. Serasa Score com Positivo
  y = checkPageBreak(doc, y, 55, TITLE)
  y = drawSectionTitle(doc, '4. Serasa Score com Positivo', y)
  y = drawScoreGaugePF(doc, data.score.pontuacao, data.score.chancePagamento, pageW / 2, y)

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Básica PJ ───────────────────────────────────────────────────────────

export async function generateBasicaPJPdf(data: BasicaPJResult): Promise<Uint8Array> {
  const TITLE = 'CONSULTA BÁSICA PJ'
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()
  drawHeader(doc, TITLE)
  let y = 62

  // 1. Identificação
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '1. Identificação', y)
  const id = data.identificacao

  // Row 1: Razão Social (left) + CNPJ label + value (right)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Razão Social:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.razaoSocial || '-').substring(0, 55), 42, y)
  const cnpjValue = formatCNPJ(id.cnpj)
  const cnpjValueW = doc.getTextWidth(cnpjValue)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('CNPJ: ', pageW - 14 - cnpjValueW, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(cnpjValue, pageW - 14, y, { align: 'right' })
  y += 5.5

  // Row 2: Data de Fundação (left) + UF/Município (right side)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Data de Fundação:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(id.dataFundacao || '-', 50, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('UF / Município:', 110, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(`${id.uf || '-'} / ${id.municipio || '-'}`, 138, y)
  y += 5.5

  // Row 3: Situação do CNPJ
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('Situação do CNPJ:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(id.situacaoCnpj || 'ATIVA', 50, y)
  y += 7

  // 2. Anotações Negativas - Resumo
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '2. Anotações Negativas — Resumo', y)
  y = drawAnotacoesResumo(doc, data.anotacoes, y, TITLE)

  if (data.anotacoes.pefin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.pefin, 'PEFIN', y, TITLE)
  }
  if (data.anotacoes.protestos.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawProtestosTable(doc, data.anotacoes.protestos, y, TITLE)
  }
  if (data.anotacoes.acoesJudiciais.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawAcoesJudiciaisTable(doc, data.anotacoes.acoesJudiciais, y, TITLE)
  }
  y += 4

  // 3. Faturamento Estimado com Positivo
  y = checkPageBreak(doc, y, 16, TITLE)
  y = drawSectionTitle(doc, '3. Faturamento Estimado com Positivo', y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(
    data.faturamento > 0 ? `${formatCurrency(data.faturamento)} ao ano` : '-',
    14, y + 5
  )
  y += 14

  // 4. Serasa Score 2.0
  y = checkPageBreak(doc, y, 65, TITLE)
  y = drawSectionTitle(doc, '4. Serasa Score 2.0', y)
  y = drawScoreGaugePJ(doc, data.score.pontuacao, data.score.risco, pageW / 2, y)

  // 5. Sócios e Administradores
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '5. Sócios e Administradores', y)
  y = drawSociosAdmin(doc, data.socios, data.administradores, y, TITLE)

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Rating PF ───────────────────────────────────────────────────────────

export async function generateRatingPFPdf(data: RatingPFResult): Promise<Uint8Array> {
  const TITLE = 'CONSULTA RATING PF'
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()
  drawHeader(doc, TITLE)
  let y = 62

  // 1. Identificação
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '1. Identificação', y)
  const id = data.identificacao

  // Row 1: Nome (left) + CPF label + value (right)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Nome', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.nome || '-').substring(0, 55), 30, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  const cpfValue = formatCPF(id.cpf)
  const cpfValueW = doc.getTextWidth(cpfValue)
  doc.text('CPF: ', pageW - 14 - cpfValueW, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(cpfValue, pageW - 14, y, { align: 'right' })
  y += 5.5

  // Row 2: Data de Nascimento (left) + Nome da Mãe (right side)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Data de Nascimento:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(id.dataNascimento || '-', 54, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Nome da Mãe:', 110, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.nomeMae || '-').substring(0, 35), 134, y)
  y += 5.5

  // Row 3: Situação do CPF
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('Situação do CPF:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(id.situacaoCpf || 'REGULAR', 48, y)
  y += 7

  // 2. Anotações Negativas - Resumo
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '2. Anotações Negativas — Resumo', y)
  y = drawAnotacoesResumo(doc, data.anotacoes, y, TITLE)

  if (data.anotacoes.pefin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.pefin, 'PEFIN', y, TITLE)
  }
  if (data.anotacoes.refin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.refin, 'REFIN', y, TITLE)
  }
  if (data.anotacoes.protestos.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawProtestosTable(doc, data.anotacoes.protestos, y, TITLE)
  }
  if (data.anotacoes.acoesJudiciais.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawAcoesJudiciaisTable(doc, data.anotacoes.acoesJudiciais, y, TITLE)
  }
  y += 4

  // 3. Participação Societária
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '3. Participação Societária', y)
  y = drawParticipacoes(doc, data.participacoes, y, TITLE)

  // 4. Serasa Score com Positivo
  y = checkPageBreak(doc, y, 55, TITLE)
  y = drawSectionTitle(doc, '4. Serasa Score com Positivo', y)
  y = drawScoreGaugePF(doc, data.score.pontuacao, data.score.chancePagamento, pageW / 2, y)

  // 5. Capacidade de Pagamento
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '5. Capacidade de Pagamento', y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  const capMin = data.capacidadePagamento.min
  const capMax = data.capacidadePagamento.max
  const capText = (capMin === 0 && capMax === 0)
    ? '-'
    : capMin === capMax
      ? formatCurrency(capMin)
      : formatCurrencyRange(capMin, capMax)
  doc.text(capText, 14, y + 5)
  y += 14

  // 6. Renda Estimada
  y = checkPageBreak(doc, y, 16, TITLE)
  y = drawSectionTitle(doc, '6. Renda Estimada', y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  const rendaMin = data.renda.min
  const rendaMax = data.renda.max
  const rendaText = (rendaMin === 0 && rendaMax === 0)
    ? '-'
    : rendaMin === rendaMax
      ? formatCurrency(rendaMin)
      : formatCurrencyRange(rendaMin, rendaMax)
  doc.text(rendaText, 14, y + 5)
  y += 14

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ─── PDF: Rating PJ ───────────────────────────────────────────────────────────

export async function generateRatingPJPdf(data: RatingPJResult): Promise<Uint8Array> {
  const TITLE = 'CONSULTA RATING PJ'
  const doc = createPDF()
  const pageW = doc.internal.pageSize.getWidth()
  drawHeader(doc, TITLE)
  let y = 62

  // 1. Identificação
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '1. Identificação', y)
  const id = data.identificacao

  // Row 1: Razão Social (left) + CNPJ label + value (right)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Razão Social:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text((id.razaoSocial || '-').substring(0, 55), 42, y)
  const cnpjValue = formatCNPJ(id.cnpj)
  const cnpjValueW = doc.getTextWidth(cnpjValue)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('CNPJ: ', pageW - 14 - cnpjValueW, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(cnpjValue, pageW - 14, y, { align: 'right' })
  y += 5.5

  // Row 2: Data de Fundação (left) + UF/Município (right side)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('Data de Fundação:', 14, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(id.dataFundacao || '-', 50, y)
  doc.setTextColor(...COLORS.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('UF / Município:', 110, y)
  doc.setTextColor(...COLORS.dark)
  doc.setFont('helvetica', 'bold')
  doc.text(`${id.uf || '-'} / ${id.municipio || '-'}`, 138, y)
  y += 5.5

  // Row 3: Situação do CNPJ
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text('Situação do CNPJ:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(id.situacaoCnpj || 'ATIVA', 50, y)
  y += 7

  // 2. Anotações Negativas - Resumo
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '2. Anotações Negativas — Resumo', y)
  y = drawAnotacoesResumo(doc, data.anotacoes, y, TITLE)

  if (data.anotacoes.pefin.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawPefinTable(doc, data.anotacoes.pefin, 'PEFIN', y, TITLE)
  }
  if (data.anotacoes.protestos.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawProtestosTable(doc, data.anotacoes.protestos, y, TITLE)
  }
  if (data.anotacoes.acoesJudiciais.length) {
    y = checkPageBreak(doc, y, 14, TITLE)
    y = drawAcoesJudiciaisTable(doc, data.anotacoes.acoesJudiciais, y, TITLE)
  }
  y += 4

  // 3. Faturamento Estimado com Positivo
  y = checkPageBreak(doc, y, 16, TITLE)
  y = drawSectionTitle(doc, '3. Faturamento Estimado com Positivo', y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(
    data.faturamento > 0 ? `${formatCurrency(data.faturamento)} ao ano` : '-',
    14, y + 5
  )
  y += 14

  // 4. Score — Rating PJ (table-style)
  y = checkPageBreak(doc, y, 40, TITLE)
  y = drawSectionTitle(doc, '4. Pontuação de Risco', y)

  const scoreRows: Array<[string, string]> = [
    ['Pontuação', data.score.pontuacao === 0 ? 'Default' : String(data.score.pontuacao)],
    ['Prob. Inadimplência', `${data.score.probabilidadeInadimplencia.toFixed(2)}%`],
    ['Risco de Crédito', data.score.risco],
    ['Práticas de Mercado', data.score.praticasMercado],
  ]

  const scoreTableW = pageW - 28
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, scoreTableW, 7, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, y, scoreTableW, 7, 'S')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Campo', 17, y + 5)
  doc.text('Valor', 100, y + 5)
  y += 7

  scoreRows.forEach((row, i) => {
    y = checkPageBreak(doc, y, 7, TITLE)
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, scoreTableW, 6.5, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text(row[0], 17, y + 4.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(row[1], 100, y + 4.5)
    y += 6.5
  })

  // Interpretação (multi-line)
  if (data.score.interpretacao && data.score.interpretacao !== '-') {
    y = checkPageBreak(doc, y, 14, TITLE)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.gray)
    const lines = doc.splitTextToSize(`Interpretação: ${data.score.interpretacao}`, scoreTableW - 4)
    doc.text(lines, 17, y + 4)
    y += lines.length * 4 + 4
  }

  y += 4

  // 5. Limite de Crédito
  y = checkPageBreak(doc, y, 16, TITLE)
  y = drawSectionTitle(doc, '5. Limite de Crédito', y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(
    data.limiteCredito > 0 ? formatCurrency(data.limiteCredito) : '-',
    14, y + 5
  )
  y += 14

  // 6. Sócios e Administradores
  y = checkPageBreak(doc, y, 20, TITLE)
  y = drawSectionTitle(doc, '6. Sócios e Administradores', y)
  y = drawSociosAdmin(doc, data.socios, data.administradores, y, TITLE)

  drawFooter(doc)
  return doc.output('arraybuffer') as unknown as Uint8Array
}
