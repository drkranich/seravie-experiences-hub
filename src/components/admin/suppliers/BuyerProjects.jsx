import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { uploadTo } from '../../../lib/storage'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON } from '../../../lib/suppliersMarket'

// Projetos do comprador — "estou criando uma Cafeteria" → fornecedores por categoria.
// Sugere categorias por segmento e vincula fornecedores reais ao projeto.

const SEGMENTS = {
  cafeteria: { label: 'Cafeteria', cats: ['mobiliario', 'iluminacao', 'louças', 'cafe', 'uniformes', 'comunicacao_visual', 'aromatizacao', 'embalagens'] },
  hotel: { label: 'Hotel Boutique', cats: ['mobiliario', 'iluminacao', 'paisagismo', 'aromatizacao', 'uniformes', 'decoracao', 'tecnologia'] },
  floricultura: { label: 'Floricultura', cats: ['paisagismo', 'embalagens', 'mobiliario', 'comunicacao_visual', 'aromatizacao'] },
  chocolateria: { label: 'Chocolateria', cats: ['mobiliario', 'iluminacao', 'embalagens', 'chocolate', 'comunicacao_visual', 'grafica'] },
  vinicola: { label: 'Vinícola', cats: ['mobiliario', 'iluminacao', 'vinho', 'decoracao', 'louças'] },
  boutique: { label: 'Boutique', cats: ['mobiliario', 'iluminacao', 'uniformes', 'comunicacao_visual', 'aromatizacao', 'embalagens'] },
}

export function BuyerProjects({ suppliers, onOpenSupplier, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [projects, setProjects] = useState([])
  const [links, setLinks] = useState({})       // projectId -> [rows]
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ps } = await supabase.from('buyer_projects').select('*').order('created_at', { ascending: false })
      const { data: ls } = await supabase.from('buyer_project_suppliers').select('*')
      const g = {}; (ls || []).forEach((l) => { (g[l.project_id] ||= []).push(l) })
      setProjects(ps || []); setLinks(g)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const { data, error } = await supabase.from('buyer_projects').insert({ ...payload, tenant_id: tenantId }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setProjects((p) => [data, ...p]); setCreating(false); notify?.('Projeto criado', 'success')
    // abre direto a sala do projeto para o usuário começar a montar
    setOpen(data)
  }

  const deleteProject = async (p) => {
    // remove vínculos e o projeto (tenant-scoped por RLS)
    await supabase.from('buyer_project_suppliers').delete().eq('project_id', p.id)
    const { error } = await supabase.from('buyer_projects').delete().eq('id', p.id)
    if (error) return notify?.('Erro ao excluir: ' + error.message, 'error')
    setProjects((ps) => ps.filter((x) => x.id !== p.id))
    setOpen(null); notify?.('Projeto excluído', 'success')
  }

  if (open) {
    const fresh = projects.find((p) => p.id === open.id) || open
    return <ProjectDetail project={fresh} rows={links[open.id] || []} suppliers={suppliers} tenantId={tenantId} onBack={() => { setOpen(null); load() }} onOpenSupplier={onOpenSupplier} reload={load} notify={notify} onDelete={deleteProject} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Projetos</h1><p className="text-admin-muted/50 text-sm mt-1">Monte um projeto (ex.: Cafeteria) e organize os fornecedores por categoria.</p></div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo projeto</button>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-40 animate-pulse opacity-40" />)}</div>
        : projects.length === 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Comece por um segmento</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(SEGMENTS).map(([k, v]) => (
                <button key={k} onClick={() => create({ name: v.label, segment: k, status: 'active' })} className="glass rounded-2xl p-5 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center"><Icon name={CATEGORY_ICON[v.cats[0]] || 'grid'} className="w-5 h-5 text-admin-champ/70" /></div><Icon name="plus" className="w-4 h-4 text-admin-champ/50" /></div>
                  <p className="text-admin-text font-medium">{v.label}</p>
                  <p className="text-admin-muted/40 text-xs mt-1">{v.cats.length} categorias sugeridas</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => { const rows = links[p.id] || []; const seg = SEGMENTS[p.segment]; return (
              <button key={p.id} onClick={() => setOpen(p)} className="group glass rounded-2xl p-5 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                <div className="flex items-center justify-between mb-3"><div className="w-11 h-11 rounded-xl bg-admin-champ/10 flex items-center justify-center"><Icon name={CATEGORY_ICON[seg?.cats?.[0]] || 'grid'} className="w-5 h-5 text-admin-champ/70" /></div><span className="text-[10px] uppercase tracking-wider text-admin-muted/40">{p.status}</span></div>
                <p className="text-admin-text font-medium">{p.name}</p>
                <p className="text-admin-muted/45 text-xs mt-1">{seg?.label || p.segment || 'Projeto'} · {rows.length} fornecedores</p>
              </button>
            )})}
          </div>
        )}

      {creating && <CreateProject onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
    </div>
  )
}

