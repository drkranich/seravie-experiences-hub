import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { exportPdf } from '../../lib/export'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const STATUS = { draft: ['Rascunho', 'bg-admin-gold/10 text-admin-gold'], sent: ['Enviado', 'bg-admin-champ/10 text-admin-champ'], accepted: ['Aceito', 'bg-admin-sage/10 text-admin-sage'], rejected: ['Recusado', 'bg-admin-rose/10 text-admin-rose'], expired: ['Expirado', 'bg-white/[0.05] text-admin-muted/50'] }
const KIND = { product: 'Produto', service: 'Serviço', hour: 'Hora técnica', combo: 'Combo/Kit', fee: 'Taxa/Frete' }
const emptyItem = () => ({ _new: true, name: '', kind: 'product', qty: 1, unit_cost: 0, unit_price: 0, discount: 0, discount_type: 'percent', tax_rate: 0 })

export function QuoteStudio({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)     // orçamento aberto
  const [items, setItems] = useState([])
  const [dirty, setDirty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deals, setDeals] = useState([])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('quotes').select('*, contact:contacts(name), deal:deals(title)').order('created_at', { ascending: false }).limit(200)
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

  // cálculo em tempo real no cliente (espelha recalc_quote do banco)
  const calc = useMemo(() => {
    let sub = 0, disc = 0, tax = 0, cost = 0
    items.forEach((r) => {
      const gross = (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
      const d = r.discount_type === 'amount' ? (Number(r.discount) || 0) : gross * (Number(r.discount) || 0) / 100
      const net = Math.max(gross - d, 0)
      const t = net * (Number(r.tax_rate) || 0) / 100
      sub += gross; disc += d; tax += t; cost += (Number(r.qty) || 0) * (Number(r.unit_cost) || 0)
    })
    const total = sub - disc + tax
    const profit = total - cost
    return { sub, disc, tax, cost, total, profit, margin: total > 0 ? profit / total * 100 : 0, markup: cost > 0 ? profit / cost * 100 : 0 }
  }, [items])

  const setItem = (i, patch) => { setItems((xs) => xs.map((r, j) => j === i ? { ...r, ...patch } : r)); setDirty(true) }
  const addItem = () => { setItems((xs) => [...xs, emptyItem()]); setDirty(true) }
  const removeItem = (i) => { setItems((xs) => xs.filter((_, j) => j !== i)); setDirty(true) }

  const saveItems = async () => {
    if (!editing) return
    // apaga e regrava (simples e consistente para poucos itens)
    await supabase.from('quote_items').delete().eq('quote_id', editing.id)
    const rows = items.filter((r) => r.name?.trim()).map((r, k) => ({
      tenant_id: tenantId, quote_id: editing.id, name: r.name, kind: r.kind, qty: Number(r.qty) || 0,
      unit_cost: Number(r.unit_cost) || 0, unit_price: Number(r.unit_price) || 0, discount: Number(r.discount) || 0,
      discount_type: r.discount_type, tax_rate: Number(r.tax_rate) || 0, sort_order: k,
    }))
    if (rows.length) await supabase.from('quote_items').insert(rows)
    await supabase.rpc('recalc_quote', { p_quote: editing.id })
    logAudit({ action: 'update', resource_type: 'quotes', resource_id: editing.id, new_data: { items: rows.length } }, tenantId)
    setDirty(false); notify('Orçamento salvo', 'success')
    const { data } = await supabase.from('quotes').select('*, contact:contacts(name), deal:deals(title)').eq('id', editing.id).single()
    setEditing(data); load()
  }

  const setStatus = async (status) => {
    await supabase.from('quotes').update({ status }).eq('id', editing.id)
    setEditing((q) => ({ ...q, status })); load(); notify('Status atualizado', 'success')
    // se aceito e ligado a um negócio, move o negócio para "fechado"
    if (status === 'accepted' && editing.deal_id) {
      await supabase.from('deals').update({ stage: 'won', status: 'won', value: calc.total, closed_at: new Date().toISOString() }).eq('id', editing.deal_id)
      await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: editing.deal_id, type: 'quote', title: 'Orçamento aceito', body: `${editing.number} — ${brl(calc.total)}` })
    }
  }

  const setField = async (patch) => { await supabase.from('quotes').update(patch).eq('id', editing.id); setEditing((q) => ({ ...q, ...patch })); load() }

  const exportQuotePdf = () => {
    const rows = [
      ...items.filter((r) => r.name?.trim()).map((r) => ({ item: r.name, qtd: r.qty, preco: brl(r.unit_price), total: brl((r.qty * r.unit_price) - (r.discount_type === 'amount' ? r.discount : r.qty * r.unit_price * r.discount / 100)) })),
      { item: '— TOTAL —', qtd: '', preco: '', total: brl(calc.total) },
    ]
    exportPdf(`Orçamento ${editing.number}`, rows, editing.title)
  }

  const StatusBadge = ({ s }) => { const x = STATUS[s] || STATUS.draft; return <span className={`text-[9px] px-2 py-0.5 rounded-lg ${x[1]}`}>{x[0]}</span> }

  // ---- LISTA ----
  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="font-serif text-4xl text-admin-text">Quote Studio</h1><p className="text-admin-muted/60 text-sm mt-1">Orçamentos, precificação e propostas — a partir dos leads do pipeline</p></div>
          {mayEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo orçamento</button>}
        </div>

        {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p> : quotes.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="tag" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhum orçamento ainda.</p><p className="text-admin-muted/30 text-xs mt-1">Crie um do zero ou a partir de um negócio do pipeline.</p></div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <button key={q.id} onClick={() => openQuote(q)} className="w-full glass rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-admin-muted/40 text-xs">{q.number}</span><p className="text-admin-text text-sm font-medium truncate">{q.title}</p><StatusBadge s={q.status} /></div>
                  <p className="text-admin-muted/40 text-xs mt-0.5">{q.contact?.name || q.deal?.title || 'Sem cliente'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-admin-gold text-sm">{brl(q.total)}</p>
                  {q.margin != null && <p className="text-admin-muted/40 text-[10px]">margem {pct(q.margin)}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreating(false)}>
            <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Novo orçamento</h2><button onClick={() => setCreating(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
              <button onClick={() => createQuote(null)} className="w-full glass-soft rounded-xl px-4 py-3 text-left hover:bg-white/[0.04] mb-3"><p className="text-admin-text text-sm">Em branco</p><p className="text-admin-muted/40 text-xs">Começar do zero</p></button>
              <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-2">A partir de um negócio</p>
              {deals.length === 0 ? <p className="text-admin-muted/40 text-xs">Nenhum negócio no pipeline.</p> : (
                <div className="space-y-1.5">
                  {deals.map((d) => (
                    <button key={d.id} onClick={() => createQuote(d)} className="w-full glass-soft rounded-xl px-4 py-2.5 text-left hover:bg-white/[0.04]"><p className="text-admin-text text-sm truncate">{d.title}</p>{d.value > 0 && <p className="text-admin-gold text-xs">{brl(d.value)}</p>}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- EDITOR ----
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditing(null); load() }} className="text-[11px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-champ">← Orçamentos</button>
          <span className="text-admin-muted/40 text-xs">{editing.number}</span>
          <StatusBadge s={editing.status} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportQuotePdf} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">PDF</button>
          {mayEdit && dirty && <button onClick={saveItems} className="text-xs px-4 py-2 rounded-xl bg-admin-sage/15 text-admin-sage hover:bg-admin-sage/25">Salvar</button>}
          {mayEdit && <GlassSelect value={editing.status} onChange={setStatus} options={Object.entries(STATUS).map(([value, x]) => ({ value, label: x[0] }))} />}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* Itens */}
        <div>
          <div className="glass rounded-2xl p-5 mb-4">
            <input value={editing.title} onChange={(e) => setEditing((q) => ({ ...q, title: e.target.value }))} onBlur={(e) => setField({ title: e.target.value })} className="w-full bg-transparent text-admin-text font-serif text-xl outline-none border-b border-white/[0.06] pb-2" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Cliente</label><p className="text-admin-text text-sm">{editing.contact?.name || '—'}</p></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Validade</label><input type="date" defaultValue={editing.valid_until || ''} onBlur={(e) => setField({ valid_until: e.target.value || null })} className="glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none" /></div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3"><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Itens</p>{mayEdit && <button onClick={addItem} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">+ Item</button>}</div>
            {items.length === 0 ? <p className="text-admin-muted/30 text-sm text-center py-8">Adicione itens ao orçamento.</p> : (
              <div className="space-y-3">
                {items.map((r, i) => {
                  const gross = (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
                  const d = r.discount_type === 'amount' ? (Number(r.discount) || 0) : gross * (Number(r.discount) || 0) / 100
                  const lineTotal = Math.max(gross - d, 0) * (1 + (Number(r.tax_rate) || 0) / 100)
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
                      <p className="text-right text-admin-gold text-sm mt-2">{brl(lineTotal)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resumo de precificação */}
        <div className="lg:sticky lg:top-4 self-start">
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-4">Precificação</p>
            <Row label="Subtotal" v={brl(calc.sub)} />
            <Row label="Descontos" v={`− ${brl(calc.disc)}`} muted />
            <Row label="Impostos" v={`+ ${brl(calc.tax)}`} muted />
            <div className="border-t border-white/[0.08] my-3" />
            <div className="flex items-center justify-between mb-3"><span className="text-admin-text">Total</span><span className="text-admin-gold text-2xl font-medium">{brl(calc.total)}</span></div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Stat label="Custo total" v={brl(calc.cost)} tone="muted" />
              <Stat label="Lucro" v={brl(calc.profit)} tone={calc.profit >= 0 ? 'sage' : 'rose'} />
              <Stat label="Margem" v={pct(calc.margin)} tone={calc.margin >= 0 ? 'sage' : 'rose'} />
              <Stat label="Markup" v={pct(calc.markup)} tone="gold" />
            </div>

            {calc.margin < 0 && <p className="text-admin-rose text-xs mt-3 bg-admin-rose/10 rounded-lg px-3 py-2">⚠ Prejuízo: o preço está abaixo do custo.</p>}
            {editing.deal_id && <p className="text-admin-muted/40 text-[11px] mt-3">Vinculado a um negócio no pipeline. Ao marcar "Aceito", o negócio é fechado automaticamente.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function NumField({ label, v, on }) {
  return (
    <div>
      <label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-0.5">{label}</label>
      <input type="number" value={v} onChange={(e) => on(e.target.value)} className="w-full glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none" />
    </div>
  )
}
function Row({ label, v, muted }) { return <div className="flex items-center justify-between py-1"><span className={`text-sm ${muted ? 'text-admin-muted/50' : 'text-admin-muted/70'}`}>{label}</span><span className={`text-sm ${muted ? 'text-admin-muted/50' : 'text-admin-text'}`}>{v}</span></div> }
function Stat({ label, v, tone }) {
  const c = { sage: 'text-admin-sage', rose: 'text-admin-rose', gold: 'text-admin-gold', muted: 'text-admin-muted/60' }[tone] || 'text-admin-text'
  return <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">{label}</p><p className={`text-base font-medium ${c}`}>{v}</p></div>
}
