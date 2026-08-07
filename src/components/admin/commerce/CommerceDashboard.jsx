import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { brl, typeMeta } from '../../../lib/commerceTypes'

function Stat({ label, value, icon, accent = 'champ', hint }) {
  const tone = { champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', rose: 'text-admin-rose', copper: 'text-admin-copper' }[accent]
  const bg = { champ: 'bg-admin-champ/10', gold: 'bg-admin-gold/10', sage: 'bg-admin-sage/10', rose: 'bg-admin-rose/10', copper: 'bg-admin-copper/10' }[accent]
  return (
    <div className="glass rounded-2xl p-5 hover:bg-white/[0.04] transition-colors animate-[fadeUp_0.5s_ease-out]">
      <div className="flex items-start justify-between">
        <div><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">{label}</p><p className={`text-3xl font-medium ${tone} tabular-nums leading-none`}>{value}</p>{hint && <p className="text-admin-muted/40 text-[11px] mt-1.5">{hint}</p>}</div>
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon name={icon} className={`w-5 h-5 ${tone}`} /></div>
      </div>
    </div>
  )
}
function Bar({ label, value, max, display, accent = 'champ' }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setW(max > 0 ? Math.max(4, (value / max) * 100) : 0)); return () => cancelAnimationFrame(id) }, [value, max])
  const bar = { champ: 'bg-admin-champ/50', gold: 'bg-admin-gold/50', sage: 'bg-admin-sage/50', copper: 'bg-admin-copper/50' }[accent]
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1 text-sm"><span className="text-admin-text truncate">{label}</span><span className="text-admin-muted/60 text-xs">{display}</span></div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden"><div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${w}%` }} /></div>
    </div>
  )
}

export function CommerceDashboard() {
  const [orders, setOrders] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0)
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.from('store_orders').select('*').gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('store_listings').select('id,title,item_type,price,stock,status'),
    ])
    setOrders(o || []); setListings(l || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv) }, [])

  const s = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const valid = orders.filter((o) => o.status !== 'cancelled')
    const todays = valid.filter((o) => new Date(o.created_at) >= today)
    const revToday = todays.reduce((s, o) => s + Number(o.total || 0), 0)
    const revMonth = valid.reduce((s, o) => s + Number(o.total || 0), 0)
    const ticket = valid.length ? revMonth / valid.length : 0
    // por canal
    const byChannel = {}; valid.forEach((o) => { const c = o.channel || 'loja'; byChannel[c] = (byChannel[c] || 0) + Number(o.total || 0) })
    // mais vendidos (por item)
    const byItem = {}; valid.forEach((o) => (o.items || []).forEach((it) => { byItem[it.name || it.title] = (byItem[it.name || it.title] || 0) + (it.qty || it.quantity || 1) }))
    const topItems = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 6)
    // catálogo por tipo
    const byType = {}; listings.forEach((l) => { byType[l.item_type || 'product'] = (byType[l.item_type || 'product'] || 0) + 1 })
    const published = listings.filter((l) => l.status === 'published').length
    // clientes
    const emails = new Set(valid.map((o) => o.customer_email).filter(Boolean))
    return { revToday, revMonth, ticket, count: valid.length, todays: todays.length, byChannel, topItems, byType, published, customers: emails.size, catalog: listings.length }
  }, [orders, listings])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando dashboard…</p>
  const maxItem = Math.max(1, ...s.topItems.map((x) => x[1]))
  const maxChannel = Math.max(1, ...Object.values(s.byChannel))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Receita hoje" value={brl(s.revToday)} icon="cart" accent="champ" hint={`${s.todays} pedido(s)`} />
        <Stat label="Receita 30 dias" value={brl(s.revMonth)} icon="chart" accent="sage" />
        <Stat label="Ticket médio" value={brl(s.ticket)} icon="tag" accent="gold" />
        <Stat label="Pedidos" value={String(s.count)} icon="box" accent="copper" />
        <Stat label="Clientes" value={String(s.customers)} icon="user" accent="champ" />
        <Stat label="Catálogo" value={String(s.catalog)} icon="grid" accent="sage" hint={`${s.published} publicados`} />
        <Stat label="Tipos de item" value={String(Object.keys(s.byType).length)} icon="layers" accent="gold" />
        <Stat label="Canais ativos" value={String(Object.keys(s.byChannel).length)} icon="truck" accent="copper" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Mais vendidos</p>
          {s.topItems.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : s.topItems.map(([n, v]) => <Bar key={n} label={n} value={v} max={maxItem} display={`${v} un`} accent="champ" />)}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Vendas por canal</p>
          {Object.keys(s.byChannel).length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : Object.entries(s.byChannel).sort((a, b) => b[1] - a[1]).map(([c, v]) => <Bar key={c} label={c} value={v} max={maxChannel} display={brl(v)} accent="gold" />)}
        </div>
      </div>

      {/* catálogo por tipo */}
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Catálogo por tipo</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(s.byType).map(([t, n]) => { const tm = typeMeta(t); return (
            <div key={t} className="glass-soft rounded-xl px-3 py-2 flex items-center gap-2"><Icon name={tm.icon} className="w-4 h-4 text-admin-champ/70" /><span className="text-admin-text text-sm">{tm.label}</span><span className="text-admin-muted/50 text-xs">{n}</span></div>
          )})}
          {Object.keys(s.byType).length === 0 && <p className="text-admin-muted/40 text-sm">Catálogo vazio.</p>}
        </div>
      </div>
    </div>
  )
}
