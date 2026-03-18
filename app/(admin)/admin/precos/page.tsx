'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_TYPES = [
  { id: 'ct1', code: 'basica_pf', name: 'Básica PF', description: 'Consulta básica de Pessoa Física', credits_cost: 1, is_active: true },
  { id: 'ct2', code: 'basica_pj', name: 'Básica PJ', description: 'Consulta básica de Pessoa Jurídica', credits_cost: 1, is_active: true },
  { id: 'ct3', code: 'rating_pf', name: 'Rating PF', description: 'Análise completa de Pessoa Física', credits_cost: 2, is_active: true },
  { id: 'ct4', code: 'rating_pj', name: 'Rating PJ', description: 'Análise completa de Pessoa Jurídica', credits_cost: 2, is_active: true },
]

const DEFAULT_PACKAGES = [
  { id: 'p1', name: 'Starter', credits: 10, price: 19.90, is_active: true, popular: false },
  { id: 'p2', name: 'Profissional', credits: 30, price: 49.90, is_active: true, popular: true },
  { id: 'p3', name: 'Empresarial', credits: 100, price: 149.90, is_active: true, popular: false },
]

export default function AdminPrecosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [types, setTypes] = useState<any[]>(DEFAULT_TYPES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [packages, setPackages] = useState<any[]>(DEFAULT_PACKAGES)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [typesRes, pkgsRes] = await Promise.all([
      supabase.from('consultation_types').select('*').order('credits_cost'),
      supabase.from('credit_packages').select('*').order('price'),
    ])
    if (typesRes.data?.length) setTypes(typesRes.data)
    if (pkgsRes.data?.length) setPackages(pkgsRes.data)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveType(type: { id: string; credits_cost: number; is_active: boolean }) {
    setSaving(type.id)
    const supabase = createClient()
    await supabase.from('consultation_types').upsert({ id: type.id, credits_cost: type.credits_cost, is_active: type.is_active })
    setSaving(null)
  }

  async function savePackage(pkg: { id: string; name: string; credits: number; price: number; is_active: boolean; popular: boolean }) {
    setSaving(pkg.id)
    const supabase = createClient()
    await supabase.from('credit_packages').upsert(pkg)
    setSaving(null)
  }

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Consultation Types Pricing */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Preços das Consultas</div>
            <div className="card-subtitle">Custo em créditos por cada tipo de consulta</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {types.map(type => (
              <div key={type.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--gray-200)'
              }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{type.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{type.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--gray-600)' }}>Créditos:</label>
                  <input
                    type="number" min="1" max="100"
                    value={type.credits_cost}
                    onChange={e => setTypes(ts => ts.map(t => t.id === type.id ? { ...t, credits_cost: Number(e.target.value) } : t))}
                    className="form-input" style={{ width: 70, textAlign: 'center' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={type.is_active}
                      onChange={e => setTypes(ts => ts.map(t => t.id === type.id ? { ...t, is_active: e.target.checked } : t))} />
                    Ativo
                  </label>
                  <button
                    onClick={() => saveType(type)}
                    className="btn btn-primary btn-sm"
                    disabled={saving === type.id}
                  >
                    {saving === type.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Pacotes de Créditos</div>
            <div className="card-subtitle">Configure os pacotes disponíveis para compra</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {packages.map(pkg => (
              <div key={pkg.id} style={{
                padding: '16px 20px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${pkg.popular ? 'var(--primary)' : 'var(--gray-200)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="form-group" style={{ gap: 4 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Nome</label>
                      <input type="text" value={pkg.name}
                        onChange={e => setPackages(ps => ps.map(p => p.id === pkg.id ? { ...p, name: e.target.value } : p))}
                        className="form-input" style={{ width: 130 }} />
                    </div>
                    <div className="form-group" style={{ gap: 4 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Créditos</label>
                      <input type="number" min="1" value={pkg.credits}
                        onChange={e => setPackages(ps => ps.map(p => p.id === pkg.id ? { ...p, credits: Number(e.target.value) } : p))}
                        className="form-input" style={{ width: 90 }} />
                    </div>
                    <div className="form-group" style={{ gap: 4 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Preço (R$)</label>
                      <input type="number" min="0" step="0.01" value={pkg.price}
                        onChange={e => setPackages(ps => ps.map(p => p.id === pkg.id ? { ...p, price: Number(e.target.value) } : p))}
                        className="form-input" style={{ width: 100 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {formatCurrency(pkg.price / pkg.credits)}/crédito
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={pkg.popular}
                        onChange={e => setPackages(ps => ps.map(p => p.id === pkg.id ? { ...p, popular: e.target.checked } : p))} />
                      Popular
                    </label>
                    <button
                      onClick={() => savePackage(pkg)}
                      className="btn btn-primary btn-sm"
                      disabled={saving === pkg.id}
                    >
                      {saving === pkg.id ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