const STYLES = ['Minimalista', 'Aconchegante', 'Rústico', 'Industrial', 'Clássico', 'Contemporâneo', 'Boho', 'Luxo', 'Farmhouse', 'Escandinavo']
const PRIORITIES = [
  { value: 'baixa', label: 'Sem pressa', s: 'bg-admin-sage/15 text-admin-sage' },
  { value: 'media', label: 'Nas próximas semanas', s: 'bg-admin-gold/15 text-admin-gold' },
  { value: 'alta', label: 'Urgente', s: 'bg-admin-rose/15 text-admin-rose' },
]
const brlShort = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR')}`

// Assistente de criação de projeto em 3 passos, inspirado em Houzz/Notion/Monday:
// 1) Identidade  2) Escopo & estilo  3) Orçamento, prazo & fornecedores.
function CreateProject({ onClose, onCreate, notify }) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState({
    name: '', segment: '', cover_url: '', description: '', goals: '',
    style: '', area_m2: '', location: '', priority: 'media', references_url: '',
    budget: '', budget_max: '', start_date: '', deadline: '', categories: [],
    contact_name: '', contact_phone: '',
  })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'suppliers/projects', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  // categorias sugeridas conforme o segmento escolhido
  const suggestedCats = SEGMENTS[f.segment]?.cats || Object.keys(SUPPLIER_CATEGORIES).slice(0, 12)
  const toggleCat = (c) => set('categories', f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c])

  const canNext = step === 1 ? f.name.trim().length > 0 : true
  const submit = () => {
    if (!f.name.trim()) { setStep(1); return notify?.('Informe o nome do projeto', 'error') }
    onCreate({
      name: f.name, segment: f.segment || null, cover_url: f.cover_url || null,
      description: f.description || null, goals: f.goals || null, style: f.style || null,
      area_m2: f.area_m2 ? Number(f.area_m2) : null, location: f.location || null, priority: f.priority || null,
      references_url: f.references_url || null, budget: f.budget ? Number(f.budget) : null,
      budget_max: f.budget_max ? Number(f.budget_max) : null, start_date: f.start_date || null,
      deadline: f.deadline || null, categories: f.categories, contact_name: f.contact_name || null,
      contact_phone: f.contact_phone || null, status: 'active',
    })
  }

  const STEPS = ['Identidade', 'Escopo & estilo', 'Orçamento & fornecedores']

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* header + stepper */}
        <div className="p-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">Novo projeto</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => { const n = i + 1; const active = n === step; const done = n < step; return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <button onClick={() => (n < step || canNext) && setStep(n)} className={`flex items-center gap-2 min-w-0 ${active ? 'text-admin-champ' : done ? 'text-admin-sage' : 'text-admin-muted/40'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${active ? 'bg-admin-champ/20 ring-1 ring-admin-champ/50' : done ? 'bg-admin-sage/20' : 'bg-white/[0.05]'}`}>{done ? <Icon name="check" className="w-3.5 h-3.5" /> : n}</span>
                  <span className="text-[11px] truncate hidden sm:block">{s}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-admin-sage/30' : 'bg-white/[0.06]'}`} />}
              </div>
            )})}
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-3">
          {step === 1 && (
            <>
              <div>
                <label className={lbl}>Imagem de capa do projeto</label>
                <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
                <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-32 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
                  {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar capa'}</span>}
                </button>
              </div>
              <div><label className={lbl}>Nome do projeto *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Cafeteria Centro" className={cls} autoFocus /></div>
              <div><label className={lbl}>Tipo de negócio / segmento</label><GlassSelect value={f.segment} onChange={(v) => set('segment', v)} options={[{ value: '', label: 'Selecione (opcional)' }, ...Object.entries(SEGMENTS).map(([k, v]) => ({ value: k, label: v.label }))]} /></div>
              <div><label className={lbl}>Descrição / conceito</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Descreva a visão do projeto, o conceito e o que quer transmitir…" className={`${cls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Responsável</label><input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Seu nome" className={cls} /></div>
                <div><label className={lbl}>Contato (WhatsApp)</label><input value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="(11) 90000-0000" className={cls} /></div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div><label className={lbl}>Objetivos / entregáveis</label><textarea value={f.goals} onChange={(e) => set('goals', e.target.value)} rows={3} placeholder="O que precisa ser feito, prioridades, marcos…" className={`${cls} resize-none`} /></div>
              <div>
                <label className={lbl}>Estilo / estética</label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => <button key={s} type="button" onClick={() => set('style', f.style === s ? '' : s)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${f.style === s ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ'}`}>{s}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Área (m²)</label><input type="number" value={f.area_m2} onChange={(e) => set('area_m2', e.target.value)} placeholder="Ex.: 80" className={cls} /></div>
                <div><label className={lbl}>Localização</label><input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Cidade / endereço" className={cls} /></div>
              </div>
              <div>
                <label className={lbl}>Prioridade</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => <button key={p.value} type="button" onClick={() => set('priority', p.value)} className={`flex-1 text-xs px-3 py-2 rounded-xl transition-colors ${f.priority === p.value ? p.s + ' ring-1 ring-current/30' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{p.label}</button>)}
                </div>
              </div>
              <div><label className={lbl}>Links de referência (Pinterest, drive, moodboard)</label><input value={f.references_url} onChange={(e) => set('references_url', e.target.value)} placeholder="Cole um link de inspiração" className={cls} /></div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Orçamento mín. (R$)</label><input type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="0" className={cls} /></div>
                <div><label className={lbl}>Orçamento máx. (R$)</label><input type="number" value={f.budget_max} onChange={(e) => set('budget_max', e.target.value)} placeholder="opcional" className={cls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Início previsto</label><GlassDate value={f.start_date} onChange={(v) => set('start_date', v)} placeholder="dd/mm/aaaa" /></div>
                <div><label className={lbl}>Entrega desejada</label><GlassDate value={f.deadline} onChange={(v) => set('deadline', v)} placeholder="dd/mm/aaaa" /></div>
              </div>
              <div>
                <label className={lbl}>Categorias de fornecedores necessárias</label>
                <p className="text-[11px] text-admin-muted/40 mb-2">Selecione as frentes — o projeto já nasce organizado por essas categorias.</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedCats.map((c) => { const on = f.categories.includes(c); return (
                    <button key={c} type="button" onClick={() => toggleCat(c)} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${on ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ'}`}>
                      <Icon name={on ? 'check' : (CATEGORY_ICON[c] || 'box')} className="w-3.5 h-3.5" />{SUPPLIER_CATEGORIES[c] || c}
                    </button>
                  )})}
                </div>
              </div>
              {/* resumo */}
              <div className="glass-soft rounded-xl p-4 mt-1">
                <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Resumo</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-admin-muted/55">
                  <span className="text-admin-text">{f.name || 'Projeto sem nome'}</span>
                  {f.segment && <span>· {SEGMENTS[f.segment]?.label}</span>}
                  {f.style && <span>· {f.style}</span>}
                  {(f.budget || f.budget_max) && <span>· {brlShort(f.budget)}{f.budget_max ? `–${brlShort(f.budget_max)}` : ''}</span>}
                  {f.categories.length > 0 && <span>· {f.categories.length} categoria(s)</span>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer nav */}
        <div className="p-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <button onClick={step === 1 ? onClose : () => setStep((s) => s - 1)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">{step === 1 ? 'Cancelar' : 'Voltar'}</button>
          {step < 3
            ? <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-40 flex items-center gap-2">Continuar<Icon name="down" className="w-4 h-4 -rotate-90" /></button>
            : <button onClick={submit} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ flex items-center gap-2"><Icon name="check" className="w-4 h-4" />Criar projeto</button>}
        </div>
      </div>
    </div>
  )
}

