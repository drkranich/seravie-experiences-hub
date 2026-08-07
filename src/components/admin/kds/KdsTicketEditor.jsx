import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { getPreset } from '../../../lib/flowEngine'

// Tags sugeridas (o operador pode adicionar livres também).
const SUGGESTED_TAGS = ['VIP', 'URGENTE', 'DELIVERY', 'RETIRADA', 'SEM GLÚTEN', 'SEM CEBOLA', 'SEM LACTOSE', 'ALERGIA']
const CHANNELS = [
  { value: 'pdv', label: 'PDV (balcão)' },
  { value: 'flow', label: 'Flow QR' },
  { value: 'manual', label: 'Manual' },
  // canais do Hub Delivery — pedidos por esses canais aparecem no Hub
  { value: 'delivery', label: 'Delivery (genérico)' },
  { value: 'ifood', label: 'iFood' },
  { value: 'rappi', label: 'Rappi' },
  { value: '99food', label: '99Food' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'app', label: 'App próprio' },
]
// canais que representam entrega (espelham no Hub Delivery)
const DELIVERY_CHANNELS = ['delivery', 'ifood', 'rappi', '99food', 'instagram', 'whatsapp', 'app']
const PRIORITIES = [
  { value: '0', label: 'Normal' },
  { value: '1', label: 'Alta' },
  { value: '2', label: 'Urgente' },
  { value: '3', label: 'Crítica' },
]

const emptyItem = () => ({ name: '', qty: 1, notes: '' })

