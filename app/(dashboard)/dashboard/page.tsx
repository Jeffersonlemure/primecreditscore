'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Profile, Consultation } from '@/lib/types'

const CONSULTATION_LABELS: Record<string, string> = {
  basica_pf: 'Básica PF', basica_pj: 'Básica PJ',
  rating_pf: 'Rating PF', rating_pj: 'Rating PJ'
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, spent: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, consultRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('consultations').select('*, consultation_types(*)').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(5),
    ])

    setProfile(profileRes.data)

    const all = consultRes.data || []
    setConsultations(all)

    const now = new Date()
    const thisMonth = all.filter(c => new Date(c.created_at).getMonth() === now.getMonth()).length
    const totalSpent = all.reduce((s, c) => s + (c.credits_used || 0), 0)
    setStats({ total: all.length, thisMonth, spent: totalSpent })

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
    </div>
  )

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' }}>
          Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋
        </h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{profile?.credits_balance || 0}</div>
            <div className="stat-label">Créditos Disponíveis</div>
          </div>
          <div className="stat-card-icon bg-blue-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total de Consultas</div>
          </div>
          <div className="stat-card-icon bg-purple-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">Este Mês</div>
          </div>
          <div className="stat-card-icon bg-green-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-value">{stats.spent}</div>
            <div className="stat-label">Créditos Usados</div>
          </div>
          <div className="stat-card-icon bg-orange-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* New Consultation CTA */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%)',
          borderRadius: 'var(--radius-lg)', padding: 28, color: 'white',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 160,
        }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Consulta rápida
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Nova Consulta</h3>
            <p style={{ fontSize: 13, opacity: 0.8 }}>CPF ou CNPJ em segundos com score e anotações</p>
          </div>
          <Link href="/dashboard/consultar" className="btn" style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            marginTop: 16, alignSelf: 'flex-start', backdropFilter: 'blur(10px)'
          }}>
            Fazer Consulta →
          </Link>
        </div>

        {/* Buy Credits CTA */}
        <div style={{
          background: 'var(--white)', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-lg)', padding: 28,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 160,
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Saldo
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
              {profile?.credits_balance || 0}
            </div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>créditos disponíveis</div>
          </div>
          <Link href="/dashboard/creditos" className="btn btn-primary" style={{ marginTop: 16, alignSelf: 'flex-start' }}>
            Comprar Créditos
          </Link>
        </div>
      </div>

      {/* Recent Consultations */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Consultas Recentes</div>
            <div className="card-subtitle">Suas últimas atividades</div>
          </div>
          <Link href="/dashboard/historico" className="btn btn-ghost btn-sm">Ver tudo →</Link>
        </div>
        <div className="card-body p-0">
          {consultations.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div className="empty-state-title">Nenhuma consulta ainda</div>
              <div className="empty-state-desc">Faça sua primeira consulta de crédito agora mesmo.</div>
              <Link href="/dashboard/consultar" className="btn btn-primary">Fazer Consulta</Link>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Score</th>
                    <th>Créditos</th>
                    <th>Data</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {consultations.map(c => {
                    const typeCode = (c.consultation_type as unknown as { code: string })?.code || ''
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const score = (c.result_data as any)?.score?.pontuacao
                    const scoreColor = score >= 700 ? 'var(--score-excellent)' : score >= 500 ? 'var(--score-good)' : score >= 300 ? 'var(--score-regular)' : score ? 'var(--score-low)' : 'var(--gray-400)'
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.document}</td>
                        <td><span className="badge badge-info">{CONSULTATION_LABELS[typeCode] || typeCode}</span></td>
                        <td>
                          {score ? (
                            <span style={{ fontWeight: 700, color: scoreColor }}>{score}</span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>-{c.credits_used}</span>
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                          {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td>
                          <a href={`/api/pdf/generate?id=${c.id}`} target="_blank" rel="noreferrer"
                            className="btn btn-ghost btn-sm" title="Baixar PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            PDF
                          </a>
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
