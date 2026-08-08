import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassMonth, GlassSelect, matchPeriod, AddressAutocomplete, addressFromContact } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

// Setores da empresa para compartilhar/atribuir um lead
const SETORES = [
  { value: '', label: '— nenhum —' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'suporte', label: 'Suporte' },
  { value: 'diretoria', label: 'Diretoria' },
]
const SETOR_LABEL = Object.fromEntries(SETORES.map((s) => [s.value, s.label]))
const waLink = (phone, msg) => {
  const digits = String(phone || '').replace(/\D/g, '')
  const withDdi = digits.length <= 11 ? '55' + digits : digits
  return `https://wa.me/${withDdi}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`
}

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

  const monthRows = rows.filter((r) => matchPeriod(r.date, month) && (!chan || r.source === chan))
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
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const cfg = SEGMENTS[segment] || SEGMENTS.customers
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // lead em edição
  const [confirmDel, setConfirmDel] = useState(null)
  const [sharing, setSharing] = useState(null)    // lead a compartilhar

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('id, name, email, phone, type, status, ltv, created_at, metadata').order('created_at', { ascending: false }).limit(2000)
    setContacts(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (c) => {
    setConfirmDel(null)
    try { await supabase.from('contacts').delete().eq('id', c.id) } catch (e) { return notify('Erro ao excluir: ' + (e.message || e), 'error') }
    notify('Contato excluído', 'success'); setContacts((xs) => xs.filter((x) => x.id !== c.id))
  }
  const share = async (c, setor) => {
    const meta = { ...(c.metadata || {}), setor }
    try { await supabase.from('contacts').update({ metadata: meta }).eq('id', c.id) } catch (e) { return notify('Erro: ' + (e.message || e), 'error') }
    notify(setor ? `Compartilhado com ${SETOR_LABEL[setor]}` : 'Compartilhamento removido', 'success')
    setContacts((xs) => xs.map((x) => x.id === c.id ? { ...x, metadata: meta } : x)); setSharing(null)
  }

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
        <div className="grid gap-2">{list.slice(0, 300).map((c) => {
          const setor = c.metadata?.setor
          return (
          <div key={c.id} className="glass rounded-xl px-5 py-3 flex items-center gap-4 group">
            <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><span className="text-admin-champ font-serif text-sm">{(c.name || '?')[0].toUpperCase()}</span></div>
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{c.name}</p><p className="text-admin-muted/40 text-xs truncate">{c.email || c.phone || '—'}</p></div>
            {setor && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-admin-sage/15 text-admin-sage hidden sm:block">{SETOR_LABEL[setor] || setor}</span>}
            <span className="text-[10px] text-admin-muted/40 hidden md:block">{TYPE_LABEL[c.type] || c.type}</span>
            {c.ltv > 0 && <span className="text-admin-gold text-sm shrink-0 hidden sm:block">{brl(c.ltv)}</span>}
            <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {c.phone && <a href={waLink(c.phone, `Olá ${c.name || ''}!`)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-sage hover:bg-white/[0.05] transition-colors" title="Conversar no WhatsApp"><Icon name="chart" className="w-3.5 h-3.5" /></a>}
              <button onClick={() => setSharing(c)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Compartilhar com setor"><Icon name="share" className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
              <button onClick={() => setConfirmDel(c)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05] transition-colors" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          )
        })}</div>
      )}

      {editing && <LeadEditModal lead={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {sharing && <ShareModal lead={sharing} onClose={() => setSharing(null)} onShare={share} />}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir contato</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover “{confirmDel.name || 'este contato'}” definitivamente? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3"><button onClick={() => remove(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadEditModal({ lead, notify, onClose, onSaved }) {
  const [f, setF] = useState({ name: lead.name || '', email: lead.email || '', phone: lead.phone || '', status: lead.status || 'active' })
  const [addr, setAddr] = useState(addressFromContact(lead))
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.name.trim()) return notify('Nome obrigatório', 'error')
    setBusy(true)
    try {
      const { error } = await supabase.from('contacts').update({ name: f.name.trim(), email: f.email || null, phone: f.phone || null, status: f.status, ...addr }).eq('id', lead.id)
      if (error) throw error
      notify('Contato atualizado', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  const L = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Editar contato</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><L>Nome *</L><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>E-mail</L><input value={f.email} onChange={(e) => set({ email: e.target.value })} className={inp} /></div>
            <div><L>Telefone</L><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inp} /></div>
          </div>
          <div><L>Endereço (GPS)</L><AddressAutocomplete value={addr} onChange={setAddr} notify={notify} /></div>
          <div><L>Status</L><GlassSelect value={f.status} onChange={(v) => set({ status: v })} options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }, { value: 'blocked', label: 'Bloqueado' }]} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ShareModal({ lead, onClose, onShare }) {
  const [setor, setSetor] = useState(lead.metadata?.setor || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="font-serif text-2xl text-admin-text">Compartilhar lead</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/60 text-xs mb-4">Atribua “{lead.name || 'este lead'}” a um setor da empresa. Ele passa a aparecer marcado para esse time.</p>
        <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Setor</label>
        <GlassSelect value={setor} onChange={setSetor} options={SETORES} />
        <div className="flex gap-3 mt-6">
          <button onClick={() => onShare(lead, setor)} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Compartilhar</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
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
