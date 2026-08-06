import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'

const TIERS = { bronze: 'Bronze', silver: 'Prata', gold: 'Ouro', platinum: 'Platina' }

// ---------- Contas de fidelidade ----------
function AccountsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [txns, setTxns] = useState([])
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState('earn')

  const load = async () => {
    const [{ data: acc }, { data: ct }] = await Promise.all([
      supabase.from('loyalty_accounts').select('*, contacts(name)').order('points', { ascending: false }),
      supabase.from('contacts').select('id,name').order('name').limit(500),
    ])
    setRows(acc || []); setContacts(ct || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openAcc = async (a) => {
    setActive(a)
    const { data } = await supabase.from('loyalty_transactions').select('*').eq('account_id', a.id).order('created_at', { ascending: false }).limit(50)
    setTxns(data || [])
  }
  const adjust = async () => {
    if (!active) return
    const pts = Math.round(Number(amount) || 0)
    if (!pts) return notify('Informe os pontos', 'error')
    const signed = kind === 'earn' ? pts : -pts
    const newPoints = Math.max(0, (active.points || 0) + signed)
    await supabase.from('loyalty_transactions').insert({ tenant_id: tenantId, account_id: active.id, type: kind, points: signed, description: kind === 'earn' ? 'Acúmulo manual' : 'Resgate manual' })
    const patch = { points: newPoints }
    if (kind === 'earn') patch.lifetime_points = (active.lifetime_points || 0) + pts
    await supabase.from('loyalty_accounts').update(patch).eq('id', active.id)
    notify(kind === 'earn' ? `+${pts} pontos` : `-${pts} pontos (resgate)`, 'success')
    setAmount(''); const updated = { ...active, ...patch }; setActive(updated); openAcc(updated); load()
  }
  const createAccount = async (contactId) => {
    if (!contactId) return
    await supabase.from('loyalty_accounts').insert({ tenant_id: tenantId, contact_id: contactId, points: 0, lifetime_points: 0, tier: 'bronze' })
    load(); notify('Conta de fidelidade criada', 'success')
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nova conta (a partir de um contato)</label>
          <GlassSelect value="" onChange={createAccount} placeholder="Escolher contato" options={contacts.filter((c) => !rows.some((r) => r.contact_id === c.id)).map((c) => ({ value: c.id, label: c.name }))} /></div>
      </div>
      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhuma conta de fidelidade.</p><p className="text-admin-muted/30 text-xs mt-1">Crie contas a partir dos seus contatos do CRM.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((a) => (
            <button key={a.id} onClick={() => openAcc(a)} className="glass rounded-2xl p-4 text-left hover:bg-white/[0.05] transition-colors">
              <div className="flex items-center justify-between"><span className="text-admin-text text-sm font-medium truncate">{a.contacts?.name || 'Cliente'}</span><span className="text-[9px] px-1.5 py-0.5 rounded bg-admin-champ/10 text-admin-champ">{TIERS[a.tier] || a.tier}</span></div>
              <p className="text-2xl font-medium text-admin-champ mt-2">{a.points}<span className="text-xs text-admin-muted/40"> pts</span></p>
              <p className="text-admin-muted/30 text-[11px] mt-1">acumulado: {a.lifetime_points || 0}</p>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">{active.contacts?.name || 'Cliente'}</h2><button onClick={() => setActive(null)} className="text-admin-muted/40">✕</button></div>
            <div className="flex items-baseline gap-2 mb-5"><span className="text-3xl font-medium text-admin-champ">{active.points}</span><span className="text-admin-muted/40 text-sm">pontos · {TIERS[active.tier] || active.tier}</span></div>
            <div className="glass rounded-xl p-3 mb-4 space-y-2">
              <div className="flex gap-2">
                <GlassSelect value={kind} onChange={setKind} options={[{ value: 'earn', label: 'Acumular' }, { value: 'redeem', label: 'Resgatar' }]} className="w-36" />
                <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Pontos" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
                <button onClick={adjust} className="bg-admin-champ/15 text-admin-champ px-4 rounded-xl text-sm hover:bg-admin-champ/25">OK</button>
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">Histórico</p>
            <div className="space-y-1.5">
              {txns.length === 0 && <p className="text-admin-muted/30 text-xs">Sem movimentações.</p>}
              {txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-white/[0.03] py-1.5">
                  <span className="text-admin-muted/70 text-xs">{t.description || t.type} · {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                  <span className={t.points >= 0 ? 'text-admin-sage' : 'text-admin-rose'}>{t.points >= 0 ? '+' : ''}{t.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Visão geral ----------
function OverviewTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => { const { data } = await supabase.from('loyalty_accounts').select('*'); setRows(data || []); setLoading(false) })() }, [])
  const stats = useMemo(() => {
    const total = rows.length
    const points = rows.reduce((s, r) => s + (r.points || 0), 0)
    const byTier = {}; rows.forEach((r) => { byTier[r.tier || 'bronze'] = (byTier[r.tier || 'bronze'] || 0) + 1 })
    return { total, points, byTier }
  }, [rows])
  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Membros</p><p className="text-2xl font-medium text-admin-text">{stats.total}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Pontos ativos</p><p className="text-2xl font-medium text-admin-champ">{stats.points}</p></div>
        {Object.entries(TIERS).map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{v}</p><p className="text-2xl font-medium text-admin-gold">{stats.byTier[k] || 0}</p></div>
        )).slice(0, 2)}
      </div>
    </div>
  )
}

export function LoyaltyPanel({ notify }) {
  return (
    <ResourceTabs title="Fidelidade" subtitle="pontos, níveis e resgate — programa de recompensas"
      tabs={[
        { key: 'accounts', label: 'Membros', render: () => <AccountsTab notify={notify} /> },
        { key: 'overview', label: 'Visão geral', render: () => <OverviewTab /> },
      ]}
    />
  )
}
