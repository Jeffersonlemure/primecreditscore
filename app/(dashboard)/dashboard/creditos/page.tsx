'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CreditPackage, PixPayment } from '@/lib/types'

const DEFAULT_PACKAGES: CreditPackage[] = [] // Not used anymore

const PACOTES: CreditPackage[] = [
  { id: 'pacote_basica', name: 'Pacote 10 Consultas Básicas', credits: 10, price: 68.00, is_active: true, popular: true },
  { id: 'pacote_rating', name: 'Pacote 3 Consultas Rating', credits: 3, price: 119.70, is_active: true },
]

const CREDITOS: CreditPackage[] = [
  { id: 'credito_10', name: '10 Créditos', credits: 10, price: 10.00, is_active: true },
  { id: 'credito_30', name: '30 Créditos', credits: 30, price: 30.00, is_active: true },
  { id: 'credito_50', name: '50 Créditos', credits: 50, price: 50.00, is_active: true },
  { id: 'credito_80', name: '80 Créditos', credits: 80, price: 80.00, is_active: true },
  { id: 'credito_120', name: '120 Créditos', credits: 120, price: 120.00, is_active: true },
]

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function PixModal({ payment, onClose }: { payment: PixPayment; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (payment.pix_code) {
      navigator.clipboard.writeText(payment.pix_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">💳 Pague via PIX</div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              {payment.credits} créditos — {formatCurrency(payment.amount)}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>✕</button>
        </div>

        <div className="modal-body">
          {/* QR Code */}
          <div className="pix-qr">
            {payment.pix_qr_url ? (
              <img src={`data:image/png;base64,${payment.pix_qr_url}`} alt="QR Code PIX"
                style={{ width: 180, height: 180, margin: '0 auto' }} />
            ) : (
              <div style={{ width: 180, height: 180, margin: '0 auto', background: 'var(--gray-200)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gray-400)', fontSize: 13 }}>
                QR Code PIX
              </div>
            )}
          </div>

          {/* Pix Code */}
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ou copie o código PIX:</p>
          <div className="pix-code">{payment.pix_code || 'Código PIX não disponível'}</div>

          <button onClick={copy} className="btn btn-outline btn-full" style={{ marginTop: 12 }}>
            {copied ? '✓ Copiado!' : 'Copiar código PIX'}
          </button>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: 13 }}>
              Após o pagamento, seus créditos serão adicionados automaticamente em até 1 minuto.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreditosPage() {
  const [selectedCredito, setSelectedCredito] = useState(CREDITOS[0].id)
  const [loading, setLoading] = useState(false)
  const [activePayment, setActivePayment] = useState<PixPayment | null>(null)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Array<{ id: string; type: string; amount: number; description: string; created_at: string }>>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, txRes] = await Promise.all([
      supabase.from('profiles').select('credits_balance').eq('id', user.id).single(),
      supabase.from('credit_transactions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(10),
    ])

    setBalance(profileRes.data?.credits_balance || 0)
    setTransactions(txRes.data || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleBuy(pkg: CreditPackage) {
    setLoading(true)
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: pkg.id }),
    })
    const json = await res.json()

    if (!res.ok) {
      alert(json.error || 'Erro ao criar pagamento')
      setLoading(false)
      return
    }

    setActivePayment({
      id: json.paymentId,
      user_id: '',
      package_id: pkg.id,
      asaas_payment_id: json.asaasPaymentId,
      status: 'PENDING',
      amount: json.amount,
      credits: json.credits,
      pix_code: json.pixCode,
      pix_qr_url: json.pixQrCodeUrl,
      expires_at: json.expiresAt,
      paid_at: null,
      created_at: new Date().toISOString(),
    })
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {activePayment && (
        <PixModal payment={activePayment} onClose={() => { setActivePayment(null); load() }} />
      )}

      {/* Balance Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%)',
        borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white',
      }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Saldo Atual
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{balance}</div>
          <div style={{ fontSize: 15, opacity: 0.8, marginTop: 4 }}>créditos disponíveis</div>
        </div>
        <div style={{ opacity: 0.2, fontSize: 80 }}>💳</div>
      </div>

      {/* Packages */}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--gray-900)' }}>
        Comprar Pacote
      </h3>
      <div className="grid-2" style={{ marginBottom: 32 }}>
        {PACOTES.map(pkg => (
          <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
            {pkg.popular && <div className="package-badge">⭐ Mais Popular</div>}
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--gray-900)' }}>{pkg.name}</div>
            <div className="package-price" style={{ margin: '12px 0' }}>{formatCurrency(pkg.price)}</div>
            <button
              className={`btn btn-full ${pkg.popular ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleBuy(pkg)}
              disabled={loading}
              style={{ marginTop: 'auto' }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Comprar via PIX'}
            </button>
          </div>
        ))}
      </div>

      {/* Créditos Avulsos */}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--gray-900)' }}>
        Comprar Créditos Avulsos
      </h3>
      <div className="card" style={{ padding: 24, marginBottom: 32, maxWidth: 400 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>
            Selecione a quantidade de créditos
          </label>
          <select 
            className="form-input" 
            value={selectedCredito} 
            onChange={e => setSelectedCredito(e.target.value)}
            disabled={loading}
          >
            {CREDITOS.map(pkg => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.credits} Créditos — {formatCurrency(pkg.price)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-full btn-outline"
          onClick={() => {
            const pkg = CREDITOS.find(p => p.id === selectedCredito)
            if (pkg) handleBuy(pkg)
          }}
          disabled={loading}
          style={{ padding: '12px' }}
        >
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '💳 Comprar via PIX'}
        </button>
      </div>

      {/* PIX Info */}
      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <strong>Pagamento via PIX</strong> — Créditos adicionados automaticamente após confirmação (geralmente em menos de 1 minuto).
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Histórico de Transações</div>
          </div>
          <div className="card-body p-0">
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr><th>Descrição</th><th>Tipo</th><th>Créditos</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td>{tx.description}</td>
                      <td>
                        <span className={`badge ${tx.type === 'credit_purchase' ? 'badge-success' : tx.type === 'consultation_debit' ? 'badge-danger' : 'badge-gray'}`}>
                          {tx.type === 'credit_purchase' ? 'Compra' : tx.type === 'consultation_debit' ? 'Consulta' : 'Ajuste'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: tx.amount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                        {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
