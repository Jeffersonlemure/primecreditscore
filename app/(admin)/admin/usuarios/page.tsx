'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export default function AdminUsersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<{ id: string; credits: number } | null>(null)
  const [newCredits, setNewCredits] = useState(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(userId: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_active: !current }).eq('id', userId)
    load()
  }

  async function changeRole(userId: string, role: string) {
    const supabase = createClient()
    await supabase.from('profiles').update({ role }).eq('id', userId)
    load()
  }

  async function adjustCredits() {
    if (!editingUser) return
    const supabase = createClient()
    await supabase.from('profiles').update({ credits_balance: newCredits }).eq('id', editingUser.id)
    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: editingUser.id, type: 'admin_adjustment',
      amount: newCredits - editingUser.credits,
      balance_before: editingUser.credits, balance_after: newCredits,
      description: 'Ajuste manual pelo administrador',
    })
    setEditingUser(null)
    load()
  }

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Gerenciar Usuários</div>
            <div className="card-subtitle">{users.length} usuários cadastrados</div>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Função</th>
                  <th>Créditos</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.full_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{user.email || user.id.slice(0, 8)}</div>
                    </td>
                    <td>
                      <select
                        value={user.role}
                        onChange={e => changeRole(user.id, e.target.value)}
                        className="form-select"
                        style={{ padding: '4px 28px 4px 8px', fontSize: 12 }}
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{user.credits_balance}</span>
                        <button
                          onClick={() => { setEditingUser({ id: user.id, credits: user.credits_balance }); setNewCredits(user.credits_balance) }}
                          className="btn btn-ghost btn-sm" title="Editar créditos"
                          style={{ padding: '2px 6px', fontSize: 12 }}>
                          ✏️
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {format(new Date(user.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}`}
                        style={{ fontSize: 11 }}
                      >
                        {user.is_active ? 'Bloquear' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Credits Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Ajustar Créditos</div>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Novo Saldo de Créditos</label>
                <input type="number" className="form-input" min="0"
                  value={newCredits} onChange={e => setNewCredits(Number(e.target.value))} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 8 }}>
                Atual: {editingUser.credits} → Novo: {newCredits} ({newCredits - editingUser.credits >= 0 ? '+' : ''}{newCredits - editingUser.credits})
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditingUser(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={adjustCredits} className="btn btn-primary">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
