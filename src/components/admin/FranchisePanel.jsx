import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect, GlassDate } from './ui'

const COMM_TYPE_LABELS = { announcement: 'Comunicado', alert: 'Alerta', training: 'Treinamento', campaign: 'Campanha', policy: 'Política', other: 'Outro' }
const PRIORITY_COLORS = { low: 'text-admin-muted/40', normal: 'text-admin-sage', high: 'text-admin-gold', urgent: 'text-admin-rose' }
const VM_STATUS = { draft: 'Rascunho', published: 'Publicada', active: 'Ativa', closed: 'Encerrada' }
const VM_EXEC = { pending: 'Pendente', submitted: 'Enviada', approved: 'Aprovada', rejected: 'Reprovada' }
const AUDIT_STATUS = { scheduled: 'Agendada', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' }
const INC_SEV = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }
const INC_STATUS = { open: 'Aberta', investigating: 'Em análise', resolved: 'Resolvida', closed: 'Fechada' }
const SEV_COLOR = { low: 'text-admin-muted/50', medium: 'text-admin-sage', high: 'text-admin-gold', critical: 'text-admin-rose' }
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`

const TABS = [
  ['network', 'Rede & Unidades'], ['communications', 'Comunicados'], ['vm', 'Visual Merchandising'],
  ['audits', 'Auditorias'], ['incidents', 'Ocorrências'], ['goals', 'Metas & Ranking'],
]

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`glass-pop rounded-2xl p-7 w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

