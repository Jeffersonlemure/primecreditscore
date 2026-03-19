'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', cpfCnpj: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (form.password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, cpf_cnpj: form.cpfCnpj.replace(/\D/g, '') },
      },
    })

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('user already')) {
        setError('Este email já está cadastrado. Faça login.')
      } else if (msg.includes('rate limit') || msg.includes('email rate') || msg.includes('over_email_rate_limit') || msg.includes('too many')) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else if (msg.includes('invalid email')) {
        setError('Email inválido.')
      } else if (msg.includes('password')) {
        setError('Senha muito fraca. Use no mínimo 6 caracteres.')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: 'white', maxWidth: 400 }}>
          <img
            src="https://agencialemure.com.br/wp-content/uploads/2026/03/logo-primescore-BcJHqghM.png"
            alt="PrimeCreditScore"
            style={{ height: 60, margin: '0 auto 32px', filter: 'brightness(0) invert(1)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />

        </div>
      </div>

      <div className="auth-right" style={{ width: 540 }}>
        <div className="auth-form" style={{ maxWidth: 460 }}>
          <h2 className="auth-title">Criar conta</h2>
          <p className="auth-subtitle">Preencha seus dados para começar</p>

          {success && (
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Conta criada com sucesso! Redirecionando...</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input type="text" className="form-input" placeholder="João Silva Santos"
                value={form.fullName} onChange={e => update('fullName', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="seu@email.com"
                value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">CPF / CNPJ</label>
              <input type="text" className="form-input" placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={form.cpfCnpj} onChange={e => update('cpfCnpj', e.target.value)} />
              <span className="form-hint">Opcional, usado para pagamentos PIX</span>
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <input type="password" className="form-input" placeholder="Mínimo 6 caracteres"
                value={form.password} onChange={e => update('password', e.target.value)} required />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || success}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Criando conta...' : 'Criar Conta Grátis'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--gray-500)' }}>
            Já tem conta?{' '}
            <Link href="/login" className="auth-link">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
