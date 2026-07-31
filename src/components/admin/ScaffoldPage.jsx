import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

// ============================================================
// Motor de ARQUÉTIPOS: cada tipo de página tem abas, campos, status,
// KPIs e fluxo PRÓPRIOS. Nada de template único — a página de Campanhas
// não se parece com a de Auditorias, Documentos, Treinamentos, etc.
// ============================================================

const F = { // atalhos de campos comuns
  owner: { key: 'owner', label: 'Responsável', type: 'text' },
  due: { key: 'due_date', label: 'Prazo', type: 'date' },
  priority: { key: 'priority', label: 'Prioridade', type: 'select', options: { low: 'Baixa', medium: 'Média', high: 'Alta' } },
}

const ARCHETYPES = {
  campaign: {
    match: /campanh|marketing|an[uú]ncio|m[ií]dia social|redes sociais|e-?mail mkt|email marketing|sms|newsletter|disparo|push/i,
    icon: 'star', noun: 'campanha',
    statuses: { idea: 'Ideia', planning: 'Planejamento', active: 'Em veiculação', done: 'Concluída', paused: 'Pausada' },
    fields: [{ key: 'channel', label: 'Canal', type: 'select', options: { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS', social: 'Redes sociais', loja: 'Loja', ads: 'Mídia paga' } }, { key: 'audience', label: 'Público-alvo', type: 'text' }, { key: 'goal', label: 'Objetivo', type: 'text' }, F.due],
    tabs: ['overview', 'planning', 'active', 'done', 'kanban'],
    kpiFocus: [['active', 'Em veiculação'], ['done', 'Concluídas']],
  },
  audit: {
    match: /auditor|complian|conformidad|vistor|fiscaliza|inspe[çc]/i,
    icon: 'check', noun: 'auditoria',
    statuses: { open: 'Aberta', progress: 'Em análise', nonconform: 'Não conformidade', action: 'Plano de ação', done: 'Concluída' },
    fields: [{ key: 'area', label: 'Área/loja', type: 'text' }, { key: 'severity', label: 'Severidade', type: 'select', options: { low: 'Leve', medium: 'Moderada', high: 'Crítica' } }, F.owner, F.due],
    tabs: ['overview', 'open', 'nonconform', 'action', 'done'],
    kpiFocus: [['nonconform', 'Não conformidades'], ['action', 'Plano de ação']],
  },
  document: {
    match: /document|contrat|pol[ií]tic|procedim|\bpop\b|manual|norma|termo/i,
    icon: 'book', noun: 'documento',
    statuses: { draft: 'Rascunho', review: 'Em revisão', valid: 'Vigente', expired: 'Vencido', archived: 'Arquivado' },
    fields: [{ key: 'version', label: 'Versão', type: 'text' }, { key: 'category', label: 'Tipo', type: 'text' }, { key: 'valid_until', label: 'Validade', type: 'date' }, F.owner],
    tabs: ['valid', 'review', 'draft', 'archived', 'overview'],
    kpiFocus: [['valid', 'Vigentes'], ['review', 'Em revisão']],
  },
  training: {
    match: /trein|curso|aula|certific|onboarding|academ|capacita|avalia[çc][aã]o de/i,
    icon: 'book', noun: 'treinamento',
    statuses: { planned: 'Planejado', ongoing: 'Em andamento', done: 'Concluído', certified: 'Certificado' },
    fields: [{ key: 'audience', label: 'Turma/pessoa', type: 'text' }, { key: 'category', label: 'Trilha', type: 'text' }, { key: 'workload', label: 'Carga (h)', type: 'text' }, F.due],
    tabs: ['overview', 'planned', 'ongoing', 'certified'],
    kpiFocus: [['ongoing', 'Em andamento'], ['certified', 'Certificados']],
  },
  integration: {
    match: /canal|integr|webhook|\bapi\b|conex|marketplace|gateway/i,
    icon: 'link', noun: 'integração',
    statuses: { planned: 'A conectar', testing: 'Em teste', connected: 'Conectado', error: 'Com erro' },
    fields: [{ key: 'provider', label: 'Provedor', type: 'text' }, { key: 'type', label: 'Tipo', type: 'select', options: { marketplace: 'Marketplace', payment: 'Pagamento', shipping: 'Frete', messaging: 'Mensageria', erp: 'ERP', other: 'Outro' } }, F.owner],
    tabs: ['overview', 'connected', 'testing', 'planned', 'error'],
    kpiFocus: [['connected', 'Conectadas'], ['error', 'Com erro']],
  },
  supply: {
    match: /fornec|compra|estoque|invent|equipa|ativo|manuten|insumo|almox/i,
    icon: 'box', noun: 'item',
    statuses: { requested: 'Solicitado', approved: 'Aprovado', received: 'Recebido', active: 'Em uso', maintenance: 'Manutenção' },
    fields: [{ key: 'supplier', label: 'Fornecedor', type: 'text' }, { key: 'qty', label: 'Quantidade', type: 'text' }, { key: 'cost', label: 'Custo (R$)', type: 'text' }, F.due],
    tabs: ['overview', 'requested', 'approved', 'active', 'maintenance'],
    kpiFocus: [['requested', 'Solicitados'], ['maintenance', 'Em manutenção']],
  },
  task: {
    match: /tarefa|fluxo|processo|aprova|opera[çc]|checklist|a[çc][aã]o|incidente|ocorr|pend[êe]ncia/i,
    icon: 'check', noun: 'tarefa',
    statuses: { todo: 'A fazer', doing: 'Em andamento', blocked: 'Bloqueada', done: 'Concluída' },
    fields: [F.owner, F.priority, F.due, { key: 'category', label: 'Categoria', type: 'text' }],
    tabs: ['overview', 'kanban', 'todo', 'done'],
    kpiFocus: [['doing', 'Em andamento'], ['blocked', 'Bloqueadas']],
  },
  schedule: {
    match: /agenda|escala|calend|hor[aá]ri|reserva|compromiss|visita|reuni/i,
    icon: 'calendar', noun: 'compromisso',
    statuses: { scheduled: 'Agendado', confirmed: 'Confirmado', done: 'Realizado', cancelled: 'Cancelado' },
    fields: [{ key: 'when', label: 'Data', type: 'date' }, { key: 'time', label: 'Hora', type: 'text' }, { key: 'who', label: 'Com quem', type: 'text' }, F.owner],
    tabs: ['overview', 'scheduled', 'confirmed', 'done'],
    kpiFocus: [['scheduled', 'Agendados'], ['confirmed', 'Confirmados']],
  },
  goal: {
    match: /meta|objetivo|comiss|ranking|desempenh|kpi/i,
    icon: 'chart', noun: 'meta',
    statuses: { active: 'Em andamento', achieved: 'Atingida', missed: 'Não atingida' },
    fields: [{ key: 'target', label: 'Alvo', type: 'text' }, { key: 'current', label: 'Realizado', type: 'text' }, { key: 'period', label: 'Período', type: 'text' }, F.owner],
    tabs: ['overview', 'active', 'achieved'],
    kpiFocus: [['active', 'Em andamento'], ['achieved', 'Atingidas']],
  },
  report: {
    match: /relat[oó]ri|indicador|dashboard|m[eé]trica|analytic|convers|heatmap|export/i,
    icon: 'chart', noun: 'relatório',
    statuses: { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' },
    fields: [{ key: 'period', label: 'Período', type: 'text' }, { key: 'source', label: 'Fonte', type: 'text' }, F.owner],
    tabs: ['overview', 'published', 'draft'],
    kpiFocus: [['published', 'Publicados'], ['draft', 'Rascunhos']],
  },
  content: {
    match: /conte[uú]do|artigo|post|p[aá]gina|banner|arte|foto|v[ií]deo|biblioteca|m[ií]dia/i,
    icon: 'image', noun: 'conteúdo',
    statuses: { idea: 'Ideia', producing: 'Em produção', review: 'Revisão', published: 'Publicado' },
    fields: [{ key: 'format', label: 'Formato', type: 'select', options: { post: 'Post', article: 'Artigo', video: 'Vídeo', banner: 'Banner', page: 'Página' } }, F.owner, F.due],
    tabs: ['overview', 'producing', 'review', 'published', 'kanban'],
    kpiFocus: [['producing', 'Em produção'], ['published', 'Publicados']],
  },
  generic: {
    match: /.*/, icon: 'spark', noun: 'registro',
    statuses: { open: 'A fazer', doing: 'Em andamento', done: 'Concluído' },
    fields: [{ key: 'category', label: 'Categoria', type: 'text' }, F.priority, F.owner, F.due],
    tabs: ['overview', 'kanban', 'open', 'done'],
    kpiFocus: [['doing', 'Em andamento'], ['done', 'Concluídos']],
  },
}

function archetypeFor(label) {
  const l = label || ''
  for (const k of Object.keys(ARCHETYPES)) { if (k !== 'generic' && ARCHETYPES[k].match.test(l)) return ARCHETYPES[k] }
  return ARCHETYPES.generic
}

const STATUS_TONE = ['bg-white/[0.05] text-admin-muted/60', 'bg-admin-gold/10 text-admin-gold', 'bg-admin-champ/10 text-admin-champ', 'bg-admin-sage/10 text-admin-sage', 'bg-admin-rose/10 text-admin-rose']
const todayStr = () => new Date().toISOString().slice(0, 10)

export function ScaffoldPage({ item, parentLabel, onNavigate }) {
  const pages = item.pages || []
  if (pages.length > 0) return <ModuleGrid item={item} parentLabel={parentLabel} onNavigate={onNavigate} />
  return <ArchetypePage item={item} parentLabel={parentLabel} />
}

function Breadcrumb({ parentLabel, label }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-admin-muted/50 mb-3">
      {parentLabel && (<><span>{parentLabel}</span><span className="opacity-30">/</span></>)}
      <span className="text-admin-champ/70">{label}</span>
    </div>
  )
}

function ModuleGrid({ item, parentLabel, onNavigate }) {
  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" /></div>
        <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{item.pages.length} áreas neste módulo</p></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {item.pages.map((p) => {
          const a = archetypeFor(p.label)
          return (
            <button key={p.key} onClick={() => onNavigate?.(p.route || p.key)} className="glass rounded-2xl p-5 text-left border border-transparent hover:border-admin-champ/25 lift transition-all">
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Icon name={a.icon} className="w-4 h-4 text-admin-champ/60" /><p className="text-admin-text text-sm font-medium">{p.label}</p></div><Icon name="external" className="w-3.5 h-3.5 text-admin-champ/40" /></div>
              <p className="text-admin-muted/40 text-xs">Gerir {a.noun}s de {p.label.toLowerCase()}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ArchetypePage({ item, parentLabel }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const arc = useMemo(() => archetypeFor(item.label), [item.key])
  const statusKeys = Object.keys(arc.statuses)
  const statusTone = (sk) => STATUS_TONE[statusKeys.indexOf(sk) % STATUS_TONE.length]
  const [tab, setTab] = useState(arc.tabs[0])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('module_records').select('*').eq('page_key', item.key).order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load(); setTab(arc.tabs[0]) }, [item.key])

  const dataOf = (r) => r.data || {}
  const openNew = (preset = {}) => { setEditing(null); setForm({ title: '', notes: '', status: statusKeys[0], ...preset }); setModal(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ title: r.title, notes: r.notes || '', status: r.status || statusKeys[0], ...dataOf(r) }); setModal(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const data = {}
    arc.fields.forEach((f) => { data[f.key] = form[f.key] ?? null })
    if (editing) await supabase.from('module_records').update({ title: form.title, notes: form.notes, status: form.status, data, updated_at: new Date().toISOString() }).eq('id', editing)
    else await supabase.from('module_records').insert({ tenant_id: tenantId, page_key: item.key, title: form.title, notes: form.notes, status: form.status || statusKeys[0], data, created_by: profile?.user_id })
    setModal(false); setEditing(null); load()
  }
  const setStatus = async (r, status) => { await supabase.from('module_records').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('module_records').delete().eq('id', id); load() }

  const count = (sk) => records.filter((r) => (r.status || statusKeys[0]) === sk).length
  const labelFor = (f, v) => (f.options ? f.options[v] || v : v)

  const Card = ({ r }) => {
    const d = dataOf(r)
    return (
      <div className="glass rounded-xl px-4 py-3 group">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-admin-text text-sm">{r.title}</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-lg ${statusTone(r.status || statusKeys[0])}`}>{arc.statuses[r.status] || r.status}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {arc.fields.map((f) => d[f.key] ? <span key={f.key} className="text-admin-muted/50 text-xs">{f.type === 'date' ? new Date(d[f.key] + 'T00:00:00').toLocaleDateString('pt-BR') : labelFor(f, d[f.key])}</span> : null)}
            </div>
            {r.notes && <p className="text-admin-muted/50 text-xs mt-1">{r.notes}</p>}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <GlassSelect value={r.status || statusKeys[0]} onChange={(v) => setStatus(r, v)} options={statusKeys.map((s) => ({ value: s, label: arc.statuses[s] }))} className="w-36" />
            <button onClick={() => openEdit(r)} className="p-1.5 text-admin-muted hover:text-admin-champ rounded-lg hover:bg-white/[0.05]"><Icon name="pen" className="w-3.5 h-3.5" /></button>
            <button onClick={() => del(r.id)} className="p-1.5 text-admin-muted hover:text-admin-rose rounded-lg hover:bg-white/[0.05]"><Icon name="x" className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    )
  }

  const tabLabel = (t) => t === 'overview' ? 'Painel' : t === 'kanban' ? 'Fluxo' : (arc.statuses[t] || t)

  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={arc.icon} className="w-5 h-5 text-admin-champ/80" /></div>
          <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{records.length} {arc.noun}(s) · gestão de {item.label.toLowerCase()}</p></div>
        </div>
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />{`Nova ${arc.noun}`}</button>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {arc.tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{tabLabel(t)}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total</p><p className="text-admin-champ text-2xl font-medium">{records.length}</p></div>
                {arc.kpiFocus.map(([sk, lbl]) => (
                  <div key={sk} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{lbl}</p><p className="text-admin-text text-2xl font-medium">{count(sk)}</p></div>
                ))}
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Concluídos</p><p className="text-admin-sage text-2xl font-medium">{records.filter((r) => ['done', 'certified', 'published', 'achieved', 'received', 'valid', 'connected'].includes(r.status)).length}</p></div>
              </div>
              <div className="glass rounded-2xl p-5">
                <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Distribuição por etapa</p>
                <div className="space-y-2">
                  {statusKeys.map((sk) => { const c = count(sk); const pct = records.length ? Math.round((c / records.length) * 100) : 0; return (
                    <div key={sk}><div className="flex justify-between text-xs mb-1"><span className="text-admin-text">{arc.statuses[sk]}</span><span className="text-admin-muted/50">{c}</span></div><div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-admin-champ/70" style={{ width: `${pct}%` }} /></div></div>
                  ) })}
                </div>
              </div>
              <div>
                <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Recentes</p>
                {records.slice(0, 5).length === 0 ? <p className="text-admin-muted/40 text-sm">Nada registrado ainda. Crie a primeira {arc.noun}.</p> : <div className="space-y-2">{records.slice(0, 5).map((r) => <Card key={r.id} r={r} />)}</div>}
              </div>
            </div>
          )}

          {tab === 'kanban' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${statusKeys.length}, minmax(0, 1fr))` }}>
              {statusKeys.map((sk, si) => {
                const col = records.filter((r) => (r.status || statusKeys[0]) === sk)
                return (
                  <div key={sk} className="glass rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3"><p className="text-sm text-admin-text font-medium">{arc.statuses[sk]}</p><span className="text-admin-muted/40 text-xs">{col.length}</span></div>
                    <div className="space-y-2 min-h-[40px]">
                      {col.map((r) => (
                        <div key={r.id} className="glass-soft rounded-xl px-3 py-2.5">
                          <p className="text-admin-text text-sm">{r.title}</p>
                          <div className="flex gap-1 mt-2">
                            {si > 0 && <button onClick={() => setStatus(r, statusKeys[si - 1])} className="text-[10px] text-admin-muted/60 hover:text-admin-champ">←</button>}
                            {si < statusKeys.length - 1 && <button onClick={() => setStatus(r, statusKeys[si + 1])} className="text-[10px] text-admin-champ/70 hover:text-admin-champ ml-auto">→</button>}
                          </div>
                        </div>
                      ))}
                      {col.length === 0 && <p className="text-admin-muted/25 text-xs text-center py-3">—</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {statusKeys.includes(tab) && (() => {
            const list = records.filter((r) => (r.status || statusKeys[0]) === tab)
            return list.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center max-w-2xl"><div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center mx-auto mb-4"><Icon name={arc.icon} className="w-5 h-5 text-admin-champ/70" /></div><p className="text-admin-text text-sm font-medium mb-1">Nada em “{arc.statuses[tab]}”</p><button onClick={() => openNew({ status: tab })} className="mt-3 inline-flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar aqui</button></div>
            ) : <div className="space-y-2">{list.map((r) => <Card key={r.id} r={r} />)}</div>
          })()}
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? `Editar ${arc.noun}` : `Nova ${arc.noun}`}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Etapa</label><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={statusKeys.map((s) => ({ value: s, label: arc.statuses[s] }))} /></div>
              {arc.fields.map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{f.label}</label>
                  {f.type === 'select' ? <GlassSelect value={form[f.key] || ''} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} options={[{ value: '', label: '—' }, ...Object.entries(f.options).map(([value, label]) => ({ value, label }))]} />
                    : f.type === 'date' ? <GlassDate value={form[f.key] || ''} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                    : <input value={form[f.key] || ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />}
                </div>
              ))}
              <div className="col-span-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Anotações</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Adicionar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
