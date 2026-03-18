'use client'
import { useState, useCallback } from 'react'

const TYPES = [
  { code: 'basica_pf', name: 'Básica PF', docType: 'CPF', costText: '1 Básica ou 10 Créd.', desc: 'Identificação, Status, Anotações, Score, Participações' },
  { code: 'basica_pj', name: 'Básica PJ', docType: 'CNPJ', costText: '1 Básica ou 10 Créd.', desc: 'Identificação, Status, Anotações, Detalhamento societário' },
  { code: 'rating_pf', name: 'Rating PF', docType: 'CPF', costText: '1 Rating ou 50 Créd.', desc: 'Básica PF + Renda + Capacidade de Pagamento' },
  { code: 'rating_pj', name: 'Rating PJ', docType: 'CNPJ', costText: '1 Rating ou 50 Créd.', desc: 'Identificação, Score, Risco, Faturamento, Limite, Sócios' },
]

function formatDocument(value: string, type: 'CPF' | 'CNPJ') {
  const d = value.replace(/\D/g, '')
  if (type === 'CPF') return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14)
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').slice(0, 18)
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => s >= 700 ? 'var(--score-excellent)' : s >= 500 ? 'var(--score-good)' : s >= 300 ? 'var(--score-regular)' : 'var(--score-low)'
  const getLabel = (s: number) => s >= 700 ? 'EXCELENTE' : s >= 500 ? 'BOM' : s >= 300 ? 'REGULAR' : 'BAIXO'

  // Semicircle gauge using SVG
  const pct = Math.max(0, Math.min(score / 1000, 1))
  const startAngle = Math.PI
  const endAngle = Math.PI + pct * Math.PI
  const r = 60
  const cx = 90
  const cy = 75
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = pct > 0.5 ? 1 : 0
  const color = getColor(score)

  return (
    <div className="gauge-container">
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* BG track */}
        <path d={`M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy}`} fill="none" stroke="var(--gray-200)" strokeWidth="14" strokeLinecap="round" />
        {/* Segments */}
        {[
          { from: 0, to: 0.3, color: 'var(--score-low)' },
          { from: 0.3, to: 0.5, color: 'var(--score-regular)' },
          { from: 0.5, to: 0.7, color: 'var(--score-good)' },
          { from: 0.7, to: 1.0, color: 'var(--score-excellent)' },
        ].map((seg, i) => {
          const a1 = Math.PI + seg.from * Math.PI
          const a2 = Math.PI + seg.to * Math.PI
          const sx = cx + r * Math.cos(a1), sy = cy + r * Math.sin(a1)
          const ex = cx + r * Math.cos(a2), ey = cy + r * Math.sin(a2)
          const la = (seg.to - seg.from) > 0.5 ? 1 : 0
          return <path key={i} d={`M${sx},${sy} A${r},${r} 0 ${la},1 ${ex},${ey}`} fill="none" stroke={seg.color} strokeWidth="10" opacity="0.3" strokeLinecap="round" />
        })}
        {/* Active arc */}
        {pct > 0 && (
          <path d={`M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        )}
        {/* Needle dot */}
        <circle cx={x2} cy={y2} r="5" fill={color} />
      </svg>
      <div className="gauge-score" style={{ color, marginTop: -12 }}>{score}</div>
      <div className="gauge-max" style={{ fontSize: 12, color: 'var(--gray-400)' }}>de 1000</div>
      <div style={{ fontWeight: 700, color, fontSize: 14, marginTop: 4 }}>{getLabel(score)}</div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="result-section">
      <div className="result-section-header">
        <h3>{title}</h3>
      </div>
      <div className="result-section-body">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const display = value === true ? 'Sim' : value === false ? 'Não' : value ?? '—'
  return (
    <div className="result-field">
      <span className="result-field-label">{label}</span>
      <span className="result-field-value">{String(display)}</span>
    </div>
  )
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ConsultaResult({ data, consultationId }: { data: any; consultationId: string }) {
  const tipo = data?.tipo
  const score = data?.score?.pontuacao

  return (
    <div>
      {/* Download PDF Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
        <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
          ✅ Consulta realizada com sucesso
        </span>
        <a href={`/api/pdf/generate?id=${consultationId}`} target="_blank" rel="noreferrer"
          className="btn btn-primary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Baixar PDF
        </a>
      </div>

      {/* Score Gauge */}
      {score && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div className="card-header" style={{ justifyContent: 'center' }}>
            <div className="card-title">Score de Crédito</div>
          </div>
          <div className="card-body">
            <ScoreGauge score={score} />
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 8 }}>
              Percentil Brasil: {data?.score?.percentilBrasil}%
            </p>
          </div>
        </div>
      )}

      {/* Identificação */}
      {data?.identificacao && (
        <ResultSection title="Identificação">
          <div className="result-grid">
            {Object.entries(data.identificacao).map(([k, v]) => (
              <Field key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={v as string} />
            ))}
          </div>
        </ResultSection>
      )}

      {/* Status */}
      {data?.status && (
        <ResultSection title="Status">
          <div className="result-grid">
            {Object.entries(data.status).map(([k, v]) => (
              <Field key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={v as string} />
            ))}
          </div>
        </ResultSection>
      )}

      {/* Anotações */}
      {data?.anotacoes && (
        <ResultSection title="Anotações Negativas">
          {data.anotacoes.totalDividas === 0 ? (
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Nenhuma anotação negativa encontrada</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <Field label="Total" value={data.anotacoes.totalDividas} />
                <Field label="Valor Total" value={formatCurrency(data.anotacoes.valorTotal)} />
              </div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Credor</th><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead>
                  <tbody>
                    {data.anotacoes.itens.map((item: { credor: string; tipo: string; data: string; valor: number }, i: number) => (
                      <tr key={i}>
                        <td>{item.credor}</td>
                        <td><span className="badge badge-danger">{item.tipo}</span></td>
                        <td>{item.data}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatCurrency(item.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </ResultSection>
      )}

      {/* Renda (Rating PF) */}
      {data?.renda && (
        <ResultSection title="Informações de Renda">
          <div className="result-grid">
            <Field label="Renda Estimada" value={formatCurrency(data.renda.rendaEstimada)} />
            <Field label="Faixa de Renda" value={data.renda.faixaRenda} />
            <Field label="Fonte" value={data.renda.fonteRenda} />
          </div>
        </ResultSection>
      )}

      {/* Capacidade de Pagamento (Rating PF) */}
      {data?.capacidadePagamento && (
        <ResultSection title="Capacidade de Pagamento">
          <div className="result-grid">
            <Field label="Limite Recomendado" value={formatCurrency(data.capacidadePagamento.limiteRecomendado)} />
            <Field label="Comprometimento Renda" value={`${data.capacidadePagamento.comprometimentoRenda}%`} />
            <Field label="Prob. Inadimplência" value={`${data.capacidadePagamento.probabilidadeInadimplencia}%`} />
            <Field label="Classificação de Risco" value={data.capacidadePagamento.classificacaoRisco} />
          </div>
        </ResultSection>
      )}

      {/* Risco (Rating PJ) */}
      {data?.risco && (
        <ResultSection title="Classificação de Risco">
          <div className="result-grid">
            <Field label="Rating" value={data.risco.rating} />
            <Field label="Classificação" value={data.risco.classificacao} />
            <Field label="Prob. Inadimplência" value={`${data.risco.probabilidadeInadimplencia}%`} />
          </div>
        </ResultSection>
      )}

      {/* Faturamento (Rating PJ) */}
      {data?.faturamento && (
        <ResultSection title="Análise Financeira">
          <div className="result-grid">
            <Field label="Faturamento Anual" value={formatCurrency(data.faturamento.estimativaAnual)} />
            <Field label="Faixa" value={data.faturamento.faixa} />
            {data.limiteCredito && <>
              <Field label="Limite Recomendado" value={formatCurrency(data.limiteCredito.recomendado)} />
              <Field label="Em Uso" value={formatCurrency(data.limiteCredito.emUso)} />
              <Field label="Disponível" value={formatCurrency(data.limiteCredito.disponivel)} />
            </>}
          </div>
        </ResultSection>
      )}

      {/* Sócios */}
      {(data?.socios || data?.detalhamento?.socios) && (
        <ResultSection title="Quadro Societário">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Nome</th><th>CPF</th><th>Cargo</th><th>Participação</th>{data?.socios?.[0]?.scoreIndividual && <th>Score</th>}</tr></thead>
              <tbody>
                {(data?.socios || data?.detalhamento?.socios || []).map((s: { nome: string; cpf: string; cargo: string; participacao: string; scoreIndividual?: number }, i: number) => (
                  <tr key={i}>
                    <td>{s.nome}</td>
                    <td style={{ fontFamily: 'monospace' }}>{s.cpf}</td>
                    <td>{s.cargo}</td>
                    <td>{s.participacao}</td>
                    {s.scoreIndividual !== undefined && <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.scoreIndividual}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultSection>
      )}

      {/* Participações PF */}
      {data?.participacoes?.empresas?.length > 0 && (
        <ResultSection title="Participações Societárias">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Empresa</th><th>CNPJ</th><th>Vínculo</th></tr></thead>
              <tbody>
                {data.participacoes.empresas.map((e: { razaoSocial: string; cnpj: string; participacao: string }, i: number) => (
                  <tr key={i}><td>{e.razaoSocial}</td><td style={{ fontFamily: 'monospace' }}>{e.cnpj}</td><td>{e.participacao}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultSection>
      )}
    </div>
  )
}

export default function ConsultarPage() {
  const [selectedType, setSelectedType] = useState(TYPES[0])
  const [document, setDocument] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<{ data: any; consultationId: string } | null>(null)

  const handleDocChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDocument(formatDocument(e.target.value, selectedType.docType as 'CPF' | 'CNPJ'))
  }, [selectedType])

  async function handleConsult(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/consultas/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultationType: selectedType.code, document }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (res.status === 402) setError('Saldo insuficiente. Compre mais créditos para continuar.')
      else setError(json.error || 'Erro ao realizar consulta')
      return
    }

    setResult({ data: json.data, consultationId: json.consultationId })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Type Selection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Tipo de Consulta</div>
        </div>
        <div className="card-body">
          <div className="grid-4" style={{ gap: 12 }}>
            {TYPES.map(type => (
              <button
                key={type.code}
                onClick={() => { setSelectedType(type); setDocument(''); setResult(null); setError('') }}
                style={{
                  padding: '14px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: `2px solid ${selectedType.code === type.code ? 'var(--primary)' : 'var(--gray-200)'}`,
                  background: selectedType.code === type.code ? 'var(--primary-light)' : 'var(--white)',
                  textAlign: 'center', transition: 'all .2s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: selectedType.code === type.code ? 'var(--primary)' : 'var(--gray-800)', marginBottom: 4 }}>
                  {type.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4 }}>{type.desc}</div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                  Custo: {type.costText}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Informe o {selectedType.docType}</div>
            <div className="card-subtitle">{selectedType.name} — Custo: {selectedType.costText}</div>
          </div>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          <form onSubmit={handleConsult} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>{selectedType.docType}</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <input
                type="text" className="form-input" style={{ flex: 1, fontSize: 18, fontFamily: 'monospace', letterSpacing: 1 }}
                placeholder={selectedType.docType === 'CPF' ? '000.000.000-00' : '00.000.000/0001-00'}
                value={document} onChange={handleDocChange}
                maxLength={selectedType.docType === 'CPF' ? 14 : 18}
                required
              />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ minWidth: 180, margin: 0 }}>
                {loading ? <><span className="spinner" /> Consultando...</> : 'Consultar Agora'}
              </button>
            </div>
            <span className="form-hint" style={{ marginTop: 2 }}>CPF teste: 000.000.023-05 | CNPJ teste: 00.261.304/0001-02</span>
          </form>
        </div>
      </div>

      {/* Result */}
      {result && <ConsultaResult data={result.data} consultationId={result.consultationId} />}
    </div>
  )
}
