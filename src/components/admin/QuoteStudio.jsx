import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { exportPdf } from '../../lib/export'
import { logAudit } from '../../lib/audit'

// Seravie Quote Studio — Sales Proposal & Pricing Engine.
// Dashboard comercial + lista premium + editor 3 colunas com engenharia de preço.

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brl0 = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const pct = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const STATUS = {
  draft: ['Rascunho', 'bg-admin-gold/10 text-admin-gold'],
  sent: ['Enviado', 'bg-admin-champ/10 text-admin-champ'],
  viewed: ['Visualizado', 'bg-admin-champ/10 text-admin-champ'],
  negotiating: ['Negociando', 'bg-admin-copper/10 text-admin-copper'],
  accepted: ['Aprovado', 'bg-admin-sage/10 text-admin-sage'],
  rejected: ['Perdido', 'bg-admin-rose/10 text-admin-rose'],
  expired: ['Expirado', 'bg-white/[0.05] text-admin-muted/50'],
}
const KIND = {
  product: 'Produto', service: 'Serviço', experience: 'Experiência', project: 'Projeto',
  booking: 'Reserva', workshop: 'Workshop', kit: 'Kit', combo: 'Combo', subscription: 'Assinatura',
  consulting: 'Consultoria', hosting: 'Hospedagem', fee: 'Taxa', shipping: 'Frete', giftcard: 'Gift card',
}
const emptyItem = () => ({ _new: true, name: '', kind: 'product', qty: 1, unit_cost: 0, unit_price: 0, discount: 0, discount_type: 'percent', tax_rate: 0 })

