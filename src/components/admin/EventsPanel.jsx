import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const TYPES = { wedding: 'Casamento', corporate: 'Corporativo', birthday: 'Aniversário', buffet: 'Buffet', graduation: 'Formatura', other: 'Outro' }
const STATUS = { briefing: 'Briefing', proposal: 'Proposta', confirmed: 'Confirmado', in_progress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' }
const STATUS_COLORS = { briefing: 'text-admin-muted/50', proposal: 'text-admin-gold', confirmed: 'text-admin-champ', in_progress: 'text-admin-sage', completed: 'text-admin-muted/40', cancelled: 'text-admin-rose' }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function EventsPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('events').select('*').neq('type', 'workshop').order('event_date', { ascending: false })
    setEvents(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('events').insert({ title: form.title, type: form.type || 'wedding', status: form.status || 'briefing', event_date: form.event_date || null, venue: form.venue, guest_count: form.guest_count ? parseInt(form.guest_count) : null, budget: form.budget ? Number(form.budget) : null, notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Evento criado', 'success'); setModal(false); setForm({}); load()
  }
  const advance = async (ev) => {
    const order = ['briefing', 'proposal', 'confirmed', 'in_progress', 'completed']
    const idx = order.indexOf(ev.status)
    const next = order[Math.min(order.length - 1, idx + 1)]
    await supabase.from('events').update({ status: next }).eq('id', ev.id)
    setEvents((list) => list.map((e) => e.id === ev.id ? { ...e, status: next } : e))
  }

  const counts = Object.keys(STATUS).reduce((a, k) => ({ ...a, [k]: events.filter((e) => e.status === k).length }), {})
  const shown = filter ? events.filter((e) => e.status === filter) : events

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Eventos</h1><p className="text-admin-muted/60 text-sm mt-1">{events.length} eventos</p></div>
        <button onClick={() => { setForm({ type: 'wedding', status: 'briefing' }); setModal(true) }} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo evento</button>
      </div>

      {/* Pipeline */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos ({events.length})</button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{v} ({counts[k]})</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : shown.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="star" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum evento</p></div>
      ) : (
        <div className="space-y-2">{shown.map((e) => (
          <div key={e.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-admin-text text-sm font-medium truncate">{e.title}</p>
              <div className="flex gap-3 mt-0.5 flex-wrap"><span className="text-admin-muted/40 text-xs">{TYPES[e.type] || e.type}</span>{e.event_date && <span className="text-admin-muted/40 text-xs">{new Date(e.event_date).toLocaleDateString('pt-BR')}</span>}{e.guest_count && <span className="text-admin-muted/40 text-xs">{e.guest_count} convidados</span>}{e.budget && <span className="text-admin-gold/70 text-xs">{brl(e.budget)}</span>}</div>
            </div>
            <span className={`text-[11px] font-medium shrink-0 ${STATUS_COLORS[e.status]}`}>{STATUS[e.status]}</span>
            {!['completed', 'cancelled'].includes(e.status) && <button onClick={() => advance(e)} className="text-xs text-admin-champ hover:underline shrink-0">avançar →</button>}
          </div>
        ))}</div>
      )}

      {modal && (
        <Modal title="Novo evento" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Casamento Ana & João" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={Object.entries(TYPES).map(([value, label]) => ({ value, label }))} /></Fld><Fld label="Status"><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Data"><GlassDate value={form.event_date || ''} onChange={(v) => setForm((f) => ({ ...f, event_date: v }))} /></Fld><Fld label="Convidados"><input type="number" value={form.guest_count || ''} onChange={(e) => setForm((f) => ({ ...f, guest_count: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Local"><input value={form.venue || ''} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} className={inputCls} /></Fld><Fld label="Orçamento (R$)"><input type="number" value={form.budget || ''} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Observações"><textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar evento</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
