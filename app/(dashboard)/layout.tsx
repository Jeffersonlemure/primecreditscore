'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'grid', label: 'Dashboard' },
  { href: '/dashboard/consultar', icon: 'search', label: 'Nova Consulta' },
  { href: '/dashboard/historico', icon: 'clock', label: 'Histórico' },
  { href: '/dashboard/creditos', icon: 'credit-card', label: 'Comprar Créditos' },
]

const ADMIN_ITEMS = [
  { href: '/admin', icon: 'shield', label: 'Painel Admin' },
  { href: '/admin/usuarios', icon: 'users', label: 'Usuários' },
  { href: '/admin/precos', icon: 'tag', label: 'Preços' },
]

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const icons: Record<string, string> = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    search: 'M11 3a8 8 0 100 16A8 8 0 0011 3zM21 21l-4.35-4.35',
    clock: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
    'credit-card': 'M1 4h22v16H1zM1 10h22',
    shield: 'M12 2L4 7v5c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V7z',
    users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
    'log-out': 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    coins: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v8M8 12h8',
    bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  }
  const d = icons[name] || icons.grid
  const isMultiPath = d.includes('M') && d.split('M').length > 2
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {name === 'credit-card' ? (
        <>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </>
      ) : isMultiPath ? d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      )) : <path d={d} />}
    </svg>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
    setLoading(false)
  }, [router])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const pageTitle = [...NAV_ITEMS, ...ADMIN_ITEMS].find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label || 'Dashboard'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ padding: '0px', height: '100px', width: '100%', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundImage: "url('https://agencialemure.com.br/wp-content/uploads/2026/03/logo-primescore-BcJHqghM.png')",
            backgroundSize: '87%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0) invert(1)'
          }} />
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Navegação</div>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}

          {profile?.role === 'admin' && (
            <>
              <div className="sidebar-section" style={{ marginTop: 8 }}>Administração</div>
              {ADMIN_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {loading ? (
            <div style={{ padding: '10px 14px' }}>
              <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
            </div>
          ) : (
            <>
              <div className="sidebar-user">
                <div className="sidebar-avatar">
                  {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{profile?.full_name || profile?.email}</div>
                  <div className="sidebar-user-role">{profile?.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="sidebar-nav-item"
                style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)' }}
              >
                <Icon name="log-out" />
                Sair
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <h1 className="topbar-title">{pageTitle}</h1>
          <div className="topbar-actions">
            {!loading && profile && (
              <Link href="/dashboard/creditos" className="credit-badge" style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Consultas Básicas (Pacote)">
                  <Icon name="search" size={14} />
                  <span>{profile.basica_balance} Básicas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Consultas Rating (Pacote)">
                  <Icon name="shield" size={14} />
                  <span>{profile.rating_balance} Rating</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Créditos Avulsos">
                  <Icon name="coins" size={14} />
                  <span>{profile.credits_balance} Créditos</span>
                </div>
              </Link>
            )}
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