function ProjectDetail({ project, rows, suppliers, tenantId, onBack, onOpenSupplier, reload, notify, onDelete }) {
  const [addCat, setAddCat] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const seg = SEGMENTS[project.segment]
  const chosen = Array.isArray(project.categories) ? project.categories : []
  const suggestedCats = chosen.length ? chosen : (seg?.cats || [...new Set(suppliers.map((s) => s.category).filter(Boolean))].slice(0, 8))
  const prio = PRIORITIES.find((p) => p.value === project.priority)
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const byCat = useMemo(() => { const g = {}; rows.forEach((r) => { (g[r.category || 'outros'] ||= []).push(r) }); return g }, [rows])

  const addSupplier = async (supplierId, category) => {
    const { error } = await supabase.from('buyer_project_suppliers').insert({ tenant_id: tenantId, project_id: project.id, supplier_id: supplierId, category, status: 'considering' })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setAddCat(null); notify?.('Fornecedor adicionado ao projeto', 'success'); reload()
  }
  const removeRow = async (id) => { await supabase.from('buyer_project_suppliers').delete().eq('id', id); reload() }

  const share = async () => {
    let token = project.share_token
    if (!token || !project.is_public) {
      token = 'p' + Math.abs(project.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)).toString(36) + project.id.slice(0, 8)
      await supabase.from('buyer_projects').update({ share_token: token, is_public: true }).eq('id', project.id)
    }
    const url = `${window.location.origin}/projeto/${token}`
    try { await navigator.clipboard.writeText(url); notify?.('Link do projeto copiado!', 'success') } catch { notify?.('Link: ' + url, 'info') }
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar aos projetos</button>
      {project.cover_url && <div className="rounded-2xl overflow-hidden h-40 mb-4 relative"><img src={project.cover_url} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /></div>}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{project.name}</h1>{project.style && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{project.style}</span>}{prio && <span className={`text-[11px] px-2 py-0.5 rounded-lg ${prio.s}`}>{prio.label}</span>}</div>
          <p className="text-admin-muted/50 text-sm mt-1">{seg?.label || project.segment || 'Projeto'} · {rows.length} fornecedores vinculados</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={share} className="flex items-center gap-2 glass-input text-admin-muted/70 hover:text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="share" className="w-4 h-4" />Compartilhar link</button>
          <button onClick={() => setConfirmDel(true)} className="flex items-center gap-2 glass-input text-admin-muted/60 hover:text-admin-rose px-3 py-2 rounded-xl text-sm transition-colors" title="Excluir projeto"><Icon name="trash" className="w-4 h-4" /></button>
        </div>
      </div>
      {confirmDel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg text-admin-text mb-2">Excluir projeto?</h2>
            <p className="text-admin-muted/60 text-sm mb-5">O projeto <span className="text-admin-text">"{project.name}"</span> e todos os fornecedores vinculados serão removidos. Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setConfirmDel(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => { setConfirmDel(false); onDelete?.(project) }} className="px-4 py-2 rounded-xl text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose">Excluir projeto</button></div>
          </div>
        </div>
      )}
      {(project.description || project.goals || project.budget || project.deadline || project.location || project.area_m2) && (
        <div className="glass-soft rounded-2xl p-5 mb-5">
          {project.description && <p className="text-admin-muted/70 text-sm leading-relaxed">{project.description}</p>}
          {project.goals && <div className="mt-3"><p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1">Objetivos</p><p className="text-admin-muted/60 text-sm whitespace-pre-wrap">{project.goals}</p></div>}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[11px] text-admin-muted/50">
            {project.location && <span className="flex items-center gap-1"><Icon name="map" className="w-3.5 h-3.5" />{project.location}</span>}
            {project.area_m2 ? <span className="flex items-center gap-1"><Icon name="layout" className="w-3.5 h-3.5" />{project.area_m2} m²</span> : null}
            {(project.budget || project.budget_max) ? <span className="flex items-center gap-1"><Icon name="tag" className="w-3.5 h-3.5" />{brlShort(project.budget)}{project.budget_max ? `–${brlShort(project.budget_max)}` : ''}</span> : null}
            {project.start_date && <span className="flex items-center gap-1"><Icon name="calendar" className="w-3.5 h-3.5" />Início {new Date(project.start_date).toLocaleDateString('pt-BR')}</span>}
            {project.deadline && <span className="flex items-center gap-1"><Icon name="clock" className="w-3.5 h-3.5" />Entrega {new Date(project.deadline).toLocaleDateString('pt-BR')}</span>}
            {project.references_url && <a href={project.references_url.startsWith('http') ? project.references_url : `https://${project.references_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-admin-champ/70 hover:underline"><Icon name="link" className="w-3.5 h-3.5" />Referências</a>}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {suggestedCats.map((cat) => {
          const catRows = byCat[cat] || []
          return (
            <div key={cat} className="glass-soft rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm text-admin-text flex items-center gap-2"><Icon name={CATEGORY_ICON[cat] || 'box'} className="w-4 h-4 text-admin-champ/70" />{SUPPLIER_CATEGORIES[cat] || cat}</h3>
                <button onClick={() => setAddCat(cat)} className="text-[11px] text-admin-champ/80 hover:text-admin-champ flex items-center gap-1"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar</button>
              </div>
              {catRows.length === 0 ? <p className="text-admin-muted/35 text-xs">Nenhum fornecedor ainda nesta categoria.</p>
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catRows.map((r) => { const s = supplierById[r.supplier_id]; if (!s) return null; return (
                      <div key={r.id} className="glass rounded-xl p-3 flex items-center gap-3 group">
                        <button onClick={() => onOpenSupplier(s)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                          <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-4 h-4 text-admin-champ/60" />}</div>
                          <div className="min-w-0"><p className="text-admin-text text-sm truncate">{s.name}</p><p className="text-admin-muted/40 text-[11px] truncate">{s.city || ''}</p></div>
                        </button>
                        <button onClick={() => removeRow(r.id)} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3.5 h-3.5" /></button>
                      </div>
                    )})}
                  </div>}
            </div>
          )
        })}
      </div>

      {addCat && (
        <AddSupplierModal category={addCat} suppliers={suppliers.filter((s) => (!addCat || s.category === addCat) && !rows.some((r) => r.supplier_id === s.id))} onClose={() => setAddCat(null)} onAdd={(sid) => addSupplier(sid, addCat)} />
      )}
    </div>
  )
}

function AddSupplierModal({ category, suppliers, onClose, onAdd }) {
  const [pick, setPick] = useState('')
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Adicionar · {SUPPLIER_CATEGORIES[category] || category}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {suppliers.length === 0 ? <p className="text-admin-muted/50 text-sm">Nenhum fornecedor disponível nesta categoria.</p>
          : <>
              <GlassSelect value={pick} onChange={setPick} options={[{ value: '', label: 'Selecione um fornecedor' }, ...suppliers.map((s) => ({ value: s.id, label: `${s.name}${s.city ? ' · ' + s.city : ''}` }))]} />
              <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => pick && onAdd(pick)} disabled={!pick} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">Adicionar</button></div>
            </>}
      </div>
    </div>
  )
}