// Editor de pedido do KDS — criar do zero ou editar um existente, com itens,
// dados, prioridade, estação, observações e gestão de tags. Reutilizável por Flow.
export function KdsTicketEditor({ ticket, kind = 'kitchen', onClose, onSaved, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const preset = getPreset(kind)
  const editing = !!ticket?.id
  const [stations, setStations] = useState([])
  const [operators, setOperators] = useState([])
  const [menu, setMenu] = useState([])
  const [form, setForm] = useState({
    reference: '', table_label: '', customer_name: '', channel: 'manual',
    priority: '0', station_id: '', assignee: '', sla_min: Math.round((preset.defaultSlaSec || 900) / 60),
    notes: '', tags: [], items: [emptyItem()],
  })
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    supabase.from('kds_stations').select('id, name').eq('active', true).order('sort_order').then(({ data }) => setStations(data || []))
    supabase.from('kds_operators').select('name').eq('kind', kind).eq('active', true).order('sort_order').then(({ data }) => setOperators(data || []))
    supabase.from('kds_menu').select('name, category, prep_seconds').eq('kind', kind).eq('active', true).order('sort_order').then(({ data }) => setMenu(data || []))
  }, [kind])

  useEffect(() => {
    if (ticket) setForm({
      reference: ticket.reference || '', table_label: ticket.table_label || '', customer_name: ticket.customer_name || '',
      channel: ticket.channel || 'manual', priority: String(ticket.priority ?? 0), station_id: ticket.station_id || '',
      assignee: ticket.assignee || '', sla_min: Math.round((ticket.sla_seconds || 900) / 60), notes: ticket.notes || '',
      tags: Array.isArray(ticket.tags) ? ticket.tags : [], items: (ticket.items && ticket.items.length ? ticket.items : [emptyItem()]),
    })
  }, [ticket])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))
  const delItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const toggleTag = (t) => setForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))
  const addFreeTag = () => {
    const t = tagInput.trim().toUpperCase()
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagInput('')
  }

  const save = async () => {
    const items = form.items.filter((it) => String(it.name).trim()).map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 1, notes: (it.notes || '').trim() || undefined }))
    if (!items.length) return notify?.('Adicione ao menos um item', 'error')
    const payload = {
      tenant_id: tenantId, kind, source: form.channel, channel: form.channel,
      reference: form.reference.trim() || null, table_label: form.table_label.trim() || null,
      customer_name: form.customer_name.trim() || null, priority: Number(form.priority) || 0,
      station_id: form.station_id || null, assignee: form.assignee || null, sla_seconds: (Number(form.sla_min) || 15) * 60,
      notes: form.notes.trim() || null, tags: form.tags, items,
    }
    setSaving(true)
    let error
    if (editing) { const r = await supabase.from('kds_tickets').update(payload).eq('id', ticket.id); error = r.error }
    else { const r = await supabase.from('kds_tickets').insert({ ...payload, status: 'queued', stage_updated_at: new Date().toISOString() }); error = r.error }
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.(editing ? 'Pedido atualizado' : 'Pedido criado', 'success')
    onSaved?.()
  }

  const inputCls = 'w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-admin-text outline-none'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar pedido' : 'Novo pedido'}</h2>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>

        {/* dados principais */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Referência / nº</label><input value={form.reference} onChange={(e) => set('reference', e.target.value)} className={inputCls} placeholder="#1050" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Mesa / comanda</label><input value={form.table_label} onChange={(e) => set('table_label', e.target.value)} className={inputCls} placeholder="Mesa 5" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Cliente</label><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} className={inputCls} placeholder="opcional" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Canal</label><GlassSelect value={form.channel} onChange={(v) => set('channel', v)} options={CHANNELS} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Prioridade</label><GlassSelect value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Estação</label><GlassSelect value={form.station_id} onChange={(v) => set('station_id', v)} options={[{ value: '', label: '— sem estação —' }, ...stations.map((s) => ({ value: s.id, label: s.name }))]} /></div>
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Responsável</label><GlassSelect value={form.assignee} onChange={(v) => set('assignee', v)} options={[{ value: '', label: '— sem responsável —' }, ...operators.map((o) => ({ value: o.name, label: o.name }))]} placeholder="Escolha um operador" /></div>
        </div>
        {/* Aviso: pedidos de delivery aparecem no Hub Delivery para despacho */}
        {DELIVERY_CHANNELS.includes(form.channel) && (
          <div className="glass-soft rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2 border border-admin-champ/20">
            <Icon name="truck" className="w-4 h-4 text-admin-champ shrink-0" />
            <p className="text-[12px] text-admin-muted/80">Este pedido vai aparecer no <b className="text-admin-champ">Hub Delivery</b> e, quando ficar pronto, move para “Saiu p/ entrega” para envio.</p>
          </div>
        )}

        {/* itens */}
        <datalist id="kds-menu-items">{menu.map((m) => <option key={m.name} value={m.name} />)}</datalist>
        <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Itens</label>
        <div className="space-y-2 mb-4">
          {form.items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} type="number" min="1" className="w-16 glass-input rounded-xl px-3 py-2.5 text-sm text-admin-text outline-none text-center" />
              <div className="flex-1">
                <input value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} list="kds-menu-items" className={inputCls} placeholder="Nome do item" />
                <input value={it.notes} onChange={(e) => setItem(i, 'notes', e.target.value)} className={`${inputCls} mt-1.5 text-xs`} placeholder="Observação do item (ex: sem cebola)" />
              </div>
              {form.items.length > 1 && <button onClick={() => delItem(i)} className="p-2 rounded-lg text-admin-muted/60 hover:text-admin-rose shrink-0"><Icon name="trash" className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={addItem} className="flex items-center gap-1.5 text-admin-champ text-sm hover:underline"><Icon name="plus" className="w-4 h-4" />adicionar item</button>
        </div>

        {/* tags */}
        <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {SUGGESTED_TAGS.map((t) => (
            <button key={t} onClick={() => toggleTag(t)} className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${form.tags.includes(t) ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.05] text-admin-muted/60 hover:text-admin-text'}`}>{t}</button>
          ))}
        </div>
        {/* tags livres já selecionadas que não estão nas sugeridas */}
        {form.tags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {form.tags.filter((t) => !SUGGESTED_TAGS.includes(t)).map((t) => (
              <button key={t} onClick={() => toggleTag(t)} className="text-[10px] px-2.5 py-1 rounded-lg bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40 flex items-center gap-1">{t}<Icon name="x" className="w-3 h-3" /></button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFreeTag()} className={inputCls} placeholder="tag personalizada + Enter" />
          <button onClick={addFreeTag} className="px-4 rounded-xl bg-white/[0.05] text-admin-muted hover:text-admin-champ text-sm shrink-0">Adicionar</button>
        </div>

        {/* observações + SLA */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Observações gerais</label><input value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} placeholder="opcional" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">SLA (min)</label><input value={form.sla_min} onChange={(e) => set('sla_min', e.target.value)} type="number" className={inputCls} /></div>
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm disabled:opacity-50">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar pedido'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
