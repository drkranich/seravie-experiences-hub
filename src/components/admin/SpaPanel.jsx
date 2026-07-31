import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const APPT_STATUS = { scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' }
const APPT_COLORS = { scheduled: 'text-admin-gold', confirmed: 'text-admin-champ', completed: 'text-admin-sage', cancelled: 'text-admin-rose', no_show: 'text-admin-rose/60' }

function Modal({ title, onClose, children }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[88vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>{children}</div></div>)
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function SpaPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('agenda')
  const [services, setServices] = useState([])
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [s, a] = await Promise.all([
      supabase.from('spa_services').select('*').order('name'),
      supabase.from('appointments').select('*').order('date', { ascending: false }).limit(100),
    ])
    setServices(s.data || []); setAppts(a.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])
  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  const saveService = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('spa_services').insert({ name: form.name, category: form.category, duration_min: form.duration_min ? parseInt(form.duration_min) : null, price: Number(form.price) || 0, description: form.description, is_active: form.is_active !== false, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Serviço criado', 'success'); close(); loadAll()
  }
  const saveAppt = async () => {
    if (!form.customer_name?.trim()) return notify('Cliente obrigatório', 'error')
    const { error } = await supabase.from('appointments').insert({ customer_name: form.customer_name, service: form.service, professional: form.professional, date: form.date || null, time: form.time, status: form.status || 'scheduled', notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Agendamento criado', 'success'); close(); loadAll()
  }
  const setStatus = async (a, status) => { await supabase.from('appointments').update({ status }).eq('id', a.id); setAppts((l) => l.map((x) => x.id === a.id ? { ...x, status } : x)) }

  const addBtn = tab === 'agenda' ? () => open('appt', { status: 'scheduled' }) : () => open('service', { is_active: true })
  const addLabel = tab === 'agenda' ? 'Novo agendamento' : 'Novo serviço'
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name="heart" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Spa</h1><p className="text-admin-muted/60 text-sm mt-1">{appts.length} agendamentos · {services.length} serviços</p></div>
        <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['agenda', 'Agenda'], ['services', 'Serviços']].map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'agenda' && (appts.length === 0 ? <Empty t="Nenhum agendamento" /> : (
            <div className="space-y-2">{appts.map((a) => (
              <div key={a.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{a.customer_name}</p><div className="flex gap-3 mt-0.5 flex-wrap">{a.service && <span className="text-admin-muted/40 text-xs">{a.service}</span>}{a.date && <span className="text-admin-muted/40 text-xs">{new Date(a.date).toLocaleDateString('pt-BR')}{a.time ? ` ${a.time}` : ''}</span>}{a.professional && <span className="text-admin-muted/40 text-xs">{a.professional}</span>}</div></div>
                <span className={`text-[11px] font-medium shrink-0 ${APPT_COLORS[a.status]}`}>{APPT_STATUS[a.status]}</span>
                {a.status === 'scheduled' && <button onClick={() => setStatus(a, 'confirmed')} className="text-xs text-admin-champ hover:underline shrink-0">confirmar</button>}
                {a.status === 'confirmed' && <button onClick={() => setStatus(a, 'completed')} className="text-xs text-admin-sage hover:underline shrink-0">concluir</button>}
              </div>
            ))}</div>
          ))}
          {tab === 'services' && (services.length === 0 ? <Empty t="Nenhum serviço/protocolo" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{services.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{s.name}</p><p className="text-admin-gold text-sm">{brl(s.price)}</p></div>
                <div className="flex gap-2 mt-1">{s.category && <span className="text-admin-champ/60 text-xs">{s.category}</span>}{s.duration_min && <span className="text-admin-muted/40 text-xs">{s.duration_min} min</span>}</div>
                {s.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{s.description}</p>}
              </div>
            ))}</div>
          ))}
        </>
      )}

      {modal === 'service' && (
        <Modal title="Novo serviço" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Massagem relaxante" /></Fld>
            <div className="grid grid-cols-3 gap-3"><Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} /></Fld><Fld label="Duração (min)"><input type="number" value={form.duration_min || ''} onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))} className={inputCls} /></Fld><Fld label="Preço"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveService} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={close} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
      {modal === 'appt' && (
        <Modal title="Novo agendamento" onClose={close}>
          <div className="space-y-4">
            <Fld label="Cliente *"><input value={form.customer_name || ''} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Serviço"><GlassSelect value={form.service || ''} onChange={(v) => setForm((f) => ({ ...f, service: v }))} options={[{ value: '', label: 'Selecione' }, ...services.map((s) => ({ value: s.name, label: s.name }))]} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Data"><GlassDate value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} /></Fld><Fld label="Hora"><input value={form.time || ''} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className={inputCls} placeholder="14:30" /></Fld></div>
            <Fld label="Profissional"><input value={form.professional || ''} onChange={(e) => setForm((f) => ({ ...f, professional: e.target.value }))} className={inputCls} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveAppt} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Agendar</button><button onClick={close} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
