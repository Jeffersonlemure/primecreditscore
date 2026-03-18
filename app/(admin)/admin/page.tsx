'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export default function AdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()

    const [usersRes, consultRes, txRes] = await Promise.all([
      supabase.from('profiles').select('credits_balance, role, is_active, created_at'),
      supabase.from('consultations').select('credits_used, created_at'),
      supabase.from('pix_payments').select('amount, status, credits, created_at'),
    ])

    const users = usersRes.data || []
    const consults = consultRes.data || []
    const payments = txRes.data || []

    const confirmedPayments = payments.filter((p: { status: string }) => p.status === 'CONFIRMED' || p.status === 'RECEIVED')

    setStats({
      totalUsers: users.length,
      activeUsers: users.filter((u: { is_active: boolean }) => u.is_active).length,
      adminUsers: users.filter((u: { role: string }) => u.role === 'admin').length,
      totalConsultations: consults.length,
      totalCreditsUsed: consults.reduce((s: number, c: { credits_used: number }) => s + (c.credits_used || 0), 0),
      totalRevenue: confirmedPayments.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0),
      pendingPayments: payments.filter((p: { status: string }) => p.status === 'PENDING').length,
      recentUsers: users.slice(-5).reverse(),
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-4">{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}</div>
    </div>
  )

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  }

  return (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
          <path d="M12 2L4 7v5c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V7z" />
        </svg>
        <span>Você está no <strong>Painel Administrativo</strong>. Apenas administradores têm acesso.</span>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div><div className="stat-value">{stats.totalUsers}</div><div className="stat-label">Usuários</div></div>
          <div className="stat-card-icon bg-blue-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          </div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{stats.totalConsultations}</div><div className="stat-label">Consultas</div></div>
          <div className="stat-card-icon bg-purple-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{stats.totalCreditsUsed}</div><div className="stat-label">Créditos Usados</div></div>
          <div className="stat-card-icon bg-orange-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
            </svg>
          </div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(stats.totalRevenue)}</div><div className="stat-label">Receita Total</div></div>
          <div className="stat-card-icon bg-green-light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18M17 6h6v6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Quick Links */}
        <div className="card">
          <div className="card-header"><div className="card-title">Gestão</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a href="/admin/usuarios" className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start' }}>
              👥 Gerenciar Usuários
            </a>
            <a href="/admin/precos" className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start' }}>
              💰 Configurar Preços
            </a>
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <div className="card-header"><div className="card-title">Resumo</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--gray-600)' }}>Usuários Ativos</span>
              <span style={{ fontWeight: 700 }}>{stats.activeUsers}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--gray-600)' }}>Administradores</span>
              <span style={{ fontWeight: 700 }}>{stats.adminUsers}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--gray-600)' }}>Pagamentos Pendentes</span>
              <span style={{ fontWeight: 700, color: stats.pendingPayments > 0 ? 'var(--warning)' : 'inherit' }}>{stats.pendingPayments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
