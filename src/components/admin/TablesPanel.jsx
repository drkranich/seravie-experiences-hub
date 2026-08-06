import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS = { free: ['Livre', 'text-admin-sage', 'border-admin-sage/40'], occupied: ['Ocupada', 'text-admin-gold', 'border-admin-gold/50'], reserved: ['Reservada', 'text-admin-champ', 'border-admin-champ/40'], closing: ['Fechando', 'text-admin-rose', 'border-admin-rose/40'] }

// ---------- Salão: mapa de mesas + comandas ----------
function FloorTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tables, setTables] = useState([])
  const [tabs, setTabs] = useState([])
  const [products, setProducts] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null) // comanda aberta no drawer
  const [pick, setPick] = useState('')       // produto selecionado p/ adicionar
  const [qty, setQty] = useState(1)
  const [itemNote, setItemNote] = useState('')

  const load = async () => {
    const [{ data: tb }, { data: tp }, { data: pr }, { data: st }] = await Promise.all([
      supabase.from('tables').select('*').eq('active', true).order('sort_order').order('label'),
      supabase.from('tabs').select('*').eq('status', 'open'),
      supabase.from('products').select('id,name,price').eq('status', 'active').order('name').limit(500),
      supabase.from('kds_stations').select('id,name').eq('active', true).order('sort_order'),
    ])
    setTables(tb || []); setTabs(tp || []); setProducts(pr || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const tabOf = (tableId) => tabs.find((t) => t.table_id === tableId)
  const recalc = (items, service_fee_pct = 10, discount = 0) => {
    const subtotal = items.reduce((s, i) => s + (i.unit_price || 0) * (i.qty || 1), 0)
    const service_fee = Math.round(subtotal * (service_fee_pct / 100) * 100) / 100
    return { subtotal, service_fee, total: Math.max(0, subtotal + service_fee - discount) }
  }

  const openTab = async (table) => {
    const { data, error } = await supabase.from('tabs').insert({ tenant_id: tenantId, table_id: table.id, label: table.label, status: 'open', items: [] }).select('*').single()
    if (error) return notify('Erro ao abrir comanda', 'error')
    await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id)
    load(); setActive(data)
  }
  const addItem = async () => {
    if (!active || !pick) return
    const prod = products.find((p) => p.id === pick)
    if (!prod) return
    const items = [...(active.items || []), { product_id: prod.id, name: prod.name, qty: Number(qty) || 1, unit_price: Number(prod.price) || 0, notes: itemNote || null }]
    const totals = recalc(items)
    const { data } = await supabase.from('tabs').update({ items, ...totals }).eq('id', active.id).select('*').single()
    setActive(data); setPick(''); setQty(1); setItemNote(''); load()
    // dispara ticket na cozinha (estação padrão = primeira, se houver)
    await supabase.from('kds_tickets').insert({ tenant_id: tenantId, station_id: stations[0]?.id || null, order_id: active.id, source: 'tab', reference: active.label, items: [{ name: prod.name, qty: Number(qty) || 1, notes: itemNote || null }] })
    notify('Item adicionado e enviado à cozinha', 'success')
  }
  const removeItem = async (idx) => {
    const items = (active.items || []).filter((_, i) => i !== idx)
    const totals = recalc(items)
    const { data } = await supabase.from('tabs').update({ items, ...totals }).eq('id', active.id).select('*').single()
    setActive(data); load()
  }
  const closeTab = async () => {
    if (!active) return
    const totals = recalc(active.items || [])
    // gera pedido no PDV/orders
    await supabase.from('orders').insert({
      tenant_id: tenantId, status: 'completed', payment_status: 'pending',
      total: totals.total, items: active.items || [], customer_name: active.label,
      channel: 'salao', notes: `Comanda ${active.label}`,
    })
    await supabase.from('tabs').update({ status: 'closed', closed_at: new Date().toISOString(), ...totals }).eq('id', active.id)
    if (active.table_id) await supabase.from('tables').update({ status: 'free' }).eq('id', active.table_id)
    notify(`Comanda fechada · ${brl(totals.total)}`, 'success'); setActive(null); load()
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando salão…</p>

  return (
    <div>
      {tables.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhuma mesa cadastrada.</p><p className="text-admin-muted/30 text-xs mt-1">Crie mesas na aba "Mesas" para começar a operar o salão.</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tables.map((t) => {
            const tab = tabOf(t.id)
            const [label, color, border] = STATUS[tab ? 'occupied' : t.status] || STATUS.free
            return (
              <button key={t.id} onClick={() => tab ? setActive(tab) : openTab(t)}
                className={`glass rounded-2xl p-4 text-left border ${border} hover:bg-white/[0.05] transition-colors`}>
                <div className="flex items-center justify-between mb-1"><span className="text-admin-text font-medium">{t.label}</span><Icon name="user" className="w-3.5 h-3.5 text-admin-muted/40" /></div>
                <p className={`text-[11px] ${color}`}>{label}</p>
                {tab && <p className="text-admin-champ text-sm mt-2">{brl(tab.total)}</p>}
                {t.area && <p className="text-admin-muted/30 text-[10px] mt-1">{t.area}</p>}
              </button>
            )
          })}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="glass-pop w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">{active.label}</h2><button onClick={() => setActive(null)} className="text-admin-muted/40">✕</button></div>
            <div className="space-y-2 mb-4">
              {(active.items || []).length === 0 && <p className="text-admin-muted/30 text-sm text-center py-4">Comanda vazia — adicione itens.</p>}
              {(active.items || []).map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-admin-text/90"><span className="text-admin-champ">{it.qty}×</span> {it.name}{it.notes ? <span className="text-admin-gold/70 text-xs"> · {it.notes}</span> : ''}</span>
                  <div className="flex items-center gap-2"><span className="text-admin-champ">{brl(it.unit_price * it.qty)}</span><button onClick={() => removeItem(i)} className="text-admin-muted/40 hover:text-admin-rose text-xs">✕</button></div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-1 text-sm mb-4">
              <div className="flex justify-between text-admin-muted/60"><span>Subtotal</span><span>{brl(active.subtotal)}</span></div>
              <div className="flex justify-between text-admin-muted/60"><span>Serviço (10%)</span><span>{brl(active.service_fee)}</span></div>
              <div className="flex justify-between text-admin-text font-medium text-base"><span>Total</span><span className="text-admin-champ">{brl(active.total)}</span></div>
              {active.people > 1 && <div className="flex justify-between text-admin-muted/50 text-xs"><span>Por pessoa ({active.people})</span><span>{brl((active.total || 0) / active.people)}</span></div>}
            </div>
            <div className="glass rounded-xl p-3 mb-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-admin-muted/60">Adicionar item</p>
              <GlassSelect value={pick} onChange={setPick} placeholder="Escolher produto" options={products.map((p) => ({ value: p.id, label: `${p.name} · ${brl(p.price)}` }))} />
              <div className="flex gap-2">
                <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
                <input value={itemNote} onChange={(e) => setItemNote(e.target.value)} placeholder="Observação (ex: sem cebola)" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
                <button onClick={addItem} className="bg-admin-champ/15 text-admin-champ px-4 rounded-xl text-sm hover:bg-admin-champ/25">+</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={closeTab} className="flex-1 bg-admin-champ text-admin-ink py-3 rounded-xl text-sm font-medium">Fechar conta · {brl(active.total)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Cadastro de mesas ----------
function TablesTab({ notify }) {
  const { profile } = useTenant()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ label: '', area: '', seats: 2 })
  const load = async () => { const { data } = await supabase.from('tables').select('*').order('sort_order').order('label'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!form.label.trim()) return notify('Informe o nome da mesa', 'error')
    const { error } = await supabase.from('tables').insert({ label: form.label, area: form.area || null, seats: Number(form.seats) || 2, tenant_id: profile?.tenant_id })
    if (error) return notify('Erro ao criar', 'error')
    setForm({ label: '', area: '', seats: 2 }); load(); notify('Mesa criada', 'success')
  }
  const remove = async (r) => { if (confirm(`Remover "${r.label}"?`)) { await supabase.from('tables').delete().eq('id', r.id); load() } }
  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Mesa</label>
          <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Ex: Mesa 7" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
        <div className="flex-1 min-w-[120px]"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Área</label>
          <input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Salão / Deck" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
        <div className="w-24"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Lugares</label>
          <input type="number" min="1" value={form.seats} onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))} className="w-full glass-input rounded-xl px-3 py-2.5 text-sm text-admin-text outline-none" /></div>
        <button onClick={add} className="bg-admin-champ/15 text-admin-champ px-5 py-2.5 rounded-xl text-sm hover:bg-admin-champ/25">Adicionar</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 flex items-center justify-between">
            <div><p className="text-admin-text text-sm">{r.label}</p><p className="text-admin-muted/40 text-[11px]">{r.area || '—'} · {r.seats} lugares</p></div>
            <button onClick={() => remove(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose">excluir</button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-8">Nenhuma mesa cadastrada.</p>}
      </div>
    </div>
  )
}

export function TablesPanel({ notify }) {
  return (
    <ResourceTabs title="Mesas & Comandas" subtitle="salão, comandas por mesa, divisão de conta e envio à cozinha"
      tabs={[
        { key: 'floor', label: 'Salão', render: () => <FloorTab notify={notify} /> },
        { key: 'tables', label: 'Mesas', render: () => <TablesTab notify={notify} /> },
      ]}
    />
  )
}
