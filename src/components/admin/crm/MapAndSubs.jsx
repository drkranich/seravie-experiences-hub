import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const BAR = ['bg-admin-champ', 'bg-admin-sage', 'bg-admin-gold', 'bg-admin-copper', 'bg-admin-rose']

// Mapa de clientes — distribuição geográfica por cidade (ranking visual + bolhas).
export function CustomerMap({ notify }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    setLoading(true)
    try { const { data } = await supabase.from('contacts').select('id, city, ltv').limit(6000); setContacts(data || []) }
    catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  })() }, [])

  const cities = useMemo(() => {
    const m = {}
    contacts.forEach((c) => { const k = (c.city || '').trim() || 'Sem cidade'; if (!m[k]) m[k] = { count: 0, ltv: 0 }; m[k].count += 1; m[k].ltv += Number(c.ltv || 0) })
    return Object.entries(m).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count)
  }, [contacts])

  const withCity = cities.filter((c) => c.label !== 'Sem cidade')
  const maxCount = Math.max(1, ...cities.map((c) => c.count))

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando mapa…</p>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cidades" value={withCity.length} icon="building" />
        <Stat label="Contatos" value={contacts.length} icon="user" />
        <Stat label="Com cidade" value={contacts.length - (cities.find((c) => c.label === 'Sem cidade')?.count || 0)} icon="check" />
        <Stat label="Maior praça" value={withCity[0]?.label || '—'} icon="star" />
      </div>

      {/* "mapa" de bolhas por cidade (proporcional à quantidade) */}
      <div className="glass rounded-2xl p-6">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Concentração por cidade</p>
        {withCity.length === 0 ? (
          <p className="text-admin-muted/40 text-sm py-6 text-center">Nenhum contato com cidade cadastrada. Preencha a cidade no cadastro para ver o mapa.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-4 justify-center py-4">
            {withCity.slice(0, 24).map((c, i) => {
              const size = 40 + Math.round((c.count / maxCount) * 70)
              const col = ['#DCCBA7', '#55634D', '#B89C61', '#C1835B', '#B7745E'][i % 5]
              return (
                <div key={c.label} className="flex flex-col items-center gap-1" style={{ width: size }}>
                  <div className="rounded-full flex items-center justify-center" style={{ width: size, height: size, backgroundColor: col + '22', border: `1.5px solid ${col}66` }} title={`${c.label}: ${c.count} contato(s)`}>
                    <span className="font-serif" style={{ color: col, fontSize: Math.max(12, size / 4) }}>{c.count}</span>
                  </div>
                  <span className="text-admin-muted/60 text-[10px] text-center truncate w-full">{c.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ranking */}
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Ranking de praças (por contatos)</p>
        <div className="space-y-2.5">
          {cities.slice(0, 12).map((c, i) => (
            <div key={c.label}>
              <div className="flex justify-between text-xs mb-1"><span className="text-admin-muted/70">{c.label}</span><span className="text-admin-text">{c.count} · {brl(c.ltv)}</span></div>
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden"><div className={`h-full ${BAR[i % BAR.length]} rounded-full`} style={{ width: `${(c.count / maxCount) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Assinaturas — planos recorrentes dos clientes (club_subscriptions).
export function Subscriptions({ notify, onOpenContact }) {
  const [subs, setSubs] = useState([])
  const [plans, setPlans] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => { (async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        supabase.from('club_subscriptions').select('*, contact:contacts(name)').order('created_at', { ascending: false }).limit(2000),
        supabase.from('plans').select('id, name, price_monthly'),
      ])
      setSubs(sRes.data || [])
      setPlans(Object.fromEntries((pRes.data || []).map((p) => [p.id, p])))
    } catch { /* noop */ } finally { setLoading(false) }
  })() }, [])

  const STATUS = { active: ['Ativa', 'bg-admin-sage/15 text-admin-sage'], paused: ['Pausada', 'bg-admin-gold/15 text-admin-gold'], cancelled: ['Cancelada', 'bg-admin-rose/15 text-admin-rose'], pending: ['Pendente', 'bg-white/[0.06] text-admin-muted/60'] }
  const list = filter ? subs.filter((s) => s.status === filter) : subs
  const active = subs.filter((s) => s.status === 'active')
  const mrr = active.reduce((s, x) => s + Number(plans[x.plan_id]?.price_monthly || 0), 0)

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Assinaturas" value={subs.length} icon="star" />
        <Stat label="Ativas" value={active.length} icon="check" />
        <Stat label="Receita recorrente (MRR)" value={brl(mrr)} icon="chart" />
        <Stat label="Receita anual (ARR)" value={brl(mrr * 12)} icon="spark" />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('')} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todas</button>
        {['active', 'paused', 'cancelled'].map((k) => <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{STATUS[k][0]}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : list.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="star" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma assinatura {filter ? 'neste status' : 'ainda'}.</p></div>
        ) : (
          <div className="space-y-2">
            {list.map((s) => {
              const [stLabel, stCls] = STATUS[s.status] || STATUS.pending
              const plan = plans[s.plan_id]
              return (
                <div key={s.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="star" className="w-4 h-4 text-admin-champ/70" /></div>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => s.contact_id && onOpenContact && onOpenContact({ id: s.contact_id, name: s.contact?.name })} className="text-admin-text text-sm truncate hover:text-admin-champ text-left block">{s.contact?.name || s.customer_name || 'Cliente'}</button>
                    <p className="text-admin-muted/40 text-xs">{plan?.name || 'Plano'}{s.next_delivery ? ` · próx. ${new Date(s.next_delivery).toLocaleDateString('pt-BR')}` : ''}</p>
                  </div>
                  {plan?.price_monthly > 0 && <span className="text-admin-gold text-sm shrink-0">{brl(plan.price_monthly)}/mês</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${stCls}`}>{stLabel}</span>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-3.5 h-3.5 text-admin-champ/50" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-xl font-serif truncate">{value}</p>
    </div>
  )
}
