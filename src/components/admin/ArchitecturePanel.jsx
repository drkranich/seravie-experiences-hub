import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const STATUS = { briefing: 'Briefing', design: 'Projeto', approval: 'Aprovação', execution: 'Execução', delivered: 'Entregue', cancelled: 'Cancelado' }
const STATUS_COLORS = { briefing: 'text-admin-muted/50', design: 'text-admin-gold', approval: 'text-admin-champ', execution: 'text-admin-sage', delivered: 'text-admin-muted/40', cancelled: 'text-admin-rose' }

function Modal({ title, onClose, children }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible"><div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>{children}</div></div>)
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function ArchitecturePanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [filter, setFilter] = useState('')

  const load = async () => { setLoading(true); const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false }); setProjects(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('projects').insert({ name: form.name, client_name: form.client_name, status: form.status || 'briefing', budget: form.budget ? Number(form.budget) : null, start_date: form.start_date || null, deadline: form.deadline || null, notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Projeto criado', 'success'); setModal(false); setForm({}); load()
  }
  const advance = async (p) => {
    const order = ['briefing', 'design', 'approval', 'execution', 'delivered']
    const next = order[Math.min(order.length - 1, order.indexOf(p.status) + 1)]
    await supabase.from('projects').update({ status: next }).eq('id', p.id)
    setProjects((l) => l.map((x) => x.id === p.id ? { ...x, status: next } : x))
  }
  const counts = Object.keys(STATUS).reduce((a, k) => ({ ...a, [k]: projects.filter((p) => p.status === k).length }), {})
  const shown = filter ? projects.filter((p) => p.status === filter) : projects

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Arquitetura</h1><p className="text-admin-muted/60 text-sm mt-1">{projects.length} projetos</p></div>
        <button onClick={() => { setForm({ status: 'briefing' }); setModal(true) }} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="layout" className="w-4 h-4" />Novo projeto</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos ({projects.length})</button>
        {Object.entries(STATUS).map(([k, v]) => <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{v} ({counts[k]})</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : shown.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="layout" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum projeto</p></div>
      ) : (
        <div className="space-y-2">{shown.map((p) => (
          <div key={p.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{p.name}</p><div className="flex gap-3 mt-0.5 flex-wrap">{p.client_name && <span className="text-admin-muted/40 text-xs">{p.client_name}</span>}{p.deadline && <span className="text-admin-muted/40 text-xs">prazo {new Date(p.deadline).toLocaleDateString('pt-BR')}</span>}{p.budget && <span className="text-admin-gold/70 text-xs">{brl(p.budget)}</span>}</div></div>
            <span className={`text-[11px] font-medium shrink-0 ${STATUS_COLORS[p.status]}`}>{STATUS[p.status]}</span>
            {!['delivered', 'cancelled'].includes(p.status) && <button onClick={() => advance(p)} className="text-xs text-admin-champ hover:underline shrink-0">avançar →</button>}
          </div>
        ))}</div>
      )}

      {modal && (
        <Modal title="Novo projeto" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Loja conceito SP" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Cliente"><input value={form.client_name || ''} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} className={inputCls} /></Fld><Fld label="Status"><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Início"><GlassDate value={form.start_date || ''} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} /></Fld><Fld label="Prazo"><GlassDate value={form.deadline || ''} onChange={(v) => setForm((f) => ({ ...f, deadline: v }))} /></Fld></div>
            <Fld label="Orçamento (R$)"><input type="number" value={form.budget || ''} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Observações"><textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar projeto</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
