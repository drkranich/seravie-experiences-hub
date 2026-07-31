import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon, GlassMonth, GlassSelect } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const CHANNEL = { pdv: 'PDV', store: 'Loja online', mercado_livre: 'Mercado Livre', magalu: 'Magalu', amazon: 'Amazon', shopee: 'Shopee', tiktok_shop: 'TikTok Shop', instagram_shop: 'Instagram' }

// ---------------- Vendas (auto: orders + store_orders) ----------------
export function SalesView({ notify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(ym(new Date()))
  const [chan, setChan] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [o, s] = await Promise.all([
        supabase.from('orders').select('number, total, payment_status, channel, customer_name, contacts(name), created_at').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(1000),
        supabase.from('store_orders').select('number, total, payment_status, channel, customer_name, created_at').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(1000),
      ])
      const list = []
      ;(o.data || []).forEach((r) => list.push({ ref: `#${r.number}`, source: r.channel === 'pdv' || !r.channel ? 'pdv' : r.channel, customer: r.contacts?.name || r.customer_name || 'Consumidor final', total: Number(r.total || 0), date: r.created_at }))
      ;(s.data || []).forEach((r) => list.push({ ref: `#${r.number}`, source: r.channel && r.channel !== 'store' ? r.channel : 'store', customer: r.customer_name || 'Cliente', total: Number(r.total || 0), date: r.created_at }))
      setRows(list); setLoading(false)
    })()
  }, [])

  const monthRows = rows.filter((r) => (r.date || '').slice(0, 7) === month && (!chan || r.source === chan))
  const total = monthRows.reduce((s, r) => s + r.total, 0)
  const ticket = monthRows.length ? total / monthRows.length : 0
  const channels = useMemo(() => [...new Set(rows.map((r) => r.source))], [rows])
  const exportRows = () => monthRows.map((r) => ({ Pedido: r.ref, Cliente: r.customer, Canal: CHANNEL[r.source] || r.source, Data: r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '', Total: brl(r.total) }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Vendas</h1><p className="text-admin-muted/60 text-sm mt-1">Preenchido automaticamente do PDV, loja e marketplaces</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <GlassMonth value={month} onChange={setMonth} />
          <div className="w-44"><GlassSelect value={chan} onChange={setChan} options={[{ value: '', label: 'Todos os canais' }, ...channels.map((c) => ({ value: c, label: CHANNEL[c] || c }))]} /></div>
          <button onClick={() => exportCsv(`vendas-${month}.csv`, exportRows()) || notify('Sem vendas', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(`Vendas ${month}`, exportRows(), `Total ${brl(total)}`) || notify('Sem vendas', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Faturamento</p><p className="text-admin-sage text-2xl font-medium">{brl(total)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Vendas</p><p className="text-admin-champ text-2xl font-medium">{monthRows.length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Ticket médio</p><p className="text-admin-text text-2xl font-medium">{brl(ticket)}</p></div>
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : monthRows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="tag" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma venda neste período. As vendas do PDV e da loja aparecem aqui automaticamente.</p></div>
      ) : (
        <div className="space-y-2">{monthRows.slice(0, 300).map((r, i) => (
          <div key={i} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
            <span className="text-admin-muted/50 text-xs w-14 shrink-0">{r.ref}</span>
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{r.customer}</p><p className="text-admin-muted/40 text-xs">{CHANNEL[r.source] || r.source}{r.date ? ` · ${new Date(r.date).toLocaleDateString('pt-BR')}` : ''}</p></div>
            <p className="text-admin-gold text-sm shrink-0">{brl(r.total)}</p>
          </div>
        ))}</div>
      )}
    </div>
  )
}

// ---------------- Contatos por segmento (auto: contacts) ----------------
const SEGMENTS = {
  leads: { title: 'Leads', sub: 'Contatos recentes em prospecção', filter: (c) => c.created_at && (Date.now() - new Date(c.created_at).getTime()) < 90 * 864e5 },
  companies: { title: 'Empresas', sub: 'Contatos do tipo empresa', filter: (c) => c.type === 'company' },
  vip: { title: 'Clientes VIP', sub: 'Maiores valores de compra (LTV)', filter: (c) => Number(c.ltv || 0) > 0, sort: (a, b) => Number(b.ltv || 0) - Number(a.ltv || 0) },
  customers: { title: 'Clientes', sub: 'Base de clientes', filter: () => true, sort: (a, b) => Number(b.ltv || 0) - Number(a.ltv || 0) },
}
const TYPE_LABEL = { person: 'Pessoa', company: 'Empresa', family: 'Família', partner: 'Parceiro', supplier: 'Fornecedor' }

export function ContactsView({ segment = 'customers', notify }) {
  const cfg = SEGMENTS[segment] || SEGMENTS.customers
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('contacts').select('id, name, email, phone, type, status, ltv, created_at').order('created_at', { ascending: false }).limit(2000)
      setContacts(data || []); setLoading(false)
    })()
  }, [])

  const list = useMemo(() => {
    let l = contacts.filter(cfg.filter)
    if (cfg.sort) l = [...l].sort(cfg.sort)
    if (search) l = l.filter((c) => (c.name || '').toLowerCase().includes(search.toLowerCase()))
    return l
  }, [contacts, search, segment])
  const ltvTotal = list.reduce((s, c) => s + Number(c.ltv || 0), 0)
  const monthNew = list.filter((c) => (c.created_at || '').slice(0, 7) === ym(new Date())).length
  const exportRows = () => list.map((c) => ({ Nome: c.name, Email: c.email, Telefone: c.phone, Tipo: TYPE_LABEL[c.type] || c.type, LTV: brl(c.ltv) }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">{cfg.title}</h1><p className="text-admin-muted/60 text-sm mt-1">{cfg.sub} · atualizado automaticamente</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(`${segment}.csv`, exportRows()) || notify('Sem dados', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(cfg.title, exportRows()) || notify('Sem dados', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{cfg.title}</p><p className="text-admin-champ text-2xl font-medium">{list.length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Novos no mês</p><p className="text-admin-sage text-2xl font-medium">{monthNew}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">LTV total</p><p className="text-admin-gold text-2xl font-medium">{brl(ltvTotal)}</p></div>
      </div>
      <div className="relative mb-5 max-w-sm"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" /></div>
      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum contato aqui ainda. Cadastre em CRM — esta lista se atualiza sozinha.</p></div>
      ) : (
        <div className="grid gap-2">{list.slice(0, 300).map((c) => (
          <div key={c.id} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><span className="text-admin-champ font-serif text-sm">{(c.name || '?')[0].toUpperCase()}</span></div>
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{c.name}</p><p className="text-admin-muted/40 text-xs truncate">{c.email || c.phone || '—'}</p></div>
            <span className="text-[10px] text-admin-muted/40 hidden sm:block">{TYPE_LABEL[c.type] || c.type}</span>
            {c.ltv > 0 && <span className="text-admin-gold text-sm shrink-0">{brl(c.ltv)}</span>}
          </div>
        ))}</div>
      )}
    </div>
  )
}

