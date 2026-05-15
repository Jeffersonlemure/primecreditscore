'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="auth-container">
      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: 'white', maxWidth: 400 }}>
          {/* System Logo */}
          <div style={{
            height: '240px',
            width: '100%',
            marginBottom: '8px',
            backgroundImage: "url('https://agencialemure.com.br/wp-content/uploads/2026/03/logo-primescore-BcJHqghM.png')",
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0) invert(1)'
          }} />

          {/* Tagline */}
          <p style={{ fontSize: 15, fontWeight: 500, opacity: 0.75, letterSpacing: '0.03em', marginBottom: 24 }}>
            Consultas oficiais em tempo real
          </p>

          {/* Serasa logo */}
          <div style={{ marginTop: 8, paddingTop: 16 }}>
            <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 10 }}>DADOS FORNECIDOS POR</p>
            <img
              src="https://gold-camel-934638.hostingersite.com/wp-content/uploads/2026/03/pngegg.png"
              alt="Serasa"
              style={{ height: 50, margin: '0 auto', filter: 'brightness(0) invert(1)', opacity: 0.8 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form">
          <div style={{ marginBottom: 32 }}>
            <h2 className="auth-title">Bem-vindo de volta</h2>
            <p className="auth-subtitle">Entre com suas credenciais para acessar o sistema</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email" type="email" className="form-input"
                placeholder="seu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Senha</label>
              <input
                id="password" type="password" className="form-input"
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--gray-500)' }}>
            Não tem conta?{' '}
            <Link href="/register" className="auth-link">Cadastre-se grátis</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
