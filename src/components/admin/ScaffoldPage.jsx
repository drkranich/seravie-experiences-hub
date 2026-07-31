import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

// Toda subpágina do Experience OS vira um quadro de registros real
// (adicionar, anotar, concluir, excluir) — persistido por tenant e por página.
export function ScaffoldPage({ item, parentLabel, onNavigate }) {
  const pages = item.pages || []
  if (pages.length > 0) return <ModuleGrid item={item} parentLabel={parentLabel} onNavigate={onNavigate} />
  return <RecordsBoard item={item} parentLabel={parentLabel} />
}

function Breadcrumb({ parentLabel, label }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-admin-muted/50 mb-3">
      {parentLabel && (<><span>{parentLabel}</span><span className="opacity-30">/</span></>)}
      <span className="text-admin-champ/70">{label}</span>
    </div>
  )
}

// Módulo com subpáginas → cards de navegação
function ModuleGrid({ item, parentLabel, onNavigate }) {
  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" /></div>
        <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{item.pages.length} áreas neste módulo</p></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {item.pages.map((p) => (
          <button key={p.key} onClick={() => onNavigate?.(p.key)} className="glass rounded-2xl p-5 text-left border border-transparent hover:border-admin-champ/25 lift transition-all">
            <div className="flex items-center justify-between mb-2"><p className="text-admin-text text-sm font-medium">{p.label}</p><Icon name="external" className="w-3.5 h-3.5 text-admin-champ/40" /></div>
            <p className="text-admin-muted/40 text-xs">Abrir {p.label.toLowerCase()}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// Subpágina folha → quadro de registros funcional
function RecordsBoard({ item, parentLabel }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', notes: '' })
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('module_records').select('*').eq('page_key', item.key).order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [item.key])

  const save = async () => {
    if (!form.title.trim()) return
    if (editing) await supabase.from('module_records').update({ title: form.title, notes: form.notes, updated_at: new Date().toISOString() }).eq('id', editing)
    else await supabase.from('module_records').insert({ tenant_id: tenantId, page_key: item.key, title: form.title, notes: form.notes, created_by: profile?.user_id })
    setModal(false); setForm({ title: '', notes: '' }); setEditing(null); load()
  }
  const toggle = async (r) => { await supabase.from('module_records').update({ status: r.status === 'done' ? 'open' : 'done', updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('module_records').delete().eq('id', id); load() }
  const openNew = () => { setEditing(null); setForm({ title: '', notes: '' }); setModal(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ title: r.title, notes: r.notes || '' }); setModal(true) }

  const shown = records.filter((r) => filter === 'all' || (filter === 'open' ? r.status !== 'done' : r.status === 'done'))
  const openCount = records.filter((r) => r.status !== 'done').length

  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" /></div>
          <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{records.length} registro(s) · {openCount} em aberto</p></div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Novo registro</button>
      </div>

      <div className="flex gap-2 mb-5">
        {[['all', 'Todos'], ['open', 'Em aberto'], ['done', 'Concluídos']].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : shown.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center max-w-2xl">
          <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center mx-auto mb-4"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/70" /></div>
          <p className="text-admin-text text-sm font-medium mb-1">Comece a usar {item.label}</p>
          <p className="text-admin-muted/50 text-sm max-w-md mx-auto mb-5">Registre e acompanhe tudo desta área — anotações, itens e pendências ficam salvos e organizados aqui, no padrão da plataforma.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Criar primeiro registro</button>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <div key={r.id} className="glass rounded-xl px-4 py-3 flex items-start gap-3 group">
              <button onClick={() => toggle(r)} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${r.status === 'done' ? 'bg-admin-sage/80 border-admin-sage' : 'border-white/20 hover:border-admin-champ/40'}`}>{r.status === 'done' && <Icon name="check" className="w-3.5 h-3.5 text-admin-bg" />}</button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${r.status === 'done' ? 'text-admin-muted/40 line-through' : 'text-admin-text'}`}>{r.title}</p>
                {r.notes && <p className="text-admin-muted/50 text-xs mt-0.5">{r.notes}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(r)} className="p-1.5 text-admin-muted hover:text-admin-champ rounded-lg hover:bg-white/[0.05] transition-colors"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(r.id)} className="p-1.5 text-admin-muted hover:text-admin-rose rounded-lg hover:bg-white/[0.05] transition-colors"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar registro' : `Novo em ${item.label}`}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && save()} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Anotações</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Adicionar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
