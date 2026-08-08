import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { logAudit } from '../../lib/audit'
import { DEFAULT_STAGES, STAGE_STY, STAGE_COLORS, stageProbability, weightedForecast, PRIORITIES, TASK_KINDS } from '../../lib/pipeline'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const ACT_ICON = { form: 'spark', note: 'pen', stage_change: 'up', quote: 'tag', document: 'book', system: 'gear', email: 'mail', call: 'user', file: 'image', task: 'check' }
const timeAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'agora'; if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`
}

export function PipelinePanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('crm') : true
  const [deals, setDeals] = useState([])
  const [stages, setStages] = useState(DEFAULT_STAGES)
  const [contacts, setContacts] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [note, setNote] = useState('')
  const [dragId, setDragId] = useState(null)
  const [editModal, setEditModal] = useState(null) // negócio em edição / {} novo
  const [stagesModal, setStagesModal] = useState(false)

  const stagesMap = useMemo(() => Object.fromEntries(stages.map((s) => [s.key, s.probability])), [stages])

  const loadStages = async () => {
    const { data } = await supabase.from('pipeline_stages').select('*').order('sort_order')
    setStages(data && data.length ? data : DEFAULT_STAGES)
  }
  const load = async () => {
    setLoading(true)
    const [dRes, cRes] = await Promise.all([
      supabase.from('deals').select('*, contact:contacts(name, email, phone)').neq('status', 'lost').order('created_at', { ascending: false }).limit(500),
      supabase.from('contacts').select('id, name').order('name').limit(1000),
    ])
    setDeals(dRes.data || [])
    setContacts(cRes.data || [])
    // membros da equipe (responsáveis) — usa o e-mail do membership como rótulo
    try {
      const { data: mem } = await supabase.from('memberships').select('user_id, email').eq('status', 'active').limit(100)
      setMembers((mem || []).filter((m) => m.user_id).map((m) => ({ id: m.user_id, name: (m.email || 'Usuário').split('@')[0] })))
    } catch { setMembers([]) }
    setLoading(false)
  }
  useEffect(() => { loadStages(); load() }, [])

  const byStage = useMemo(() => {
    const m = Object.fromEntries(stages.map((s) => [s.key, []]))
    deals.forEach((d) => { if (m[d.stage]) m[d.stage].push(d) })
    return m
  }, [deals, stages])

  const totals = useMemo(() => {
    const open = deals.filter((d) => d.status !== 'won')
    const won = deals.filter((d) => d.status === 'won')
    return {
      pipeline: open.reduce((s, d) => s + Number(d.value || 0), 0),
      won: won.reduce((s, d) => s + Number(d.value || 0), 0),
      forecast: weightedForecast(deals, stagesMap),
      count: deals.length,
    }
  }, [deals, stagesMap])

  const moveStage = async (d, stage) => {
    if (stage === d.stage) return
    const st = stages.find((s) => s.key === stage)
    const patch = { stage }
    if (st?.is_won) { patch.status = 'won'; patch.closed_at = new Date().toISOString() }
    else if (d.status === 'won') { patch.status = 'open'; patch.closed_at = null }
    setDeals((xs) => xs.map((x) => x.id === d.id ? { ...x, ...patch } : x)) // otimista
    try {
      await supabase.from('deals').update(patch).eq('id', d.id)
      await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: d.id, type: 'stage_change', title: `Movido para ${st?.label || stage}`, meta: { from: d.stage, to: stage } })
      logAudit({ action: 'update', resource_type: 'deals', resource_id: d.id, new_data: { stage } }, tenantId)
    } catch (e) { notify('Erro ao mover: ' + (e.message || e), 'error'); load() }
    if (detail?.id === d.id) setDetail((x) => ({ ...x, ...patch }))
  }

  const openDetail = async (d) => {
    setDetail(d); setNote('')
    const [{ data: acts }, { data: tks }] = await Promise.all([
      supabase.from('deal_activities').select('*').eq('deal_id', d.id).order('created_at', { ascending: false }),
      supabase.from('deal_tasks').select('*').eq('deal_id', d.id).order('due_date', { ascending: true }),
    ])
    setActivities(acts || []); setTasks(tks || [])
  }

  const addNote = async () => {
    if (!note.trim() || !detail) return
    try {
      const { data } = await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: detail.id, type: 'note', body: note, created_by: profile?.user_id }).select('*').single()
      setActivities((a) => [data, ...a]); setNote('')
    } catch { notify('Erro ao adicionar nota', 'error') }
  }
  const markLost = async (d) => {
    try {
      await supabase.from('deals').update({ status: 'lost', stage: 'lost', closed_at: new Date().toISOString() }).eq('id', d.id)
      await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: d.id, type: 'system', title: 'Negócio perdido' })
    } catch { /* noop */ }
    setDeals((xs) => xs.filter((x) => x.id !== d.id)); setDetail(null); notify('Negócio arquivado', 'success')
  }
  const removeDeal = async (d) => {
    try { await supabase.from('deals').delete().eq('id', d.id) } catch { /* noop */ }
    setDeals((xs) => xs.filter((x) => x.id !== d.id)); setDetail(null); notify('Negócio excluído', 'success')
  }

  // ---- tarefas ----
  const addTask = async (t) => {
    try {
      const { data } = await supabase.from('deal_tasks').insert({ tenant_id: tenantId, deal_id: detail.id, ...t }).select('*').single()
      setTasks((xs) => [...xs, data].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')))
    } catch (e) { notify('Erro ao criar tarefa: ' + (e.message || e), 'error') }
  }
  const toggleTask = async (t) => {
    const done = !t.done
    setTasks((xs) => xs.map((x) => x.id === t.id ? { ...x, done } : x))
    try { await supabase.from('deal_tasks').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', t.id) } catch { /* noop */ }
  }
  const removeTask = async (t) => {
    setTasks((xs) => xs.filter((x) => x.id !== t.id))
    try { await supabase.from('deal_tasks').delete().eq('id', t.id) } catch { /* noop */ }
  }

  const memberName = (id) => members.find((m) => m.id === id)?.name

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Pipeline de Vendas</h1>
          <p className="text-admin-muted/60 text-sm mt-1">{totals.count} negócios · arraste os cards entre as etapas</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Previsão</p><p className="text-admin-champ text-lg font-medium">{brl(totals.forecast)}</p></div>
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Em aberto</p><p className="text-admin-gold text-lg font-medium">{brl(totals.pipeline)}</p></div>
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Ganho</p><p className="text-admin-sage text-lg font-medium">{brl(totals.won)}</p></div>
          {mayEdit && <button onClick={() => setStagesModal(true)} className="border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors flex items-center gap-2"><Icon name="gear" className="w-4 h-4" />Etapas</button>}
          {mayEdit && <button onClick={() => setEditModal({})} className="bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"><Icon name="plus" className="w-4 h-4" />Novo negócio</button>}
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p> : (
        <div className="grid gap-3 pb-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.filter((s) => !s.is_lost).length)}, minmax(0, 1fr))` }}>
          {stages.filter((s) => !s.is_lost).map((stage) => {
            const list = byStage[stage.key] || []
            const sum = list.reduce((s, d) => s + Number(d.value || 0), 0)
            const sty = STAGE_STY[stage.color] || STAGE_STY.champ
            return (
              <div
                key={stage.key}
                className="min-w-0"
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={() => { const d = deals.find((x) => x.id === dragId); if (d) moveStage(d, stage.key); setDragId(null) }}
              >
                <div className={`flex items-center justify-between gap-1 px-1 mb-2 border-l-2 pl-2 ${sty.border}`}>
                  <span className={`text-xs uppercase tracking-wider truncate ${sty.text}`} title={stage.label}>{stage.label}</span>
                  <span className="text-admin-muted/40 text-[11px] shrink-0">{list.length}</span>
                </div>
                <div className={`space-y-2 min-h-[80px] rounded-xl p-1 transition-colors ${dragId ? 'bg-white/[0.02]' : ''}`}>
                  {list.map((d) => (
                    <div
                      key={d.id}
                      draggable={mayEdit}
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`glass rounded-xl p-3.5 group cursor-pointer hover:bg-white/[0.04] transition-colors ${dragId === d.id ? 'opacity-40' : ''}`}
                      onClick={() => openDetail(d)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-admin-text text-sm font-medium leading-tight">{d.title}</p>
                        {d.priority === 'high' && <span className="shrink-0 w-2 h-2 rounded-full bg-admin-rose mt-1" title="Alta prioridade" />}
                      </div>
                      {d.contact?.name && <p className="text-admin-muted/50 text-xs mt-1 truncate">{d.contact.name}</p>}
                      <div className="flex items-center justify-between mt-2.5">
                        {d.value > 0 ? <span className="text-admin-gold text-sm">{brl(d.value)}</span> : <span className="text-admin-muted/30 text-xs">sem valor</span>}
                        {d.expected_close_date ? <span className="text-admin-muted/40 text-[10px]">{new Date(d.expected_close_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span> : <span className="text-admin-muted/30 text-[10px]">{timeAgo(d.created_at)}</span>}
                      </div>
                      {d.owner_id && memberName(d.owner_id) && <p className="text-admin-muted/30 text-[10px] mt-1">👤 {memberName(d.owner_id)}</p>}
                    </div>
                  ))}
                  {list.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.05] h-14 flex items-center justify-center text-admin-muted/20 text-xs">soltar aqui</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detail && (
        <DealDrawer
          deal={detail} stages={stages} members={members} activities={activities} tasks={tasks}
          note={note} setNote={setNote} mayEdit={mayEdit} stagesMap={stagesMap}
          onClose={() => setDetail(null)} onMove={moveStage} onAddNote={addNote}
          onEdit={() => setEditModal(detail)} onLost={markLost} onDelete={removeDeal}
          onAddTask={addTask} onToggleTask={toggleTask} onRemoveTask={removeTask}
          memberName={memberName}
        />
      )}

      {editModal && <DealModal deal={editModal} contacts={contacts} members={members} stages={stages} tenantId={tenantId} createdBy={profile?.user_id} notify={notify} onClose={() => setEditModal(null)} onSaved={() => { setEditModal(null); load(); if (detail) openDetail(detail) }} />}
      {stagesModal && <StagesModal tenantId={tenantId} current={stages} notify={notify} onClose={() => setStagesModal(false)} onSaved={() => { setStagesModal(false); loadStages() }} />}
    </div>
  )
}

// ============ MODAL: NEGÓCIO (criar/editar) ============
function DealModal({ deal, contacts, members, stages, tenantId, createdBy, notify, onClose, onSaved }) {
  const editing = deal?.id
  const [f, setF] = useState({
    title: deal?.title || '', value: deal?.value || '', contact_id: deal?.contact_id || '',
    company: deal?.company || '', stage: deal?.stage || stages[0]?.key || 'new',
    priority: deal?.priority || 'medium', owner_id: deal?.owner_id || '',
    expected_close_date: deal?.expected_close_date || '', probability: deal?.probability ?? '',
    tags: (deal?.tags || []).join(', '), notes: deal?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.title.trim()) return notify('Título obrigatório', 'error')
    setBusy(true)
    const st = stages.find((s) => s.key === f.stage)
    const payload = {
      title: f.title.trim(), value: Number(f.value) || 0, contact_id: f.contact_id || null,
      company: f.company || null, stage: f.stage, priority: f.priority, owner_id: f.owner_id || null,
      expected_close_date: f.expected_close_date || null,
      probability: f.probability === '' ? null : Math.max(0, Math.min(100, Number(f.probability))),
      tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      notes: f.notes || null, status: st?.is_won ? 'won' : 'open',
    }
    try {
      let error
      if (editing) { const r = await supabase.from('deals').update(payload).eq('id', deal.id); error = r.error }
      else { const r = await supabase.from('deals').insert({ ...payload, tenant_id: tenantId, source: 'manual', currency: 'BRL' }); error = r.error }
      if (error) throw error
      notify(editing ? 'Negócio atualizado' : 'Negócio criado', 'success'); onSaved()
    } catch (e) { notify('Erro ao salvar: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  const L = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar negócio' : 'Novo negócio'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><L>Título *</L><input value={f.title} onChange={(e) => set({ title: e.target.value })} className={inp} placeholder="Ex: Projeto de identidade visual" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>Valor (R$)</L><input type="number" value={f.value} onChange={(e) => set({ value: e.target.value })} className={inp} /></div>
            <div><L>Etapa</L><GlassSelect value={f.stage} onChange={(v) => set({ stage: v })} options={stages.filter((s) => !s.is_lost).map((s) => ({ value: s.key, label: s.label }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>Contato</L><GlassSelect value={f.contact_id} onChange={(v) => set({ contact_id: v })} options={[{ value: '', label: '— nenhum —' }, ...contacts.slice(0, 800).map((c) => ({ value: c.id, label: c.name || 'Sem nome' }))]} /></div>
            <div><L>Empresa</L><input value={f.company} onChange={(e) => set({ company: e.target.value })} className={inp} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><L>Prioridade</L><GlassSelect value={f.priority} onChange={(v) => set({ priority: v })} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} /></div>
            <div><L>Responsável</L><GlassSelect value={f.owner_id} onChange={(v) => set({ owner_id: v })} options={[{ value: '', label: '—' }, ...members.map((m) => ({ value: m.id, label: m.name }))]} /></div>
            <div><L>Prob. %</L><input type="number" min="0" max="100" value={f.probability} onChange={(e) => set({ probability: e.target.value })} className={inp} placeholder="auto" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>Previsão de fechamento</L><GlassDate value={f.expected_close_date} onChange={(v) => set({ expected_close_date: v })} /></div>
            <div><L>Tags (vírgula)</L><input value={f.tags} onChange={(e) => set({ tags: e.target.value })} className={inp} placeholder="vip, indicação" /></div>
          </div>
          <div><L>Notas</L><textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar negócio')}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ============ GAVETA DE DETALHE ============
function DealDrawer({ deal, stages, activities, tasks, note, setNote, mayEdit, stagesMap, onClose, onMove, onAddNote, onEdit, onLost, onDelete, onAddTask, onToggleTask, onRemoveTask, memberName }) {
  const [taskForm, setTaskForm] = useState({ title: '', kind: 'call', due_date: '' })
  const prob = deal.probability != null ? deal.probability : stageProbability(deal.stage, stagesMap)
  const submitTask = () => {
    if (!taskForm.title.trim()) return
    onAddTask({ title: taskForm.title.trim(), kind: taskForm.kind, due_date: taskForm.due_date || null })
    setTaskForm({ title: '', kind: 'call', due_date: '' })
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full glass-pop overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl text-admin-text leading-tight">{deal.title}</h2>
            {deal.contact?.name && <p className="text-admin-muted/60 text-sm mt-0.5">{deal.contact.name}</p>}
            <p className="text-admin-muted/40 text-xs mt-0.5">{[deal.contact?.email, deal.contact?.phone].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {mayEdit && <button onClick={onEdit} className="text-admin-muted hover:text-admin-champ p-1" title="Editar"><Icon name="pen" className="w-4 h-4" /></button>}
            <button onClick={onClose} className="text-admin-muted hover:text-admin-text p-1"><Icon name="x" className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Valor</p><p className="text-admin-gold text-lg font-medium">{deal.value > 0 ? brl(deal.value) : '—'}</p></div>
          <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Prob.</p><p className="text-admin-champ text-lg font-medium">{prob}%</p></div>
          <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Previsto</p><p className="text-admin-sage text-sm font-medium mt-1">{brl((Number(deal.value || 0) * prob / 100))}</p></div>
        </div>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1.5">Etapa</p>
          {mayEdit ? <GlassSelect value={deal.stage} onChange={(v) => onMove(deal, v)} options={stages.filter((s) => !s.is_lost).map((s) => ({ value: s.key, label: s.label }))} /> : <p className="text-admin-text text-sm">{stages.find((s) => s.key === deal.stage)?.label}</p>}
        </div>

        {(deal.company || deal.owner_id || (deal.tags || []).length > 0) && (
          <div className="mb-5 space-y-1.5 text-sm">
            {deal.company && <p className="text-admin-muted/60"><span className="text-admin-muted/40">Empresa:</span> {deal.company}</p>}
            {deal.owner_id && memberName(deal.owner_id) && <p className="text-admin-muted/60"><span className="text-admin-muted/40">Responsável:</span> {memberName(deal.owner_id)}</p>}
            {(deal.tags || []).length > 0 && <div className="flex flex-wrap gap-1.5">{deal.tags.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{t}</span>)}</div>}
          </div>
        )}

        {/* Tarefas / follow-ups */}
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Tarefas & follow-ups</p>
        {mayEdit && (
          <div className="glass-soft rounded-xl p-2.5 mb-3 space-y-2">
            <input value={taskForm.title} onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submitTask()} placeholder="Nova tarefa (ex: ligar amanhã)…" className="w-full glass-input rounded-lg px-3 py-2 text-sm text-admin-text outline-none" />
            <div className="flex gap-2">
              <div className="w-32"><GlassSelect value={taskForm.kind} onChange={(v) => setTaskForm((s) => ({ ...s, kind: v }))} options={TASK_KINDS.map((k) => ({ value: k.value, label: k.label }))} /></div>
              <div className="flex-1"><GlassDate value={taskForm.due_date} onChange={(v) => setTaskForm((s) => ({ ...s, due_date: v }))} /></div>
              <button onClick={submitTask} className="bg-admin-champ/15 text-admin-champ px-3 rounded-lg text-sm shrink-0">Add</button>
            </div>
          </div>
        )}
        <div className="space-y-1.5 mb-6">
          {tasks.length === 0 ? <p className="text-admin-muted/30 text-xs">Sem tarefas.</p> : tasks.map((t) => {
            const k = TASK_KINDS.find((x) => x.value === t.kind) || TASK_KINDS[4]
            const overdue = !t.done && t.due_date && t.due_date < today
            return (
              <div key={t.id} className="flex items-center gap-2.5 glass-soft rounded-lg px-3 py-2">
                <button onClick={() => onToggleTask(t)} className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${t.done ? 'bg-admin-sage border-admin-sage' : 'border-admin-muted/40'}`}>{t.done && <Icon name="check" className="w-3 h-3 text-admin-bg" />}</button>
                <Icon name={k.icon} className="w-3.5 h-3.5 text-admin-champ/50 shrink-0" />
                <span className={`flex-1 text-sm ${t.done ? 'line-through text-admin-muted/40' : 'text-admin-text/80'}`}>{t.title}</span>
                {t.due_date && <span className={`text-[10px] shrink-0 ${overdue ? 'text-admin-rose' : 'text-admin-muted/40'}`}>{new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                <button onClick={() => onRemoveTask(t)} className="text-admin-muted/30 hover:text-admin-rose shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>
            )
          })}
        </div>

        {/* Histórico */}
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Histórico</p>
        {mayEdit && (
          <div className="flex gap-2 mb-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAddNote()} placeholder="Adicionar nota…" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
            <button onClick={onAddNote} className="bg-admin-champ/15 text-admin-champ px-3 rounded-xl text-sm">Add</button>
          </div>
        )}
        <div className="space-y-2.5 mb-6">
          {activities.length === 0 ? <p className="text-admin-muted/30 text-xs">Sem atividades.</p> : activities.map((a) => (
            <div key={a.id} className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-admin-champ/10 flex items-center justify-center shrink-0 mt-0.5"><Icon name={ACT_ICON[a.type] || 'spark'} className="w-3 h-3 text-admin-champ/70" /></div>
              <div className="min-w-0 flex-1">
                {a.title && <p className="text-admin-text text-sm">{a.title}</p>}
                {a.body && <p className="text-admin-muted/60 text-xs mt-0.5 whitespace-pre-wrap">{a.body}</p>}
                <p className="text-admin-muted/30 text-[10px] mt-0.5">{timeAgo(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        {mayEdit && (
          <div className="flex gap-4">
            <button onClick={() => onLost(deal)} className="text-admin-rose/70 hover:text-admin-rose text-xs">Marcar como perdido</button>
            <button onClick={() => { if (confirm('Excluir este negócio definitivamente?')) onDelete(deal) }} className="text-admin-muted/50 hover:text-admin-rose text-xs ml-auto">Excluir</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ MODAL: ETAPAS PERSONALIZÁVEIS ============
function StagesModal({ tenantId, current, notify, onClose, onSaved }) {
  const seed = current && current.length && current[0].id ? current : DEFAULT_STAGES.map((s, i) => ({ ...s, sort_order: i }))
  const [rows, setRows] = useState(seed.map((s, i) => ({ key: s.key, label: s.label, color: s.color || 'champ', probability: s.probability ?? 0, is_won: !!s.is_won, sort_order: s.sort_order ?? i, id: s.id })))
  const [busy, setBusy] = useState(false)
  const set = (i, patch) => setRows((xs) => xs.map((r, j) => j === i ? { ...r, ...patch } : r))
  const add = () => setRows((xs) => [...xs, { key: `etapa_${xs.length + 1}_${Math.random().toString(36).slice(2, 5)}`, label: 'Nova etapa', color: 'champ', probability: 30, is_won: false, sort_order: xs.length }])
  const remove = (i) => setRows((xs) => xs.filter((_, j) => j !== i))
  const move = (i, dir) => setRows((xs) => { const j = i + dir; if (j < 0 || j >= xs.length) return xs; const a = [...xs];[a[i], a[j]] = [a[j], a[i]]; return a })

  const save = async () => {
    setBusy(true)
    try {
      // substitui o conjunto: apaga os do tenant e insere os novos (com sort_order pela ordem atual)
      await supabase.from('pipeline_stages').delete().eq('tenant_id', tenantId)
      const payload = rows.map((r, i) => ({ tenant_id: tenantId, key: r.key, label: r.label.trim() || `Etapa ${i + 1}`, color: r.color, probability: Number(r.probability) || 0, is_won: !!r.is_won, sort_order: i }))
      const { error } = await supabase.from('pipeline_stages').insert(payload)
      if (error) throw error
      notify('Etapas salvas', 'success'); onSaved()
    } catch (e) { notify('Erro ao salvar etapas: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Etapas do funil</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-4">Personalize as etapas do seu processo de vendas. A probabilidade (%) é usada na previsão de receita.</p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="glass rounded-xl p-2.5 flex items-center gap-2 flex-wrap">
              <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} className="flex-1 min-w-[8rem] glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none" placeholder="Nome da etapa" />
              <div className="w-28"><GlassSelect value={r.color} onChange={(v) => set(i, { color: v })} options={STAGE_COLORS.map((c) => ({ value: c, label: c }))} /></div>
              <div className="flex items-center gap-1"><input type="number" min="0" max="100" value={r.probability} onChange={(e) => set(i, { probability: e.target.value })} className="w-16 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none" /><span className="text-admin-muted/40 text-xs">%</span></div>
              <label className="flex items-center gap-1 text-xs text-admin-muted/60 cursor-pointer"><input type="checkbox" checked={r.is_won} onChange={(e) => set(i, { is_won: e.target.checked })} className="accent-admin-sage" />ganho</label>
              <button onClick={() => move(i, -1)} className="text-admin-muted/40 hover:text-admin-text"><Icon name="up" className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(i, 1)} className="text-admin-muted/40 hover:text-admin-text"><Icon name="down" className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(i)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
        <button onClick={add} className="mt-3 flex items-center gap-1.5 text-xs text-admin-champ/80 hover:text-admin-champ"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar etapa</button>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar etapas'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