// ---------------- Estoque (auto: products) ----------------
export function StockView({ notify }) {
  const [prods, setProds] = useState([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState('all') // all | low | out

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('products').select('name, sku, stock, min_stock, price, status').order('stock', { ascending: true }).limit(2000)
      setProds(data || []); setLoading(false)
    })()
  }, [])

  const isLow = (p) => p.stock != null && p.min_stock > 0 && p.stock > 0 && p.stock <= p.min_stock
  const isOut = (p) => p.stock != null && p.stock <= 0
  const list = prods.filter((p) => f === 'all' || (f === 'low' ? isLow(p) : isOut(p)))
  const stockValue = prods.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.price) || 0), 0)
  const exportRows = () => list.map((p) => ({ Produto: p.name, SKU: p.sku, Estoque: p.stock, Minimo: p.min_stock, 'Valor unit': brl(p.price) }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Estoque</h1><p className="text-admin-muted/60 text-sm mt-1">Posição de estoque — atualizada pelas vendas do PDV e loja</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('estoque.csv', exportRows()) || notify('Sem produtos', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('Estoque', exportRows()) || notify('Sem produtos', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Produtos</p><p className="text-admin-champ text-2xl font-medium">{prods.length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Estoque baixo</p><p className="text-admin-gold text-2xl font-medium">{prods.filter(isLow).length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Sem estoque</p><p className="text-admin-rose text-2xl font-medium">{prods.filter(isOut).length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Valor em estoque</p><p className="text-admin-sage text-2xl font-medium">{brl(stockValue)}</p></div>
      </div>
      <div className="flex gap-2 mb-5">
        {[['all', 'Todos'], ['low', 'Estoque baixo'], ['out', 'Sem estoque']].map(([k, v]) => (
          <button key={k} onClick={() => setF(k)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${f === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="box" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nada aqui. Cadastre produtos no Catálogo.</p></div>
      ) : (
        <div className="space-y-2">{list.slice(0, 400).map((p, i) => (
          <div key={i} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{p.name}</p>{p.sku && <p className="text-admin-muted/40 text-xs">SKU {p.sku}</p>}</div>
            <span className={`text-sm shrink-0 ${isOut(p) ? 'text-admin-rose' : isLow(p) ? 'text-admin-gold' : 'text-admin-text'}`}>{p.stock ?? 0}{p.min_stock ? <span className="text-admin-muted/40 text-xs"> / mín {p.min_stock}</span> : ''}</span>
          </div>
        ))}</div>
      )}
    </div>
  )
}