// motor de cálculo (reutilizado no editor e no comparativo de cenários)
function computeQuote(items, eng = {}) {
  let sub = 0, disc = 0, tax = 0, cost = 0
  ;(items || []).forEach((r) => {
    const gross = (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
    const d = r.discount_type === 'amount' ? (Number(r.discount) || 0) : gross * (Number(r.discount) || 0) / 100
    const net = Math.max(gross - d, 0)
    tax += net * (Number(r.tax_rate) || 0) / 100
    sub += gross; disc += d; cost += (Number(r.qty) || 0) * (Number(r.unit_cost) || 0)
  })
  const extras = (Number(eng.freight) || 0) + (Number(eng.packaging) || 0)
  const commission = (sub - disc) * ((Number(eng.commission_pct) || 0) / 100)
  const extraTax = (sub - disc) * ((Number(eng.extra_tax_pct) || 0) / 100)
  const total = sub - disc + tax + extras
  const fullCost = cost + extras + commission + extraTax
  const profit = total - fullCost
  const margin = total > 0 ? profit / total * 100 : 0
  const tm = (Number(eng.target_margin) || 0) / 100
  const idealPrice = tm < 1 && tm > 0 ? fullCost / (1 - tm) : total
  return { sub, disc, tax, cost, extras, commission, extraTax, total, fullCost, profit, margin, markup: fullCost > 0 ? profit / fullCost * 100 : 0, idealPrice }
}
// nomes/estilos dos cenários
const SCEN_PRESET = [
  { key: 'economico', name: 'Econômico', tone: 'sage' },
  { key: 'premium', name: 'Premium', tone: 'champ' },
  { key: 'signature', name: 'Signature', tone: 'gold' },
]

export function QuoteStudio({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard') // dashboard | list
  const [editing, setEditing] = useState(null)
  const [items, setItems] = useState([])
  const [dirty, setDirty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deals, setDeals] = useState([])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('quotes').select('*, contact:contacts(name), deal:deals(title)').order('created_at', { ascending: false }).limit(300)
    setQuotes(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openQuote = async (q) => {
    setEditing(q); setDirty(false)
    const { data } = await supabase.from('quote_items').select('*').eq('quote_id', q.id).order('sort_order')
    setItems((data || []).map((x) => ({ ...x })))
  }
  const openNew = async () => {
    setCreating(true)
    const { data } = await supabase.from('deals').select('id, title, contact_id, value').neq('status', 'lost').order('created_at', { ascending: false }).limit(100)
    setDeals(data || [])
  }
  const createQuote = async (deal) => {
    const number = (await supabase.rpc('next_quote_number', { p_tenant: tenantId })).data
    const payload = { tenant_id: tenantId, title: deal ? deal.title : 'Novo orçamento', number, status: 'draft', deal_id: deal?.id || null, contact_id: deal?.contact_id || null, created_by: profile?.user_id }
    const { data, error } = await supabase.from('quotes').insert(payload).select('*, contact:contacts(name), deal:deals(title)').single()
    if (error) return notify('Erro ao criar: ' + error.message, 'error')
    setCreating(false); load(); openQuote(data); setItems([emptyItem()]); setDirty(true)
    notify('Orçamento criado', 'success')
  }

  if (editing) return <QuoteEditor {...{ editing, setEditing, items, setItems, dirty, setDirty, mayEdit, tenantId, profile, notify, reload: load }} />

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Seravie Quote Studio</h1>
          <p className="text-admin-muted/60 text-sm mt-1">Sales Proposal &amp; Pricing Engine — do lead ao contrato, num só fluxo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl">
            {[['dashboard', 'Dashboard'], ['list', 'Orçamentos']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-lg text-sm ${view === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{l}</button>
            ))}
          </div>
          {mayEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo orçamento</button>}
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
        : view === 'dashboard' ? <Dashboard quotes={quotes} onOpen={openQuote} onGoList={() => setView('list')} />
        : <QuoteList quotes={quotes} onOpen={openQuote} />}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Novo orçamento</h2><button onClick={() => setCreating(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <button onClick={() => createQuote(null)} className="w-full glass-soft rounded-xl px-4 py-3 text-left hover:bg-white/[0.04] mb-3"><p className="text-admin-text text-sm">Em branco</p><p className="text-admin-muted/40 text-xs">Começar do zero</p></button>
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-2">A partir de um negócio</p>
            {deals.length === 0 ? <p className="text-admin-muted/40 text-xs">Nenhum negócio no pipeline.</p> : (
              <div className="space-y-1.5">
                {deals.map((d) => <button key={d.id} onClick={() => createQuote(d)} className="w-full glass-soft rounded-xl px-4 py-2.5 text-left hover:bg-white/[0.04]"><p className="text-admin-text text-sm truncate">{d.title}</p>{d.value > 0 && <p className="text-admin-gold text-xs">{brl(d.value)}</p>}</button>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- DASHBOARD ----------------
function Dashboard({ quotes, onOpen, onGoList }) {
  const s = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const isToday = (q) => new Date(q.created_at) >= today
    const open = quotes.filter((q) => ['sent', 'viewed', 'negotiating'].includes(q.status))
    const won = quotes.filter((q) => q.status === 'accepted')
    const lost = quotes.filter((q) => q.status === 'rejected')
    const closed = won.length + lost.length
    const revForecast = open.reduce((a, q) => a + Number(q.total || 0), 0)
    const revWon = won.reduce((a, q) => a + Number(q.total || 0), 0)
    const ticket = won.length ? revWon / won.length : 0
    const conv = closed ? won.length / closed * 100 : 0
    const biggest = quotes.reduce((m, q) => Number(q.total || 0) > Number(m?.total || 0) ? q : m, null)
    const clients = new Set(quotes.map((q) => q.contact_id).filter(Boolean)).size
    return { today: quotes.filter(isToday).length, open: open.length, won: won.length, lost: lost.length, revForecast, revWon, ticket, conv, biggest, clients, openList: open }
  }, [quotes])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Orçamentos hoje" v={String(s.today)} icon="tag" accent="champ" />
        <KPI label="Aguardando aprovação" v={String(s.open)} icon="clock" accent="gold" hint={brl0(s.revForecast) + ' previstos'} />
        <KPI label="Aprovados" v={String(s.won)} icon="check" accent="sage" hint={brl0(s.revWon) + ' fechados'} />
        <KPI label="Perdidos" v={String(s.lost)} icon="x" accent="rose" />
        <KPI label="Receita prevista" v={brl0(s.revForecast)} icon="chart" accent="champ" />
        <KPI label="Conversão" v={pct(s.conv)} icon="spark" accent="sage" />
        <KPI label="Ticket médio" v={brl0(s.ticket)} icon="tag" accent="gold" />
        <KPI label="Clientes ativos" v={String(s.clients)} icon="user" accent="copper" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Aguardando aprovação</p>
            <button onClick={onGoList} className="text-admin-muted/50 hover:text-admin-champ text-xs">ver todos →</button>
          </div>
          {s.openList.length === 0 ? <p className="text-admin-muted/40 text-sm py-6 text-center">Nenhum orçamento em aberto.</p>
            : <div className="space-y-2">{s.openList.slice(0, 6).map((q) => <QuoteRow key={q.id} q={q} onOpen={onOpen} compact />)}</div>}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Maior proposta</p>
          {s.biggest ? (
            <button onClick={() => onOpen(s.biggest)} className="text-left w-full">
              <p className="font-serif text-3xl text-admin-gold">{brl0(s.biggest.total)}</p>
              <p className="text-admin-text text-sm mt-1 truncate">{s.biggest.title}</p>
              <p className="text-admin-muted/40 text-xs">{s.biggest.contact?.name || s.biggest.deal?.title || '—'}</p>
            </button>
          ) : <p className="text-admin-muted/40 text-sm">—</p>}
        </div>
      </div>
    </div>
  )
}
function KPI({ label, v, icon, accent, hint }) {
  const tone = { champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', rose: 'text-admin-rose', copper: 'text-admin-copper' }[accent]
  const bg = { champ: 'bg-admin-champ/10', gold: 'bg-admin-gold/10', sage: 'bg-admin-sage/10', rose: 'bg-admin-rose/10', copper: 'bg-admin-copper/10' }[accent]
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">{label}</p><p className={`text-2xl font-medium ${tone} tabular-nums leading-none`}>{v}</p>{hint && <p className="text-admin-muted/40 text-[11px] mt-1.5">{hint}</p>}</div>
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon name={icon} className={`w-4 h-4 ${tone}`} /></div>
      </div>
    </div>
  )
}

// ---------------- LISTA ----------------
function QuoteList({ quotes, onOpen }) {
  const [q, setQ] = useState(''); const [fStatus, setFStatus] = useState('')
  const filtered = quotes.filter((x) => {
    if (fStatus && x.status !== fStatus) return false
    const term = q.trim().toLowerCase()
    if (term && !`${x.number} ${x.title} ${x.contact?.name || ''}`.toLowerCase().includes(term)) return false
    return true
  })
  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="w-4 h-4 text-admin-muted/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, título ou cliente…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" />
        </div>
        <div className="w-48"><GlassSelect value={fStatus} onChange={setFStatus} options={[{ value: '', label: 'Todos os status' }, ...Object.entries(STATUS).map(([value, x]) => ({ value, label: x[0] }))]} /></div>
      </div>
      {filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="tag" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhum orçamento.</p></div>
        : <div className="space-y-2">{filtered.map((qt) => <QuoteRow key={qt.id} q={qt} onOpen={onOpen} />)}</div>}
    </div>
  )
}
function QuoteRow({ q, onOpen, compact }) {
  const st = STATUS[q.status] || STATUS.draft
  return (
    <button onClick={() => onOpen(q)} className="w-full glass rounded-xl px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap"><span className="text-admin-muted/40 text-xs tabular-nums">{q.number}</span><p className="text-admin-text text-sm font-medium truncate">{q.title}</p><span className={`text-[9px] px-2 py-0.5 rounded-lg ${st[1]}`}>{st[0]}</span></div>
        <p className="text-admin-muted/40 text-xs mt-0.5">{q.contact?.name || q.deal?.title || 'Sem cliente'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-admin-gold text-sm">{brl(q.total)}</p>
        {!compact && q.margin != null && <p className="text-admin-muted/40 text-[10px]">margem {pct(q.margin)}</p>}
      </div>
    </button>
  )
}

// ---------------- EDITOR (3 colunas) ----------------
function QuoteEditor({ editing, setEditing, items, setItems, dirty, setDirty, mayEdit, tenantId, profile, notify, reload }) {
  const eng = editing.metadata?.engine || { commission_pct: 0, extra_tax_pct: 0, freight: 0, packaging: 0, target_margin: 0 }
  const setEng = (patch) => { setEditing((q) => ({ ...q, metadata: { ...(q.metadata || {}), engine: { ...eng, ...patch } } })); setDirty(true) }
  const inst = editing.metadata?.installments || 1
  const setInst = (n) => { setEditing((q) => ({ ...q, metadata: { ...(q.metadata || {}), installments: n } })); setDirty(true) }

  // ----- CENÁRIOS -----
  // Cenários extras ficam em metadata.scenarios; o cenário ATIVO usa os `items` reais (quote_items).
  const scenarios = editing.metadata?.scenarios || []
  const activeScen = editing.metadata?.active_scenario || 'principal'
  const scenList = [{ key: 'principal', name: 'Principal', tone: 'champ' }, ...scenarios.map((s) => ({ key: s.key, name: s.name, tone: s.tone || 'sage' }))]
  const stashActive = (q) => {
    // guarda os itens/engine atuais no cenário ativo (se não for principal, guarda em metadata)
    if (activeScen === 'principal') return q
    const scs = (q.metadata?.scenarios || []).map((s) => s.key === activeScen ? { ...s, items, engine: eng } : s)
    return { ...q, metadata: { ...(q.metadata || {}), scenarios: scs } }
  }
  const switchScen = (key) => {
    if (key === activeScen) return
    // salva o cenário atual em memória e carrega o novo
    let q = stashActive(editing)
    if (key === 'principal') {
      // itens principais ficam separados em metadata.principal (para não perder ao trocar)
      const saved = q.metadata?.principal
      q = { ...q, metadata: { ...(q.metadata || {}), active_scenario: 'principal' } }
      setEditing(q); setItems(saved?.items || items); if (saved?.engine) q.metadata.engine = saved.engine
    } else {
      // ao sair do principal, preserva-o
      if (activeScen === 'principal') q = { ...q, metadata: { ...(q.metadata || {}), principal: { items, engine: eng } } }
      const sc = (q.metadata?.scenarios || []).find((s) => s.key === key)
      q = { ...q, metadata: { ...(q.metadata || {}), active_scenario: key, engine: sc?.engine || eng } }
      setEditing(q); setItems(sc?.items || [emptyItem()])
    }
    setDirty(true)
  }
  const addScenario = () => {
    const used = new Set(scenarios.map((s) => s.key))
    const preset = SCEN_PRESET.find((p) => !used.has(p.key)) || { key: 'cenario-' + (scenarios.length + 1), name: 'Cenário ' + (scenarios.length + 1), tone: 'copper' }
    const q = stashActive(editing)
    if (activeScen === 'principal') q.metadata = { ...(q.metadata || {}), principal: { items, engine: eng } }
    const sc = { key: preset.key, name: preset.name, tone: preset.tone, items: items.map((x) => ({ ...x })), engine: { ...eng } }
    setEditing({ ...q, metadata: { ...(q.metadata || {}), scenarios: [...scenarios, sc], active_scenario: preset.key } })
    setItems(sc.items); setDirty(true); notify?.(`Cenário "${preset.name}" criado (cópia do atual)`, 'success')
  }
  const renameScen = (key, name) => setEditing((q) => ({ ...q, metadata: { ...(q.metadata || {}), scenarios: (q.metadata?.scenarios || []).map((s) => s.key === key ? { ...s, name } : s) } }))
  const removeScen = (key) => {
    const q = { ...editing, metadata: { ...(editing.metadata || {}), scenarios: (editing.metadata?.scenarios || []).filter((s) => s.key !== key) } }
    if (activeScen === key) { q.metadata.active_scenario = 'principal'; setItems(q.metadata?.principal?.items || items) }
    setEditing(q); setDirty(true)
  }
  const [compareOpen, setCompareOpen] = useState(false)
  const allScenariosForCompare = useMemo(() => {
    const principal = activeScen === 'principal' ? { items, engine: eng } : (editing.metadata?.principal || { items: [], engine: {} })
    const list = [{ key: 'principal', name: 'Principal', tone: 'champ', ...principal }]
    scenarios.forEach((s) => list.push(s.key === activeScen ? { ...s, items, engine: eng } : s))
    return list.map((s) => ({ ...s, calc: computeQuote(s.items, s.engine) }))
  }, [editing, items, eng, scenarios, activeScen])

  const calc = useMemo(() => computeQuote(items, eng), [items, eng])

  const setItem = (i, patch) => { setItems((xs) => xs.map((r, j) => j === i ? { ...r, ...patch } : r)); setDirty(true) }
  const addItem = (kind) => { setItems((xs) => [...xs, { ...emptyItem(), kind: kind || 'product' }]); setDirty(true) }
  const removeItem = (i) => { setItems((xs) => xs.filter((_, j) => j !== i)); setDirty(true) }
  const [addOpen, setAddOpen] = useState(false)

  const save = async () => {
    await supabase.from('quote_items').delete().eq('quote_id', editing.id)
    const rows = items.filter((r) => r.name?.trim()).map((r, k) => ({
      tenant_id: tenantId, quote_id: editing.id, name: r.name, kind: r.kind, description: r.description || null, qty: Number(r.qty) || 0,
      unit_cost: Number(r.unit_cost) || 0, unit_price: Number(r.unit_price) || 0, discount: Number(r.discount) || 0,
      discount_type: r.discount_type, tax_rate: Number(r.tax_rate) || 0, sort_order: k,
    }))
    if (rows.length) await supabase.from('quote_items').insert(rows)
    // garante que o cenário ativo (itens/engine atuais) esteja gravado no metadata
    let meta = { ...(editing.metadata || {}), engine: eng }
    if (activeScen === 'principal') meta.principal = { items, engine: eng }
    else meta.scenarios = (meta.scenarios || []).map((s) => s.key === activeScen ? { ...s, items, engine: eng } : s)
    await supabase.from('quotes').update({ title: editing.title, valid_until: editing.valid_until || null, notes: editing.notes || null, metadata: meta, updated_at: new Date().toISOString() }).eq('id', editing.id)
    await supabase.rpc('recalc_quote', { p_quote: editing.id })
    logAudit({ action: 'update', resource_type: 'quotes', resource_id: editing.id, new_data: { items: rows.length } }, tenantId)
    setDirty(false); notify('Orçamento salvo', 'success')
    const { data } = await supabase.from('quotes').select('*, contact:contacts(name), deal:deals(title)').eq('id', editing.id).single()
    if (data) setEditing((q) => ({ ...data, metadata: q.metadata || data.metadata }))
    reload()
  }
  const setStatus = async (status) => {
    await supabase.from('quotes').update({ status }).eq('id', editing.id)
    setEditing((q) => ({ ...q, status })); reload(); notify('Status atualizado', 'success')
    if (status === 'accepted' && editing.deal_id) {
      await supabase.from('deals').update({ stage: 'won', status: 'won', value: calc.total, closed_at: new Date().toISOString() }).eq('id', editing.deal_id)
      await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: editing.deal_id, type: 'quote', title: 'Orçamento aprovado', body: `${editing.number} — ${brl(calc.total)}` }).catch(() => {})
    }
  }
  const exportQuotePdf = () => {
    const rows = [...items.filter((r) => r.name?.trim()).map((r) => ({ item: r.name, qtd: r.qty, preco: brl(r.unit_price), total: brl((r.qty * r.unit_price)) })), { item: '— TOTAL —', qtd: '', preco: '', total: brl(calc.total) }]
    exportPdf(`Orçamento ${editing.number}`, rows, editing.title)
  }
  const st = STATUS[editing.status] || STATUS.draft
  const tbtn = 'h-8 px-2.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors'

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] min-h-[560px]">
      {/* toolbar comercial */}
      <div className="flex items-center gap-1.5 px-2 py-2 glass rounded-2xl mb-3 flex-wrap">
        <button onClick={() => { setEditing(null); reload() }} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="x" className="w-3.5 h-3.5" />Fechar</button>
        <span className="text-admin-muted/40 text-xs tabular-nums px-1">{editing.number}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-lg ${st[1]}`}>{st[0]}</span>
        <div className="mx-auto" />
        {scenList.length > 1 && <button onClick={() => setCompareOpen(true)} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="layers" className="w-3.5 h-3.5" />Comparar</button>}
        <button onClick={exportQuotePdf} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="chart" className="w-3.5 h-3.5" />PDF</button>
        {mayEdit && <ConvertMenu editing={editing} calc={calc} items={items} scenarios={allScenariosForCompare} tenantId={tenantId} notify={notify} onStatus={setStatus} />}
        {mayEdit && dirty && <button onClick={save} className={`${tbtn} bg-admin-sage/20 text-admin-sage`}><Icon name="check" className="w-3.5 h-3.5" />Salvar</button>}
        {mayEdit && <div className="w-40"><GlassSelect value={editing.status} onChange={setStatus} options={Object.entries(STATUS).map(([value, x]) => ({ value, label: x[0] }))} /></div>}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-3 overflow-hidden">
        {/* ESQUERDA — Cliente / CRM */}
        <div className="glass rounded-2xl p-4 overflow-y-auto hidden lg:block">
          <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Cliente & negócio</p>
          <div className="space-y-3">
            <Info label="Cliente" v={editing.contact?.name || '—'} />
            <Info label="Negócio" v={editing.deal?.title || '—'} />
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Validade</label><GlassDate value={editing.valid_until || ''} onChange={(v) => { setEditing((q) => ({ ...q, valid_until: v || null })); setDirty(true) }} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Observações</label><textarea value={editing.notes || ''} onChange={(e) => { setEditing((q) => ({ ...q, notes: e.target.value })); setDirty(true) }} rows={4} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none resize-none" placeholder="Notas internas / condições" /></div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">Timeline</p>
            <Timeline status={editing.status} />
          </div>
        </div>

        {/* CENTRO — itens */}
        <div className="overflow-y-auto pr-1">
          {/* barra de cenários */}
          <div className="glass rounded-2xl p-2 mb-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-admin-muted/40 px-1.5">Cenários</span>
            {scenList.map((s) => {
              const active = s.key === activeScen
              const tone = { champ: 'text-admin-champ', sage: 'text-admin-sage', gold: 'text-admin-gold', copper: 'text-admin-copper' }[s.tone] || 'text-admin-champ'
              return (
                <div key={s.key} className={`flex items-center gap-1 rounded-lg pl-2.5 pr-1 py-1 ${active ? 'bg-white/[0.06]' : ''}`}>
                  <button onClick={() => switchScen(s.key)} className={`text-xs ${active ? tone : 'text-admin-muted/70 hover:text-admin-text'}`}>{s.name}</button>
                  {active && s.key !== 'principal' && mayEdit && <button onClick={() => removeScen(s.key)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button>}
                </div>
              )
            })}
            {mayEdit && scenList.length < 4 && <button onClick={addScenario} className="text-xs px-2 py-1 rounded-lg text-admin-champ hover:bg-admin-champ/10 flex items-center gap-1"><Icon name="plus" className="w-3 h-3" />Cenário</button>}
          </div>
          <div className="glass rounded-2xl p-5 mb-3">
            <input value={editing.title} onChange={(e) => { setEditing((q) => ({ ...q, title: e.target.value })); setDirty(true) }} className="w-full bg-transparent text-admin-text font-serif text-2xl outline-none" placeholder="Título da proposta" />
            {activeScen !== 'principal' && <p className="text-admin-muted/40 text-xs mt-1">Editando o cenário <span className="text-admin-champ">{scenList.find((s) => s.key === activeScen)?.name}</span>. O cenário Principal é o que vira proposta/fatura ao salvar.</p>}
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Itens ({items.length})</p>
              {mayEdit && <div className="relative">
                <button onClick={() => setAddOpen((o) => !o)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 flex items-center gap-1"><Icon name="plus" className="w-3 h-3" />Adicionar</button>
                {addOpen && (
                  <div className="absolute right-0 mt-1 z-20 glass-pop rounded-xl p-2 grid grid-cols-2 gap-1 w-64" onMouseLeave={() => setAddOpen(false)}>
                    {Object.entries(KIND).map(([k, l]) => <button key={k} onClick={() => { addItem(k); setAddOpen(false) }} className="text-[11px] px-2 py-1.5 rounded-lg text-admin-muted/80 hover:text-admin-champ hover:bg-admin-champ/10 text-left">{l}</button>)}
                  </div>
                )}
              </div>}
            </div>
            {items.length === 0 ? <p className="text-admin-muted/30 text-sm text-center py-8">Adicione itens ao orçamento.</p> : (
              <div className="space-y-3">
                {items.map((r, i) => {
                  const gross = (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
                  const d = r.discount_type === 'amount' ? (Number(r.discount) || 0) : gross * (Number(r.discount) || 0) / 100
                  const lineTotal = Math.max(gross - d, 0) * (1 + (Number(r.tax_rate) || 0) / 100)
                  const lineMargin = r.unit_price > 0 ? (r.unit_price - r.unit_cost) / r.unit_price * 100 : 0
                  return (
                    <div key={i} className="glass-soft rounded-xl p-3">
                      <div className="flex gap-2 mb-2">
                        <input value={r.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Descrição do item" className="flex-1 glass-input rounded-lg px-3 py-2 text-sm text-admin-text outline-none" />
                        <div className="w-32 shrink-0"><GlassSelect value={r.kind} onChange={(v) => setItem(i, { kind: v })} options={Object.entries(KIND).map(([value, label]) => ({ value, label }))} /></div>
                        {mayEdit && <button onClick={() => removeItem(i)} className="text-admin-muted/40 hover:text-admin-rose px-1"><Icon name="x" className="w-4 h-4" /></button>}
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <NumField label="Qtd" v={r.qty} on={(v) => setItem(i, { qty: v })} />
                        <NumField label="Custo un." v={r.unit_cost} on={(v) => setItem(i, { unit_cost: v })} />
                        <NumField label="Preço un." v={r.unit_price} on={(v) => setItem(i, { unit_price: v })} />
                        <div>
                          <label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-0.5">Desc.</label>
                          <div className="flex">
                            <input type="number" value={r.discount} onChange={(e) => setItem(i, { discount: e.target.value })} className="w-full glass-input rounded-l-lg px-2 py-1.5 text-sm text-admin-text outline-none" />
                            <button onClick={() => setItem(i, { discount_type: r.discount_type === 'percent' ? 'amount' : 'percent' })} className="px-2 rounded-r-lg bg-white/[0.05] text-admin-champ text-xs shrink-0">{r.discount_type === 'percent' ? '%' : 'R$'}</button>
                          </div>
                        </div>
                        <NumField label="Imposto %" v={r.tax_rate} on={(v) => setItem(i, { tax_rate: v })} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] ${lineMargin < 0 ? 'text-admin-rose' : 'text-admin-muted/40'}`}>margem {pct(lineMargin)}</span>
                        <p className="text-admin-gold text-sm">{brl(lineTotal)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* DIREITA — Motor financeiro */}
        <div className="overflow-y-auto">
          <div className="glass rounded-2xl p-5 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Motor financeiro</p>
            <Row label="Subtotal" v={brl(calc.sub)} />
            <Row label="Descontos" v={`− ${brl(calc.disc)}`} muted />
            <Row label="Impostos (itens)" v={`+ ${brl(calc.tax)}`} muted />
            {calc.extras > 0 && <Row label="Frete + embalagem" v={`+ ${brl(calc.extras)}`} muted />}
            <div className="border-t border-white/[0.08] my-3" />
            <div className="flex items-center justify-between mb-3"><span className="text-admin-text">Total</span><span className="text-admin-gold text-2xl font-medium">{brl(calc.total)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Custo total" v={brl(calc.fullCost)} tone="muted" />
              <Stat label="Lucro" v={brl(calc.profit)} tone={calc.profit >= 0 ? 'sage' : 'rose'} />
              <Stat label="Margem" v={pct(calc.margin)} tone={calc.margin >= 0 ? 'sage' : 'rose'} />
              <Stat label="Markup" v={pct(calc.markup)} tone="gold" />
            </div>
            {calc.margin < 0 && <p className="text-admin-rose text-xs mt-3 bg-admin-rose/10 rounded-lg px-3 py-2">⚠ Prejuízo: o preço está abaixo do custo total.</p>}
          </div>

          {/* engenharia de preço */}
          <div className="glass rounded-2xl p-5 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Engenharia de preço</p>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Comissão %" v={eng.commission_pct} on={(v) => setEng({ commission_pct: v })} />
              <NumField label="Impostos extra %" v={eng.extra_tax_pct} on={(v) => setEng({ extra_tax_pct: v })} />
              <NumField label="Frete (R$)" v={eng.freight} on={(v) => setEng({ freight: v })} />
              <NumField label="Embalagem (R$)" v={eng.packaging} on={(v) => setEng({ packaging: v })} />
              <NumField label="Margem-alvo %" v={eng.target_margin} on={(v) => setEng({ target_margin: v })} />
            </div>
            <div className="glass-soft rounded-xl px-4 py-3 mt-3 flex items-center justify-between">
              <span className="text-admin-muted/60 text-xs">Preço ideal (margem-alvo)</span>
              <span className="text-admin-champ font-medium">{brl(calc.idealPrice)}</span>
            </div>
            {calc.idealPrice > calc.total + 1 && <p className="text-admin-gold/70 text-[11px] mt-2">Para bater a margem-alvo, o total deveria ser {brl(calc.idealPrice)} ({brl(calc.idealPrice - calc.total)} a mais).</p>}
          </div>

          {/* parcelamento */}
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Parcelamento</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[1, 2, 3, 6, 12].map((n) => <button key={n} onClick={() => setInst(n)} className={`px-3 py-1.5 rounded-lg text-xs ${inst === n ? 'bg-admin-champ/20 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/70 hover:text-admin-text'}`}>{n === 1 ? 'À vista' : `${n}x`}</button>)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-muted/60 text-sm">{inst === 1 ? 'À vista / PIX' : `${inst}x de`}</span>
              <span className="text-admin-text text-lg font-medium">{brl(calc.total / inst)}</span>
            </div>
          </div>
        </div>
      </div>

      {compareOpen && <CompareModal scenarios={allScenariosForCompare} onClose={() => setCompareOpen(false)} onPick={(key) => { setCompareOpen(false); switchScen(key) }} />}
    </div>
  )
}

// comparativo de cenários lado a lado (como o cliente verá)
function CompareModal({ scenarios, onClose, onPick }) {
  const list = scenarios.filter((s) => (s.items || []).some((i) => i.name))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Comparar cenários</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {list.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Adicione itens aos cenários para comparar.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((s) => {
              const tone = { champ: 'text-admin-champ border-admin-champ/40', sage: 'text-admin-sage border-admin-sage/40', gold: 'text-admin-gold border-admin-gold/40', copper: 'text-admin-copper border-admin-copper/40' }[s.tone] || 'text-admin-champ border-admin-champ/40'
              return (
                <div key={s.key} className={`glass rounded-2xl p-5 border ${tone.split(' ')[1]}`}>
                  <p className={`text-[11px] uppercase tracking-wider ${tone.split(' ')[0]} mb-1`}>{s.name}</p>
                  <p className="font-serif text-3xl text-admin-text mb-3">{brl0(s.calc.total)}</p>
                  <div className="space-y-1.5 mb-3">
                    {(s.items || []).filter((i) => i.name).slice(0, 6).map((it, i) => (
                      <div key={i} className="flex justify-between text-xs"><span className="text-admin-muted/60 truncate mr-2">{it.qty}× {it.name}</span><span className="text-admin-muted/50 shrink-0">{brl0(it.qty * it.unit_price)}</span></div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-admin-muted/40 border-t border-white/[0.06] pt-2">
                    <span>margem {pct(s.calc.margin)}</span><span>lucro {brl0(s.calc.profit)}</span>
                  </div>
                  <button onClick={() => onPick(s.key)} className="w-full mt-3 text-xs py-2 rounded-xl bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Editar este</button>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-admin-muted/40 text-[11px] mt-5">Na proposta pública, o cliente vê estes cenários lado a lado e escolhe um. O cenário Principal é o padrão.</p>
      </div>
    </div>
  )
}

// menu "Converter em…"
function ConvertMenu({ editing, calc, items, scenarios, tenantId, notify, onStatus }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const tbtn = 'h-8 px-2.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors'
  const multiScen = (scenarios || []).filter((s) => (s.items || []).some((i) => i.name)).length > 1

  const toProposal = async () => {
    setBusy(true)
    const blocks = [
      { type: 'cover', eyebrow: 'Proposta Comercial', title: editing.title || '{{title}}', subtitle: 'Preparado para {{client}}' },
      { type: 'heading', text: 'Escopo' },
      { type: 'text', text: items.filter((i) => i.name).map((i) => `• ${i.name}`).join('\n') || 'Itens da proposta.' },
    ]
    // se houver cenários, o cliente escolhe entre eles; senão, tabela única
    const scenData = multiScen ? scenarios.filter((s) => (s.items || []).some((i) => i.name)).map((s) => ({
      key: s.key, name: s.name, tone: s.tone, total: s.calc.total,
      items: (s.items || []).filter((i) => i.name).map((i) => ({ name: i.name, qty: i.qty, total: i.qty * i.unit_price })),
    })) : null
    if (scenData) blocks.push({ type: 'scenarios', title: 'Escolha sua opção' })
    else blocks.push({ type: 'quote_table', title: 'Investimento' })
    blocks.push({ type: 'terms', title: 'Termos', text: 'Validade e condições conforme orçamento ' + editing.number + '.' })

    const slug = (editing.title || 'proposta').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 7)
    const { error } = await supabase.from('documents').insert({
      tenant_id: tenantId, title: editing.title, slug, status: 'draft', quote_id: editing.id, contact_id: editing.contact_id,
      blocks, data: { client: editing.contact?.name || '', items: items.filter((i) => i.name).map((i) => ({ name: i.name, qty: i.qty, total: (i.qty * i.unit_price) })), total: calc.total, scenarios: scenData },
    }).select('id').single()
    setBusy(false); setOpen(false)
    if (error) return notify('Erro ao gerar proposta: ' + error.message, 'error')
    notify(multiScen ? 'Proposta com cenários criada no Document Studio' : 'Proposta criada no Document Studio', 'success')
  }
  const toInvoice = async () => {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('stripe-subscription', { body: {} }).catch(() => ({ error: true }))
    setBusy(false); setOpen(false)
    notify('Para faturar, abra a proposta no Document Studio e use "Emitir fatura" (requer Stripe conectado).', 'info')
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy} className={`${tbtn} bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 disabled:opacity-50`}><Icon name="spark" className="w-3.5 h-3.5" />{busy ? '…' : 'Converter'}</button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 glass-pop rounded-xl p-1.5 w-60" onMouseLeave={() => setOpen(false)}>
          <MenuItem icon="book" title="Proposta (Document Studio)" desc="Documento premium para assinar" onClick={toProposal} />
          <MenuItem icon="pen" title="Solicitar assinatura" desc="Crie a proposta e envie para assinar" onClick={() => { toProposal(); notify('Proposta criada — abra em Document Studio › Assinaturas.', 'info') }} />
          <MenuItem icon="chart" title="Fatura / cobrança" desc="Gera a cobrança do cliente" onClick={toInvoice} />
          <MenuItem icon="check" title="Marcar como aprovado" desc="Fecha o negócio no CRM" onClick={() => { onStatus('accepted'); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}
function MenuItem({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-white/[0.05]">
      <Icon name={icon} className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
      <div><p className="text-admin-text text-xs font-medium">{title}</p><p className="text-admin-muted/40 text-[10px]">{desc}</p></div>
    </button>
  )
}

function Timeline({ status }) {
  const steps = [['draft', 'Criado'], ['sent', 'Enviado'], ['viewed', 'Visualizado'], ['negotiating', 'Negociando'], ['accepted', 'Aprovado']]
  const order = ['draft', 'sent', 'viewed', 'negotiating', 'accepted']
  const cur = order.indexOf(status === 'rejected' ? 'negotiating' : status)
  return (
    <div className="space-y-2">
      {steps.map(([k, l], i) => {
        const done = i <= cur
        return (
          <div key={k} className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${done ? 'bg-admin-champ' : 'bg-white/15'}`} />
            <span className={`text-xs ${done ? 'text-admin-text/80' : 'text-admin-muted/40'}`}>{l}</span>
          </div>
        )
      })}
      {status === 'rejected' && <div className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-full bg-admin-rose" /><span className="text-xs text-admin-rose">Perdido</span></div>}
    </div>
  )
}

function NumField({ label, v, on }) {
  return <div><label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-0.5">{label}</label><input type="number" value={v ?? 0} onChange={(e) => on(e.target.value)} className="w-full glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none" /></div>
}
function Info({ label, v }) { return <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-0.5">{label}</label><p className="text-admin-text text-sm">{v}</p></div> }
function Row({ label, v, muted }) { return <div className="flex items-center justify-between py-1"><span className={`text-sm ${muted ? 'text-admin-muted/50' : 'text-admin-muted/70'}`}>{label}</span><span className={`text-sm ${muted ? 'text-admin-muted/50' : 'text-admin-text'}`}>{v}</span></div> }
function Stat({ label, v, tone }) {
  const c = { sage: 'text-admin-sage', rose: 'text-admin-rose', gold: 'text-admin-gold', muted: 'text-admin-muted/60' }[tone] || 'text-admin-text'
  return <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">{label}</p><p className={`text-base font-medium ${c}`}>{v}</p></div>
}
