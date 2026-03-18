'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import type { Consultation } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  basica_pf: 'Básica PF', basica_pj: 'Básica PJ',
  rating_pf: 'Rating PF', rating_pj: 'Rating PJ'
}

export default function HistoricoPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('consultations')
      .select('*, consultation_types(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setConsultations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter
    ? consultations.filter(c =>
        c.document.includes(filter.replace(/\D/g, '')) ||
        (c.consultation_type as unknown as { code: string })?.code?.includes(filter.toLowerCase()) ||
        (c.consultation_type as unknown as { name: string })?.name?.toLowerCase().includes(filter.toLowerCase())
      )
    : consultations

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
    </div>
  )

  return (
    <div>
      {/* Search */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" className="form-input" style={{ border: 'none', padding: '4px 0', fontSize: 15 }}
              placeholder="Filtrar por documento ou tipo..."
              value={filter} onChange={e => setFilter(e.target.value)}
            />
            <span style={{ color: 'var(--gray-400)', fontSize: 13, whiteSpace: 'nowrap' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div className="empty-state-title">Nenhuma consulta encontrada</div>
              <div className="empty-state-desc">Suas consultas de crédito aparecerão aqui.</div>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Créditos</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const typeCode = (c.consultation_type as unknown as { code: string })?.code || ''
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const score = (c.result_data as any)?.score?.pontuacao
                    const scoreColor = score >= 700 ? 'var(--score-excellent)' : score >= 500 ? 'var(--score-good)' : score >= 300 ? 'var(--score-regular)' : 'var(--score-low)'
                    return (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{filtered.length - idx}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{c.document}</td>
                        <td><span className="badge badge-info">{TYPE_LABELS[typeCode] || typeCode}</span></td>
                        <td>
                          {score ? (
                            <span style={{ fontWeight: 700, color: scoreColor, fontSize: 15 }}>{score}</span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                            {c.status === 'success' ? 'Sucesso' : 'Erro'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>-{c.credits_used}</td>
                        <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                          {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td>
                          {c.status === 'success' && (
                            <a href={`/api/pdf/generate?id=${c.id}`} target="_blank" rel="noreferrer"
                              className="btn btn-ghost btn-sm" title="Baixar PDF">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                              PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
