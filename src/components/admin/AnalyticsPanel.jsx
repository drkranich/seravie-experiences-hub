import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PM = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', stripe: 'Stripe', multiplo: 'Múltiplo' }
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Kpi({ label, value, sub, accent = 'text-admin-champ' }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{label}</p>
      <p className={`text-2xl font-medium ${accent}`}>{value}</p>
      {sub && <p className="text-admin-muted/40 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export function AnalyticsPanel() {
  const [orders, setOrders] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [o, c] = await Promise.all([
        supabase.from('orders').select('*, contacts(name)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('contacts').select('id, name, type, created_at').limit(2000),
      ])
      setOrders(o.data || []); setContacts(c.data || []); setLoading(false)
    })()
  }, [])

  const a = useMemo(() => {
    const sold = orders.filter((o) => o.payment_status === 'paid' || o.status === 'delivered')
    const revenue = sold.reduce((s, o) => s + Number(o.total || 0), 0)
    const count = sold.length
    const ticket = count ? revenue / count : 0
    const now = new Date(); const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const newCustomers = contacts.filter((c) => (c.created_at || '').slice(0, 7) === thisMonth).length
    const buyers = new Set(sold.map((o) => o.contact_id).filter(Boolean))
    const conversion = contacts.length ? Math.round((buyers.size / contacts.length) * 100) : 0

    const days = []
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push({ key: dayKey(d), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total: 0 }) }
    const dayMap = Object.fromEntries(days.map((d) => [d.key, d]))
    sold.forEach((o) => { const k = dayKey(new Date(o.created_at)); if (dayMap[k]) dayMap[k].total += Number(o.total || 0) })
    const maxDay = Math.max(1, ...days.map((d) => d.total))

    const methods = {}
    sold.forEach((o) => { const m = o.payment_method || 'outro'; methods[m] = (methods[m] || 0) + Number(o.total || 0) })
    const byMethod = Object.entries(methods).sort((x, y) => y[1] - x[1])
    const maxMethod = Math.max(1, ...byMethod.map(([, v]) => v))

    const byCustomer = {}
    sold.forEach((o) => { const key = o.contact_id || 'anon'; if (!byCustomer[key]) byCustomer[key] = { name: o.contacts?.name || o.customer_name || 'Consumidor final', total: 0, n: 0 }; byCustomer[key].total += Number(o.total || 0); byCustomer[key].n += 1 })
    const topCustomers = Object.values(byCustomer).sort((x, y) => y.total - x.total).slice(0, 6)

    const prod = {}
    sold.forEach((o) => (o.items || []).forEach((it) => { if (!prod[it.name]) prod[it.name] = { name: it.name, qty: 0, total: 0 }; prod[it.name].qty += Number(it.qty || 0); prod[it.name].total += Number(it.subtotal || (it.price * it.qty) || 0) }))
    const topProducts = Object.values(prod).sort((x, y) => y.qty - x.qty).slice(0, 6)

    return { revenue, count, ticket, newCustomers, conversion, days, maxDay, byMethod, maxMethod, topCustomers, topProducts, buyers: buyers.size }
  }, [orders, contacts])

  if (loading) return <div className="py-12 text-admin-muted/40 text-sm text-center">Carregando analytics…</div>

  return (
    <div>
      <div className="mb-6"><h1 className="font-serif text-4xl text-admin-text">Analytics</h1><p className="text-admin-muted/60 text-sm mt-1">Vendas, clientes e conversão — dados reais do PDV e pedidos</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Faturamento" value={brl(a.revenue)} accent="text-admin-sage" />
        <Kpi label="Pedidos pagos" value={a.count} />
        <Kpi label="Ticket médio" value={brl(a.ticket)} />
        <Kpi label="Clientes" value={contacts.length} sub={`${a.newCustomers} novos no mês`} />
        <Kpi label="Conversão" value={`${a.conversion}%`} sub={`${a.buyers} compraram`} accent="text-admin-gold" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Vendas — últimos 14 dias</p>
          <div className="flex items-end gap-1.5 h-40">
            {a.days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full rounded-t bg-admin-champ/70 hover:bg-admin-champ transition-all relative" style={{ height: `${Math.max(2, (d.total / a.maxDay) * 100)}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-admin-champ opacity-0 group-hover:opacity-100 whitespace-nowrap">{brl(d.total)}</span>
                </div>
                <span className="text-[9px] text-admin-muted/40">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Por forma de pagamento</p>
          {a.byMethod.length === 0 ? <p className="text-admin-muted/40 text-xs">Sem vendas ainda</p> : a.byMethod.map(([m, v]) => (
            <div key={m} className="mb-3">
              <div className="flex justify-between text-xs mb-1"><span className="text-admin-text">{PM[m] || m}</span><span className="text-admin-muted/60">{brl(v)}</span></div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-admin-champ" style={{ width: `${(v / a.maxMethod) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Top clientes</p>
          {a.topCustomers.length === 0 ? <p className="text-admin-muted/40 text-xs">Sem dados</p> : a.topCustomers.map((c, i) => (
            <div key={i} className="flex items-center gap-3 mb-2.5">
              <span className={`w-5 text-center text-sm font-medium ${i === 0 ? 'text-admin-champ' : 'text-admin-muted/40'}`}>{i + 1}</span>
              <span className="flex-1 text-admin-text text-sm truncate">{c.name}</span>
              <span className="text-admin-muted/50 text-xs">{c.n} ped.</span>
              <span className="text-admin-gold text-sm w-24 text-right">{brl(c.total)}</span>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Produtos mais vendidos</p>
          {a.topProducts.length === 0 ? <p className="text-admin-muted/40 text-xs">Sem dados</p> : a.topProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-3 mb-2.5">
              <span className={`w-5 text-center text-sm font-medium ${i === 0 ? 'text-admin-champ' : 'text-admin-muted/40'}`}>{i + 1}</span>
              <span className="flex-1 text-admin-text text-sm truncate">{p.name}</span>
              <span className="text-admin-muted/50 text-xs">{p.qty} un</span>
              <span className="text-admin-gold text-sm w-24 text-right">{brl(p.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