export function FranchisePanel({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const uid = user?.id || null

  const [tab, setTab] = useState('network')
  const [units, setUnits] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'unit'|'comm'|'vm'|'audit'|'incident'|'goal'
  const [form, setForm] = useState({})
  const [vmDetail, setVmDetail] = useState(null)
  const [vmExecs, setVmExecs] = useState([])

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—'
  const unitOptions = [{ value: '', label: 'Toda a rede' }, ...units.map((u) => ({ value: u.id, label: u.name }))]

  const loadUnits = async () => { const { data } = await supabase.from('units').select('*').order('name'); setUnits(data || []) }

  const loadTab = async () => {
    setLoading(true)
    let res = []
    if (tab === 'network') { const { data } = await supabase.from('units').select('*').order('name'); res = data || []; setUnits(res) }
    else if (tab === 'communications') { const { data } = await supabase.from('network_communications').select('*').order('created_at', { ascending: false }).limit(50); res = data || [] }
    else if (tab === 'vm') { const { data } = await supabase.from('vm_campaigns').select('*').order('created_at', { ascending: false }).limit(40); res = data || [] }
    else if (tab === 'audits') { const { data } = await supabase.from('audits').select('*').order('created_at', { ascending: false }).limit(60); res = data || [] }
    else if (tab === 'incidents') { const { data } = await supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(60); res = data || [] }
    else if (tab === 'goals') { const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false }).limit(60); res = data || [] }
    setData(res); setLoading(false)
  }
  useEffect(() => { loadUnits() }, [])
  useEffect(() => { loadTab() }, [tab])

  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  // ---------- Saves ----------
  const saveUnit = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('units').insert({ name: form.name, city: form.city, state: form.state, address: form.address, phone: form.phone, email: form.email, status: form.status || 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error')
    notify('Unidade criada', 'success'); close(); loadTab()
  }
  const saveComm = async () => {
    if (!form.title?.trim() || !form.content?.trim()) return notify('Título e conteúdo obrigatórios', 'error')
    const { error } = await supabase.from('network_communications').insert({ title: form.title, content: form.content, type: form.type || 'announcement', priority: form.priority || 'normal', requires_confirmation: !!form.requires_confirmation, published_at: new Date().toISOString(), created_by: uid, tenant_id: tenantId })
    if (error) return notify('Erro ao publicar', 'error')
    notify('Comunicado publicado', 'success'); close(); loadTab()
  }
  const saveVM = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('vm_campaigns').insert({ title: form.title, description: form.description, type: form.type || 'vitrine', status: form.status || 'published', start_date: form.start_date || null, end_date: form.end_date || null, instructions: form.instructions, created_by: uid, tenant_id: tenantId })
    if (error) return notify('Erro ao criar', 'error')
    notify('Campanha de VM criada', 'success'); close(); loadTab()
  }
  const saveAudit = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('audits').insert({ title: form.title, unit_id: form.unit_id || null, type: form.type || 'operacional', status: form.status || 'scheduled', score: form.score ? Number(form.score) : null, max_score: form.max_score ? Number(form.max_score) : 100, auditor_id: uid, notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao criar', 'error')
    notify('Auditoria registrada', 'success'); close(); loadTab()
  }
  const saveIncident = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('incidents').insert({ title: form.title, description: form.description, unit_id: form.unit_id || null, type: form.type || 'operational', severity: form.severity || 'medium', status: 'open', reported_by: uid, tenant_id: tenantId })
    if (error) return notify('Erro ao registrar', 'error')
    notify('Ocorrência registrada', 'success'); close(); loadTab()
  }
  const saveGoal = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('goals').insert({ title: form.title, unit_id: form.unit_id || null, type: form.type || 'sales', target_value: Number(form.target_value) || 0, current_value: Number(form.current_value) || 0, period_start: form.period_start || null, period_end: form.period_end || null, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao criar', 'error')
    notify('Meta criada', 'success'); close(); loadTab()
  }
  const resolveIncident = async (i) => {
    await supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', i.id)
    notify('Ocorrência resolvida', 'success'); loadTab()
  }
  const openVmDetail = async (vm) => {
    setVmDetail(vm)
    const { data } = await supabase.from('vm_executions').select('*').eq('campaign_id', vm.id).order('created_at', { ascending: false })
    setVmExecs(data || [])
  }
  const reviewExec = async (ex, status) => {
    await supabase.from('vm_executions').update({ status, reviewer_id: uid, reviewed_at: new Date().toISOString() }).eq('id', ex.id)
    setVmExecs((list) => list.map((e) => e.id === ex.id ? { ...e, status } : e)); notify(status === 'approved' ? 'Execução aprovada' : 'Execução reprovada', 'success')
  }

  // ranking por auditoria média
  const ranking = units.map((u) => {
    const us = data.filter((g) => g.unit_id === u.id)
    return { unit: u, count: us.length }
  })

  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/40 text-sm">{t}</p></div>
  const Loading = () => <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>

  const addBtn = {
    network: () => open('unit', { status: 'active' }), communications: () => open('comm', { type: 'announcement', priority: 'normal' }),
    vm: () => open('vm', { type: 'vitrine', status: 'published' }), audits: () => open('audit', { type: 'operacional', status: 'scheduled', max_score: 100 }),
    incidents: () => open('incident', { type: 'operational', severity: 'medium' }), goals: () => open('goal', { type: 'sales' }),
  }[tab]
  const addLabel = { network: 'Nova unidade', communications: 'Novo comunicado', vm: 'Nova campanha', audits: 'Nova auditoria', incidents: 'Nova ocorrência', goals: 'Nova meta' }[tab]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Franquias</h1><p className="text-admin-muted/60 text-sm mt-1">{units.length} unidades na rede</p></div>
        {addBtn && <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {/* REDE */}
      {tab === 'network' && (loading ? <Loading /> : data.length === 0 ? <Empty t="Nenhuma unidade cadastrada" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.map((u) => (
          <div key={u.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between mb-2"><p className="text-admin-text text-sm font-medium">{u.name}</p><span className={`text-[9px] px-2 py-0.5 rounded-lg ${u.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{u.status || 'active'}</span></div>
            {(u.city || u.state) && <p className="text-admin-muted/50 text-xs">{[u.city, u.state].filter(Boolean).join(', ')}</p>}
            {u.phone && <p className="text-admin-muted/40 text-xs mt-1">{u.phone}</p>}
          </div>
        ))}</div>
      ))}

      {/* COMUNICADOS */}
      {tab === 'communications' && (loading ? <Loading /> : data.length === 0 ? <Empty t="Nenhum comunicado publicado" /> : (
        <div className="space-y-2">{data.map((c) => (
          <div key={c.id} className="glass rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div><p className="text-admin-text text-sm font-medium">{c.title}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-admin-champ/60">{COMM_TYPE_LABELS[c.type]}</span><span className={`text-[10px] font-medium ${PRIORITY_COLORS[c.priority]}`}>{c.priority?.toUpperCase()}</span>{c.requires_confirmation && <span className="text-[10px] text-admin-gold">· Confirmação</span>}</div></div>
              <p className="text-admin-muted/30 text-[10px] shrink-0">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <p className="text-admin-muted/60 text-xs line-clamp-2">{c.content}</p>
          </div>
        ))}</div>
      ))}

      {/* VISUAL MERCHANDISING */}
      {tab === 'vm' && (loading ? <Loading /> : data.length === 0 ? <Empty t="Nenhuma campanha de VM" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.map((vm) => (
          <button key={vm.id} onClick={() => openVmDetail(vm)} className="glass rounded-xl p-4 text-left border border-transparent hover:border-admin-champ/25 transition-colors">
            <div className="flex items-start justify-between mb-2"><p className="text-admin-text text-sm font-medium">{vm.title}</p><span className="text-[10px] text-admin-champ/70">{VM_STATUS[vm.status] || vm.status}</span></div>
            <p className="text-admin-muted/50 text-xs capitalize mb-2">{vm.type}</p>
            {vm.start_date && <p className="text-[10px] text-admin-muted/40">{new Date(vm.start_date).toLocaleDateString('pt-BR')}{vm.end_date ? ' → ' + new Date(vm.end_date).toLocaleDateString('pt-BR') : ''}</p>}
            <p className="text-[10px] text-admin-champ/50 mt-2">Ver execuções →</p>
          </button>
        ))}</div>
      ))}

      {/* AUDITORIAS */}
      {tab === 'audits' && (loading ? <Loading /> : data.length === 0 ? <Empty t="Nenhuma auditoria" /> : (
        <div className="space-y-2">{data.map((a) => {
          const pct = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null
          return (
            <div key={a.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{a.title}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs">{unitName(a.unit_id)}</span><span className="text-admin-muted/40 text-xs capitalize">{a.type}</span><span className="text-admin-champ/60 text-xs">{AUDIT_STATUS[a.status] || a.status}</span></div></div>
              {pct != null && <div className="text-right shrink-0"><p className={`text-lg font-medium ${pct >= 80 ? 'text-admin-sage' : pct >= 60 ? 'text-admin-gold' : 'text-admin-rose'}`}>{pct}%</p><p className="text-[10px] text-admin-muted/40">{a.score}/{a.max_score}</p></div>}
            </div>
          )
        })}</div>
      ))}

      {/* OCORRÊNCIAS */}
      {tab === 'incidents' && (loading ? <Loading /> : data.length === 0 ? <Empty t="Nenhuma ocorrência" /> : (
        <div className="space-y-2">{data.map((i) => (
          <div key={i.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
            <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{i.title}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs">{unitName(i.unit_id)}</span><span className={`text-xs ${SEV_COLOR[i.severity]}`}>{INC_SEV[i.severity]}</span><span className="text-admin-muted/40 text-xs">{INC_STATUS[i.status]}</span></div></div>
            {i.status !== 'resolved' && i.status !== 'closed' && <button onClick={() => resolveIncident(i)} className="text-xs text-admin-sage hover:underline shrink-0">Resolver</button>}
          </div>
        ))}</div>
      ))}

      {/* METAS & RANKING */}
      {tab === 'goals' && (loading ? <Loading /> : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-2">
            {data.length === 0 ? <Empty t="Nenhuma meta cadastrada" /> : data.map((g) => {
              const pct = g.target_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
              return (
                <div key={g.id} className="glass rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between mb-2"><div><p className="text-admin-text text-sm font-medium">{g.title}</p><p className="text-admin-muted/40 text-xs">{unitName(g.unit_id)} · {g.type}</p></div><span className="text-admin-champ text-sm">{pct}%</span></div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-admin-champ" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-admin-muted/40"><span>{Number(g.current_value).toLocaleString('pt-BR')}</span><span>meta {Number(g.target_value).toLocaleString('pt-BR')}</span></div>
                </div>
              )
            })}
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Ranking da rede</p>
            {units.length === 0 ? <p className="text-admin-muted/40 text-xs">Cadastre unidades</p> : (
              <div className="space-y-2">{ranking.sort((a, b) => b.count - a.count).map((r, idx) => (
                <div key={r.unit.id} className="flex items-center gap-3">
                  <span className={`w-5 text-center text-sm font-medium ${idx === 0 ? 'text-admin-champ' : 'text-admin-muted/40'}`}>{idx + 1}</span>
                  <span className="flex-1 text-admin-text text-sm truncate">{r.unit.name}</span>
                  <span className="text-admin-muted/50 text-xs">{r.count} metas</span>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      ))}

      {/* ---------- MODAIS ---------- */}
      {modal === 'unit' && (
        <Modal title="Nova unidade" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Loja Centro SP" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Cidade"><input value={form.city || ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} /></Fld><Fld label="Estado"><input value={form.state || ''} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={inputCls} maxLength={2} placeholder="SP" /></Fld></div>
            <Fld label="Endereço"><input value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Telefone"><input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></Fld><Fld label="E-mail"><input value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} /></Fld></div>
          </div>
          <ModalActions onSave={saveUnit} onClose={close} label="Criar unidade" />
        </Modal>
      )}

      {modal === 'comm' && (
        <Modal title="Novo comunicado" onClose={close} wide>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={Object.entries(COMM_TYPE_LABELS).map(([value, label]) => ({ value, label }))} /></Fld><Fld label="Prioridade"><GlassSelect value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={['low', 'normal', 'high', 'urgent']} /></Fld></div>
            <Fld label="Conteúdo *"><textarea value={form.content || ''} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} className={`${inputCls} resize-none`} /></Fld>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!!form.requires_confirmation} onChange={(e) => setForm((f) => ({ ...f, requires_confirmation: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Exigir confirmação de leitura</span></label>
          </div>
          <ModalActions onSave={saveComm} onClose={close} label="Publicar" />
        </Modal>
      )}

      {modal === 'vm' && (
        <Modal title="Nova campanha de VM" onClose={close} wide>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Vitrine de Páscoa" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'vitrine', label: 'Vitrine' }, { value: 'layout', label: 'Layout de loja' }, { value: 'campanha', label: 'Campanha' }]} /></Fld><Fld label="Status"><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={Object.entries(VM_STATUS).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Início"><GlassDate value={form.start_date || ''} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} /></Fld><Fld label="Fim"><GlassDate value={form.end_date || ''} onChange={(v) => setForm((f) => ({ ...f, end_date: v }))} /></Fld></div>
            <Fld label="Instruções"><textarea value={form.instructions || ''} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Como a loja deve montar a vitrine…" /></Fld>
          </div>
          <ModalActions onSave={saveVM} onClose={close} label="Criar campanha" />
        </Modal>
      )}

      {modal === 'audit' && (
        <Modal title="Nova auditoria" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Auditoria mensal" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Unidade"><GlassSelect value={form.unit_id || ''} onChange={(v) => setForm((f) => ({ ...f, unit_id: v }))} options={unitOptions} /></Fld><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'operacional', label: 'Operacional' }, { value: 'qualidade', label: 'Qualidade' }, { value: 'compliance', label: 'Compliance' }, { value: 'vm', label: 'Visual Merch.' }]} /></Fld></div>
            <div className="grid grid-cols-3 gap-3"><Fld label="Status"><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={Object.entries(AUDIT_STATUS).map(([value, label]) => ({ value, label }))} /></Fld><Fld label="Nota"><input type="number" value={form.score || ''} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} className={inputCls} /></Fld><Fld label="Máx."><input type="number" value={form.max_score || ''} onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Observações"><textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <ModalActions onSave={saveAudit} onClose={close} label="Registrar auditoria" />
        </Modal>
      )}

      {modal === 'incident' && (
        <Modal title="Nova ocorrência" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Unidade"><GlassSelect value={form.unit_id || ''} onChange={(v) => setForm((f) => ({ ...f, unit_id: v }))} options={unitOptions} /></Fld><Fld label="Gravidade"><GlassSelect value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} options={Object.entries(INC_SEV).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <ModalActions onSave={saveIncident} onClose={close} label="Registrar" />
        </Modal>
      )}

      {modal === 'goal' && (
        <Modal title="Nova meta" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Faturamento do mês" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Unidade"><GlassSelect value={form.unit_id || ''} onChange={(v) => setForm((f) => ({ ...f, unit_id: v }))} options={unitOptions} /></Fld><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'sales', label: 'Vendas' }, { value: 'ticket', label: 'Ticket médio' }, { value: 'nps', label: 'NPS' }, { value: 'other', label: 'Outro' }]} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Alvo"><input type="number" value={form.target_value || ''} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} className={inputCls} /></Fld><Fld label="Atual"><input type="number" value={form.current_value || ''} onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Início"><GlassDate value={form.period_start || ''} onChange={(v) => setForm((f) => ({ ...f, period_start: v }))} /></Fld><Fld label="Fim"><GlassDate value={form.period_end || ''} onChange={(v) => setForm((f) => ({ ...f, period_end: v }))} /></Fld></div>
          </div>
          <ModalActions onSave={saveGoal} onClose={close} label="Criar meta" />
        </Modal>
      )}

      {/* Detalhe VM: execuções por loja */}
      {vmDetail && (
        <Modal title={vmDetail.title} onClose={() => setVmDetail(null)} wide>
          {vmDetail.instructions && <p className="text-admin-muted/60 text-sm mb-4">{vmDetail.instructions}</p>}
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Execuções das lojas</p>
          {vmExecs.length === 0 ? <p className="text-admin-muted/40 text-sm text-center py-6">Nenhuma loja enviou execução ainda</p> : (
            <div className="space-y-2">{vmExecs.map((ex) => (
              <div key={ex.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm">{unitName(ex.unit_id)}</p><p className="text-admin-muted/40 text-xs">{VM_EXEC[ex.status] || ex.status}{ex.photos?.length ? ` · ${ex.photos.length} fotos` : ''}</p></div>
                {ex.status === 'submitted' && (
                  <div className="flex gap-2 shrink-0"><button onClick={() => reviewExec(ex, 'approved')} className="text-xs text-admin-sage hover:underline">Aprovar</button><button onClick={() => reviewExec(ex, 'rejected')} className="text-xs text-admin-rose hover:underline">Reprovar</button></div>
                )}
              </div>
            ))}</div>
          )}
        </Modal>
      )}
    </div>
  )
}

function ModalActions({ onSave, onClose, label }) {
  return (
    <div className="flex gap-3 mt-6">
      <button onClick={onSave} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{label}</button>
      <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
    </div>
  )
}
