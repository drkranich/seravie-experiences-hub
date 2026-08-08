import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const brl2 = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const BAR = ['bg-admin-champ', 'bg-admin-sage', 'bg-admin-gold', 'bg-admin-copper', 'bg-admin-rose']

// Hook comum: carrega os dados analíticos do tenant.
function useAnalytics(notify) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ orders: [], contacts: [], campaigns: [] })
  useEffect(() => { (async () => {
    setLoading(true)
    try {
      const [oRes, cRes, cpRes] = await Promise.all([
        supabase.from('orders').select('id, contact_id, total, channel, coupon_id, created_at, status').neq('status', 'cancelled').limit(8000),
        supabase.from('contacts').select('id, name, source, ltv, created_at').limit(6000),
        supabase.from('campaigns').select('id, title, type, status, sent_count, open_count, click_count, coupon_id, created_at').limit(500),
      ])
      setData({ orders: oRes.data || [], contacts: cRes.data || [], campaigns: cpRes.data || [] })
    } catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  })() }, [])
  return { loading, ...data }
}

// ---- barra horizontal reutilizável ----
function BarList({ rows, fmt = brl, color = 0 }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2.5">
      {rows.length === 0 && <p className="text-admin-muted/40 text-sm py-3">Sem dados.</p>}
      {rows.map((r, i) => (
        <div key={r.label + i}>
          <div className="flex justify-between text-xs mb-1"><span className="text-admin-muted/70 truncate">{r.label}</span><span className="text-admin-text shrink-0 ml-2">{fmt(r.value)}</span></div>
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden"><div className={`h-full ${BAR[(color + i) % BAR.length]} rounded-full`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

// ============ ANALYTICS ============
export function AnalyticsTab({ notify }) {
  const { loading, orders, contacts, campaigns } = useAnalytics(notify)

  const a = useMemo(() => {
    const rev = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const byChannel = {}, bySource = {}, byMonth = Array(12).fill(0)
    const spentByContact = {}
    orders.forEach((o) => {
      const ch = o.channel || 'não informado'
      byChannel[ch] = (byChannel[ch] || 0) + Number(o.total || 0)
      const d = new Date(o.created_at)
      byMonth[d.getMonth()] += Number(o.total || 0)
      if (o.contact_id) spentByContact[o.contact_id] = (spentByContact[o.contact_id] || 0) + Number(o.total || 0)
    })
    // receita por origem do contato
    const srcOfContact = {}
    contacts.forEach((c) => { srcOfContact[c.id] = c.source || 'sem origem' })
    orders.forEach((o) => { const s = srcOfContact[o.contact_id] || 'sem origem'; bySource[s] = (bySource[s] || 0) + Number(o.total || 0) })

    // funil simples: base → compradores → recompradores → VIP
    const buyers = Object.keys(spentByContact).length
    const orderCountByContact = {}
    orders.forEach((o) => { if (o.contact_id) orderCountByContact[o.contact_id] = (orderCountByContact[o.contact_id] || 0) + 1 })
    const repeat = Object.values(orderCountByContact).filter((n) => n >= 2).length
    const vip = Object.values(spentByContact).filter((v) => v >= 1000).length

    // cohorts de retenção por mês de aquisição (mês de criação do contato → % que comprou)
    const cohorts = {}
    contacts.forEach((c) => {
      if (!c.created_at) return
      const key = new Date(c.created_at).getMonth()
      const co = (cohorts[key] = cohorts[key] || { total: 0, buyers: 0 })
      co.total += 1
      if (spentByContact[c.id]) co.buyers += 1
    })

    // LTV médio e CAC (proxy: custo de campanhas / novos clientes)
    const ltvAvg = buyers ? Object.values(spentByContact).reduce((s, v) => s + v, 0) / buyers : 0
    const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)
    const estCost = totalSent * 0.05
    const cac = buyers ? estCost / buyers : 0

    return {
      rev, byChannel, bySource, byMonth, buyers, repeat, vip, cohorts, ltvAvg, cac,
      base: contacts.length,
    }
  }, [orders, contacts, campaigns])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Calculando analytics…</p>

  const channelRows = Object.entries(a.byChannel).map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value)
  const sourceRows = Object.entries(a.bySource).map(([label, value]) => ({ label: label === 'pdv' ? 'PDV' : label, value })).sort((x, y) => y.value - x.value)
  const maxMonth = Math.max(1, ...a.byMonth)
  const funnel = [
    { label: 'Base de contatos', value: a.base, color: 'bg-admin-champ' },
    { label: 'Compradores', value: a.buyers, color: 'bg-admin-sage' },
    { label: 'Recompradores (2+)', value: a.repeat, color: 'bg-admin-gold' },
    { label: 'VIP (LTV ≥ R$1.000)', value: a.vip, color: 'bg-admin-rose' },
  ]
  const funnelMax = Math.max(1, a.base)

  return (
    <div className="space-y-5">
      {/* KPIs de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Receita total" value={brl(a.rev)} icon="chart" />
        <Stat label="LTV médio" value={brl2(a.ltvAvg)} icon="star" />
        <Stat label="CAC estimado" value={brl2(a.cac)} icon="user" />
        <Stat label="LTV / CAC" value={a.cac ? `${(a.ltvAvg / a.cac).toFixed(1)}×` : '—'} icon="spark" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Receita por canal de venda"><BarList rows={channelRows} color={0} /></Card>
        <Card title="Receita por origem do cliente"><BarList rows={sourceRows} color={1} /></Card>
      </div>

      {/* Receita por mês */}
      <Card title="Receita por mês (ano corrente)">
        <div className="flex items-end gap-2 h-40 pt-2">
          {a.byMonth.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div className="w-full rounded-t bg-admin-champ/40 hover:bg-admin-champ/60 transition-colors" style={{ height: `${(v / maxMonth) * 100}%`, minHeight: v > 0 ? '4px' : '0' }} title={brl(v)} />
              <span className="text-[9px] text-admin-muted/40">{MES[i]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Funil */}
      <Card title="Funil de clientes">
        <div className="space-y-2">
          {funnel.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-admin-muted/60 text-xs w-40 shrink-0">{f.label}</span>
              <div className="flex-1 h-7 rounded-lg bg-white/[0.03] overflow-hidden"><div className={`h-full ${f.color} rounded-lg flex items-center justify-end pr-2`} style={{ width: `${Math.max(4, (f.value / funnelMax) * 100)}%` }}><span className="text-[10px] text-admin-bg font-medium">{f.value}</span></div></div>
              <span className="text-admin-muted/40 text-xs w-12 text-right shrink-0">{a.base ? pct(f.value / a.base * 100) : '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Cohorts de retenção */}
      <Card title="Retenção por coorte de aquisição (mês de cadastro → % que comprou)">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(a.cohorts).sort((x, y) => Number(x[0]) - Number(y[0])).map(([m, co]) => {
            const rate = co.total ? (co.buyers / co.total) * 100 : 0
            return (
              <div key={m} className="glass-soft rounded-lg p-2.5 text-center">
                <p className="text-admin-muted/50 text-[10px]">{MES[Number(m)]}</p>
                <p className="text-admin-text text-lg font-serif">{pct(rate)}</p>
                <p className="text-admin-muted/40 text-[10px]">{co.buyers}/{co.total}</p>
              </div>
            )
          })}
          {Object.keys(a.cohorts).length === 0 && <p className="text-admin-muted/40 text-sm col-span-6 py-3 text-center">Sem coortes ainda.</p>}
        </div>
      </Card>
    </div>
  )
}

// ============ ATRIBUIÇÃO ============
export function AttributionTab({ notify }) {
  const { loading, orders, contacts, campaigns } = useAnalytics(notify)

  const attr = useMemo(() => {
    const srcOfContact = {}
    contacts.forEach((c) => { srcOfContact[c.id] = c.source || 'direto' })
    // receita atribuída à origem do primeiro contato
    const byOrigin = {}
    let withCoupon = 0, couponRev = 0
    orders.forEach((o) => {
      const src = srcOfContact[o.contact_id] || 'direto'
      byOrigin[src] = (byOrigin[src] || 0) + Number(o.total || 0)
      if (o.coupon_id) { withCoupon += 1; couponRev += Number(o.total || 0) }
    })
    // receita por campanha (via cupom vinculado)
    const couponToCampaign = {}
    campaigns.forEach((c) => { if (c.coupon_id) couponToCampaign[c.coupon_id] = c.title })
    const byCampaign = {}
    orders.forEach((o) => { if (o.coupon_id && couponToCampaign[o.coupon_id]) { const t = couponToCampaign[o.coupon_id]; byCampaign[t] = (byCampaign[t] || 0) + Number(o.total || 0) } })
    const totalRev = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    return { byOrigin, byCampaign, withCoupon, couponRev, totalRev, totalOrders: orders.length }
  }, [orders, contacts, campaigns])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Calculando atribuição…</p>

  const originRows = Object.entries(attr.byOrigin).map(([label, value]) => ({ label: label === 'pdv' ? 'PDV' : label, value })).sort((x, y) => y.value - x.value)
  const campRows = Object.entries(attr.byCampaign).map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value)

  return (
    <div className="space-y-5">
      <div className="glass-soft rounded-xl px-4 py-3 flex items-start gap-3">
        <Icon name="layers" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">A atribuição conecta cada venda à origem do cliente e à campanha (via cupom vinculado), mostrando de onde vem a receita. Conforme você usa mais canais e cupons de campanha, a precisão aumenta.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Receita total" value={brl(attr.totalRev)} icon="chart" />
        <Stat label="Vendas com cupom" value={attr.withCoupon} icon="gift" />
        <Stat label="Receita via cupom" value={brl(attr.couponRev)} icon="star" />
        <Stat label="% atribuída" value={attr.totalRev ? pct(attr.couponRev / attr.totalRev * 100) : '—'} icon="spark" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Receita por origem (primeiro contato)"><BarList rows={originRows} color={0} /></Card>
        <Card title="Receita por campanha (via cupom)"><BarList rows={campRows} color={2} /></Card>
      </div>

      {/* Jornada ilustrativa por origem */}
      <Card title="Caminho até a compra (por origem)">
        <div className="space-y-3">
          {originRows.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ">{r.label}</span>
              <Icon name="down" className="w-3 h-3 text-admin-muted/30 -rotate-90" />
              <span className="px-3 py-1.5 rounded-lg bg-admin-sage/10 text-admin-sage">Contato / CRM</span>
              <Icon name="down" className="w-3 h-3 text-admin-muted/30 -rotate-90" />
              <span className="px-3 py-1.5 rounded-lg bg-admin-gold/10 text-admin-gold">Compra</span>
              <span className="ml-auto text-admin-text">{brl(r.value)}</span>
            </div>
          ))}
          {originRows.length === 0 && <p className="text-admin-muted/40 text-sm py-3">Sem dados de origem ainda.</p>}
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-3.5 h-3.5 text-admin-champ/50" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-2xl font-serif">{value}</p>
    </div>
  )
}
function Card({ title, children }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">{title}</p>
      {children}
    </div>
  )
}
