import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { logAudit } from '../../lib/audit'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'

const MODELS = { studio: 'Seravie Studio', experience_center: 'Experience Center', regional_hub: 'Regional Hub', signature: 'Signature Center' }
const LEVELS = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', signature: 'Signature' }
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

// ---- Expansão: kanban de triagem de leads com arrastar e soltar ----
const STAGES = [
  ['prospect', 'Prospecção', 'border-admin-muted/30'],
  ['qualified', 'Qualificado', 'border-admin-champ/40'],
  ['negotiation', 'Negociação', 'border-admin-gold/40'],
  ['contract', 'Contrato', 'border-admin-champ/40'],
  ['signed', 'Assinado', 'border-admin-sage/50'],
  ['lost', 'Perdido', 'border-admin-rose/40'],
]

export function ExpansaoPanel({ notify }) {
  const { profile, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayDelete = canManage ? canManage('expansao') : true
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const load = async () => { setLoading(true); const { data } = await supabase.from('franchise_leads').select('*').order('created_at', { ascending: false }); setLeads(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = (stage) => { setEditing(null); setForm({ name: '', region: '', segment: '', model: '', investment: '', contact: '', phone: '', email: '', notes: '', stage: stage || 'prospect' }); setModal(true) }
  const openEdit = (l) => { setEditing(l); setForm({ name: l.name, region: l.region || '', segment: l.segment || '', model: l.model || '', investment: l.investment ?? '', contact: l.contact || '', phone: l.phone || '', email: l.email || '', notes: l.notes || '', stage: l.stage || 'prospect' }); setModal(true) }

  const save = async () => {
    if (!form.name.trim()) return notify('Informe o candidato', 'error')
    const payload = { name: form.name, region: form.region, segment: form.segment, model: form.model || null, investment: Number(form.investment) || null, contact: form.contact, phone: form.phone, email: form.email, notes: form.notes, stage: form.stage }
    let error, id
    if (editing) { const r = await supabase.from('franchise_leads').update(payload).eq('id', editing.id); error = r.error; id = editing.id }
    else { const r = await supabase.from('franchise_leads').insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'franchise_leads', resource_id: id, new_data: payload }, tenantId)
    setModal(false); setEditing(null); load()
  }
  const remove = async (l) => {
    if (!confirm(`Remover o candidato "${l.name}"?`)) return
    const { error } = await supabase.from('franchise_leads').delete().eq('id', l.id)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'franchise_leads', resource_id: l.id, old_data: l }, tenantId)
    notify('Candidato removido', 'success'); load()
  }

  // arrasta e solta
  const moveTo = async (stage) => {
    const id = dragId; setDragId(null); setOver(null)
    if (!id) return
    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.stage === stage) return
    setLeads((ls) => ls.map((l) => l.id === id ? { ...l, stage } : l)) // otimista
    const { error } = await supabase.from('franchise_leads').update({ stage }).eq('id', id)
    if (error) { notify('Erro ao mover', 'error'); load(); return }
    logAudit({ action: 'update', resource_type: 'franchise_leads', resource_id: id, new_data: { stage } }, tenantId)
  }

  const total = leads.length
  const pipeline = leads.filter((l) => l.stage !== 'lost').reduce((s, l) => s + Number(l.investment || 0), 0)
  const signed = leads.filter((l) => l.stage === 'signed').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Expansão</h1><p className="text-admin-muted/60 text-sm mt-1">Triagem de candidatos a franquia — arraste os cards entre as etapas</p></div>
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo candidato</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Candidatos</p><p className="text-admin-champ text-2xl font-medium">{total}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Assinados</p><p className="text-admin-sage text-2xl font-medium">{signed}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Pipeline</p><p className="text-admin-gold text-2xl font-medium">{brl(pipeline)}</p></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <div className="flex flex-wrap gap-3 pb-3">
          {STAGES.map(([sk, sl, border]) => {
            const col = leads.filter((l) => (l.stage || 'prospect') === sk)
            const colTotal = col.reduce((s, l) => s + Number(l.investment || 0), 0)
            return (
              <div key={sk}
                onDragOver={(e) => { e.preventDefault(); setOver(sk) }}
                onDragLeave={() => setOver((o) => (o === sk ? null : o))}
                onDrop={() => moveTo(sk)}
                className={`flex-1 min-w-[220px] glass rounded-2xl p-3 border ${over === sk ? 'border-admin-champ/60 bg-admin-champ/[0.04]' : border} transition-colors`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div><p className="text-sm text-admin-text font-medium">{sl}</p><p className="text-admin-muted/40 text-[10px]">{col.length} · {brl(colTotal)}</p></div>
                  <button onClick={() => openNew(sk)} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="plus" className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {col.map((l) => (
                    <div key={l.id} draggable
                      onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOver(null) }}
                      className={`glass-soft rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing group ${dragId === l.id ? 'opacity-40' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-admin-text text-sm leading-tight">{l.name}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEdit(l)} className="p-1 text-admin-muted hover:text-admin-champ rounded"><Icon name="pen" className="w-3 h-3" /></button>
                          {mayDelete && <button onClick={() => remove(l)} className="p-1 text-admin-muted hover:text-admin-rose rounded"><Icon name="x" className="w-3 h-3" /></button>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {l.region && <span className="text-[10px] text-admin-muted/50">{l.region}</span>}
                        {l.segment && <span className="text-[10px] text-admin-muted/50">· {l.segment}</span>}
                        {l.model && <span className="text-[10px] text-admin-champ/60">· {MODELS[l.model] || l.model}</span>}
                      </div>
                      {l.investment > 0 && <p className="text-admin-gold/80 text-xs mt-1">{brl(l.investment)}</p>}
                    </div>
                  ))}
                  {col.length === 0 && <div className="text-admin-muted/25 text-[11px] text-center py-4 border border-dashed border-white/[0.06] rounded-xl">solte aqui</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar candidato' : 'Novo candidato'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Candidato *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Região</label><input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Segmento</label><input value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Modelo</label><GlassSelect value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} options={[{ value: '', label: '—' }, ...Object.entries(MODELS).map(([value, label]) => ({ value, label }))]} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Investimento (R$)</label><input type="number" value={form.investment} onChange={(e) => setForm((f) => ({ ...f, investment: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Etapa</label><GlassSelect value={form.stage} onChange={(v) => setForm((f) => ({ ...f, stage: v }))} options={STAGES.map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Contato</label><input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Telefone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">E-mail</label><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Observações</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Adicionar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Franqueados: unidades da rede ----
export function FranqueadosPanel({ notify }) {
  const STATUS = { prospect: 'Em implantação', active: 'Operando', paused: 'Pausada', closed: 'Encerrada' }
  return (
    <ResourcePanel notify={notify} module="franqueados" table="units" title="Franqueados" subtitle="unidades da rede" icon="building" exportName="franqueados"
      orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
      fields={[
        { key: 'name', label: 'Unidade', type: 'text', primary: true, required: true, full: true },
        { key: 'model', label: 'Modelo', type: 'select', options: MODELS, default: 'studio', chip: true, filter: true },
        { key: 'owner_name', label: 'Franqueado(a)', type: 'text', chip: true },
        { key: 'region', label: 'Região', type: 'text', chip: true },
        { key: 'city', label: 'Cidade', type: 'text' },
        { key: 'state', label: 'UF', type: 'text' },
        { key: 'phone', label: 'Telefone', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'opening_date', label: 'Inauguração', type: 'date' },
        { key: 'cert_level', label: 'Certificação', type: 'select', options: LEVELS },
        { key: 'status', label: 'Situação', type: 'status', options: STATUS, default: 'active', filter: true },
      ]}
      kpis={[
        { label: 'Unidades', calc: (r) => r.length, fmt: 'int' },
        { label: 'Operando', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Em implantação', calc: (r) => r.filter((x) => x.status === 'prospect').length, fmt: 'int' },
        { label: 'Signature', calc: (r) => r.filter((x) => x.model === 'signature').length, fmt: 'int' },
      ]}
    />
  )
}

// ---- Implantações (kanban por etapa de obra) ----
export function ImplantacoesPanel({ notify }) {
  return (
    <KanbanBoard notify={notify} module="implantacoes" table="implementations" title="Implantações" subtitle="aberturas em andamento" icon="layout"
      stageField="stage" stageLabel="Etapa" primary="title"
      stages={[
        ['briefing', 'Briefing', 'border-admin-muted/30'],
        ['arquitetura', 'Arquitetura', 'border-admin-champ/40'],
        ['mobiliario', 'Mobiliário', 'border-admin-gold/40'],
        ['equipamentos', 'Equipamentos', 'border-admin-gold/40'],
        ['marketing', 'Marketing', 'border-admin-champ/40'],
        ['inauguracao', 'Inauguração', 'border-admin-sage/50'],
      ]}
      chips={['unit_ref', 'model', 'deadline']}
      fields={[
        { key: 'title', label: 'Projeto', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Abertura Unidade Centro' },
        { key: 'unit_ref', label: 'Unidade', type: 'text' },
        { key: 'model', label: 'Modelo', type: 'select', options: MODELS },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'deadline', label: 'Inauguração prevista', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Implantações', fmt: 'int', calc: (r) => r.length },
        { label: 'Em arquitetura', fmt: 'int', calc: (r) => r.filter((x) => x.stage === 'arquitetura').length },
        { label: 'Prontas p/ inaugurar', fmt: 'int', calc: (r) => r.filter((x) => x.stage === 'inauguracao').length },
      ]}
    />
  )
}

// ---- Experience Standards ----
export function StandardsPanel({ notify }) {
  const CAT = { arquitetura: 'Arquitetura', iluminacao: 'Iluminação', aromas: 'Aromas', playlist: 'Playlist', uniformes: 'Uniformes', vitrine: 'Vitrine', atendimento: 'Atendimento', comunicacao: 'Comunicação', embalagem: 'Embalagem', sinalizacao: 'Sinalização', paisagismo: 'Paisagismo', fotografia: 'Fotografia', redes_sociais: 'Redes sociais', limpeza: 'Limpeza' }
  const STATUS = { draft: 'Rascunho', active: 'Vigente', archived: 'Arquivado' }
  return (
    <ResourcePanel notify={notify} module="standards" table="experience_standards" title="Experience Standards" subtitle="padrões oficiais da marca" icon="star" exportName="experience-standards"
      orderBy={{ column: 'created_at', ascending: false }} inject={{ status: 'active' }}
      fields={[
        { key: 'title', label: 'Padrão', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'select', options: CAT, chip: true, filter: true },
        { key: 'segment', label: 'Segmento', type: 'text', chip: true },
        { key: 'model', label: 'Modelo de unidade', type: 'select', options: MODELS, chip: true, filter: true },
        { key: 'version', label: 'Versão', type: 'text', chip: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'file_url', label: 'Arquivo/manual (URL)', type: 'text', full: true },
        { key: 'spec', label: 'Especificação', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Padrões', calc: (r) => r.length, fmt: 'int' },
        { label: 'Vigentes', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Categorias', calc: (r) => new Set(r.map((x) => x.category).filter(Boolean)).size, fmt: 'int' },
      ]}
    />
  )
}

// ---- Experience Certification (kanban por situação + planos de correção automáticos) ----
const PLAN_STATUS = { open: 'Aberto', in_progress: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' }

function CertKanban({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id

  // Quando uma unidade é reprovada, gera automaticamente um plano de correção.
  const ensurePlan = async (cert, stage) => {
    if (stage !== 'failed' || !cert?.id) return
    const { data: existing } = await supabase.from('action_plans').select('id').eq('certification_id', cert.id).neq('status', 'done').limit(1)
    if (existing && existing.length) return
    let unitName = ''
    if (cert.unit_id) { const { data: u } = await supabase.from('units').select('name').eq('id', cert.unit_id).single(); unitName = u?.name || '' }
    const due = new Date(); due.setDate(due.getDate() + 30)
    const { error } = await supabase.from('action_plans').insert({
      tenant_id: tenantId,
      certification_id: cert.id,
      unit_id: cert.unit_id || null,
      title: `Plano de correção — ${unitName || 'unidade'}`,
      description: 'Gerado automaticamente após reprovação na Experience Certification. Defina as ações corretivas e os prazos para recertificação.',
      status: 'open',
      source: 'certification',
      due_date: due.toISOString().slice(0, 10),
    })
    if (error) return notify('Auditoria salva, mas falhou ao gerar o plano de correção', 'error')
    logAudit({ action: 'create', resource_type: 'action_plans', new_data: { certification_id: cert.id, source: 'certification' } }, tenantId)
    notify('Reprovação registrada — plano de correção criado automaticamente na aba Planos de Correção', 'success')
  }

  return (
    <KanbanBoard notify={notify} module="certification" table="unit_certifications" title="" subtitle="auditorias e selos da rede" icon="check"
      stageField="status" stageLabel="Situação" primary="unit_id" onStage={ensurePlan}
      stages={[
        ['pending', 'Pendente', 'border-admin-muted/30'],
        ['certified', 'Certificada', 'border-admin-sage/50'],
        ['failed', 'Reprovada', 'border-admin-rose/40'],
        ['expired', 'Vencida', 'border-admin-gold/40'],
      ]}
      chips={['level', 'score', 'audited_at']}
      fields={[
        { key: 'unit_id', label: 'Unidade', type: 'ref', refTable: 'units', refLabel: 'name', primary: true, required: true, placeholder: '— selecione a unidade —' },
        { key: 'score', label: 'Pontuação (0–100)', type: 'int' },
        { key: 'level', label: 'Nível', type: 'select', options: LEVELS, default: 'bronze' },
        { key: 'audited_at', label: 'Data da auditoria', type: 'date' },
        { key: 'valid_until', label: 'Validade do selo', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Auditorias', fmt: 'int', calc: (r) => r.length },
        { label: 'Certificadas', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'certified').length },
        { label: 'Reprovadas', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'failed').length },
        { label: 'Pontuação média', fmt: 'int', calc: (r) => { const v = r.filter((x) => x.score != null); return v.length ? Math.round(v.reduce((s, x) => s + x.score, 0) / v.length) : 0 } },
      ]}
    />
  )
}

function CorrectivePlans({ notify }) {
  return (
    <ResourcePanel notify={notify} module="certification" table="action_plans" embedded exportName="planos-correcao" newLabel="Novo plano"
      orderBy={{ column: 'due_date', ascending: true }}
      baseFilter={{ column: 'source', op: 'eq', value: 'certification' }}
      inject={{ source: 'certification', status: 'open' }}
      fields={[
        { key: 'title', label: 'Plano', type: 'text', primary: true, required: true, full: true, search: true },
        { key: 'unit_id', label: 'Unidade', type: 'ref', refTable: 'units', refLabel: 'name', chip: true, placeholder: '— unidade —' },
        { key: 'due_date', label: 'Prazo', type: 'date', chip: true },
        { key: 'status', label: 'Situação', type: 'status', options: PLAN_STATUS, default: 'open', filter: true },
        { key: 'description', label: 'Ações corretivas', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Planos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Abertos', calc: (r) => r.filter((x) => x.status === 'open' || x.status === 'in_progress').length, fmt: 'int' },
        { label: 'Atrasados', calc: (r) => r.filter((x) => x.status !== 'done' && x.status !== 'cancelled' && x.due_date && x.due_date < new Date().toISOString().slice(0, 10)).length, fmt: 'int' },
        { label: 'Concluídos', calc: (r) => r.filter((x) => x.status === 'done').length, fmt: 'int' },
      ]}
    />
  )
}

export function CertificationPanel({ notify }) {
  return (
    <ResourceTabs title="Experience Certification" subtitle="auditorias, selos e planos de correção da rede"
      tabs={[
        { key: 'audits', label: 'Auditorias', render: () => <CertKanban notify={notify} /> },
        { key: 'plans', label: 'Planos de Correção', render: () => <CorrectivePlans notify={notify} /> },
      ]}
    />
  )
}
