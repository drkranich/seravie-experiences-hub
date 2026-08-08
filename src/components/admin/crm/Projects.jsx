import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const dt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const STATUS = [
  { value: 'planning', label: 'Planejamento', color: 'bg-white/[0.06] text-admin-muted/60' },
  { value: 'active', label: 'Em andamento', color: 'bg-admin-sage/15 text-admin-sage' },
  { value: 'on_hold', label: 'Pausado', color: 'bg-admin-gold/15 text-admin-gold' },
  { value: 'done', label: 'Concluído', color: 'bg-admin-champ/15 text-admin-champ' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-admin-rose/15 text-admin-rose' },
]
const ST_MAP = Object.fromEntries(STATUS.map((s) => [s.value, s]))

// Projetos integrados ao cliente.
export function Projects({ notify, onOpenContact }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [projects, setProjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        supabase.from('projects').select('*, contact:contacts(name)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('contacts').select('id, name').order('name').limit(1000),
      ])
      setProjects(pRes.data || [])
      setContacts(cRes.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (p) => {
    if (!confirm(`Excluir o projeto "${p.name}"?`)) return
    try { await supabase.from('projects').delete().eq('id', p.id) } catch { /* noop */ }
    notify('Projeto removido', 'success'); load()
  }
  const list = filter ? projects.filter((p) => p.status === filter) : projects
  const totalBudget = projects.filter((p) => !['cancelled', 'done'].includes(p.status)).reduce((s, p) => s + Number(p.budget || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilter('')} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todos</button>
          {STATUS.map((s) => <button key={s.value} onClick={() => setFilter(s.value)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === s.value ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{s.label}</button>)}
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Em carteira</p><p className="text-admin-champ text-sm font-medium">{brl(totalBudget)}</p></div>
          <button onClick={() => setModal({})} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo projeto</button>
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : list.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="layers" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum projeto {filter ? 'neste status' : 'ainda'}.</p></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((p) => {
              const st = ST_MAP[p.status] || STATUS[0]
              return (
                <div key={p.id} className="glass rounded-2xl p-5 group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-admin-text text-sm font-medium truncate">{p.name}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded shrink-0 ${st.color}`}>{st.label}</span>
                  </div>
                  {(p.contact?.name || p.client_name) && <button onClick={() => p.contact && onOpenContact && onOpenContact({ id: p.contact_id, name: p.contact.name })} className="text-admin-muted/50 text-xs hover:text-admin-champ">{p.contact?.name || p.client_name}</button>}
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    {p.budget > 0 && <span className="text-admin-gold">{brl(p.budget)}</span>}
                    {p.deadline && <span className="text-admin-muted/40">prazo {dt(p.deadline)}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                    <button onClick={() => setModal(p)} className="ml-auto text-admin-champ/80 hover:underline">editar</button>
                    <button onClick={() => remove(p)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {modal && <ProjectModal project={modal} contacts={contacts} tenantId={tenantId} notify={notify} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

function ProjectModal({ project, contacts, tenantId, notify, onClose, onSaved }) {
  const editing = project?.id
  const [f, setF] = useState({
    name: project?.name || '', contact_id: project?.contact_id || '', status: project?.status || 'planning',
    budget: project?.budget || '', start_date: project?.start_date || '', deadline: project?.deadline || '', notes: project?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.name.trim()) return notify('Nome obrigatório', 'error')
    setBusy(true)
    const contact = contacts.find((c) => c.id === f.contact_id)
    const payload = { name: f.name.trim(), contact_id: f.contact_id || null, client_name: contact?.name || null, status: f.status, budget: Number(f.budget) || 0, start_date: f.start_date || null, deadline: f.deadline || null, notes: f.notes || null }
    try {
      let error
      if (editing) { const r = await supabase.from('projects').update(payload).eq('id', project.id); error = r.error }
      else { const r = await supabase.from('projects').insert({ ...payload, tenant_id: tenantId }); error = r.error }
      if (error) throw error
      notify(editing ? 'Projeto atualizado' : 'Projeto criado', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  const L = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar projeto' : 'Novo projeto'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><L>Nome do projeto *</L><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>Cliente</L><GlassSelect value={f.contact_id} onChange={(v) => set({ contact_id: v })} options={[{ value: '', label: '— nenhum —' }, ...contacts.slice(0, 800).map((c) => ({ value: c.id, label: c.name || 'Sem nome' }))]} /></div>
            <div><L>Status</L><GlassSelect value={f.status} onChange={(v) => set({ status: v })} options={STATUS.map((s) => ({ value: s.value, label: s.label }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><L>Orçamento (R$)</L><input type="number" value={f.budget} onChange={(e) => set({ budget: e.target.value })} className={inp} /></div>
            <div><L>Início</L><GlassDate value={f.start_date} onChange={(v) => set({ start_date: v })} /></div>
            <div><L>Prazo</L><GlassDate value={f.deadline} onChange={(v) => set({ deadline: v })} /></div>
          </div>
          <div><L>Notas</L><textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className={inp + ' resize-none'} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar projeto')}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
