import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
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
  }

  if (open) {
    const fresh = projects.find((p) => p.id === open.id) || open
    return <ProjectDetail project={fresh} rows={links[open.id] || []} suppliers={suppliers} tenantId={tenantId} onBack={() => { setOpen(null); load() }} onOpenSupplier={onOpenSupplier} reload={load} notify={notify} />
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

      {creating && <CreateProject onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  )
}

function CreateProject({ onClose, onCreate }) {
  const [f, setF] = useState({ name: '', segment: '' })
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Novo projeto</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do projeto" className={cls} />
          <GlassSelect value={f.segment} onChange={(v) => setF((s) => ({ ...s, segment: v }))} options={[{ value: '', label: 'Segmento (opcional)' }, ...Object.entries(SEGMENTS).map(([k, v]) => ({ value: k, label: v.label }))]} />
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.name.trim() && onCreate({ name: f.name, segment: f.segment || null, status: 'active' })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar</button></div>
      </div>
    </div>
  )
}

function ProjectDetail({ project, rows, suppliers, tenantId, onBack, onOpenSupplier, reload, notify }) {
  const [addCat, setAddCat] = useState(null)
  const seg = SEGMENTS[project.segment]
  const suggestedCats = seg?.cats || [...new Set(suppliers.map((s) => s.category).filter(Boolean))].slice(0, 8)
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const byCat = useMemo(() => { const g = {}; rows.forEach((r) => { (g[r.category || 'outros'] ||= []).push(r) }); return g }, [rows])

  const addSupplier = async (supplierId, category) => {
    const { error } = await supabase.from('buyer_project_suppliers').insert({ tenant_id: tenantId, project_id: project.id, supplier_id: supplierId, category, status: 'considering' })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setAddCat(null); notify?.('Fornecedor adicionado ao projeto', 'success'); reload()
  }
  const removeRow = async (id) => { await supabase.from('buyer_project_suppliers').delete().eq('id', id); reload() }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar aos projetos</button>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">{project.name}</h1><p className="text-admin-muted/50 text-sm mt-1">{seg?.label || project.segment || 'Projeto'} · {rows.length} fornecedores vinculados</p></div>
      </div>

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
