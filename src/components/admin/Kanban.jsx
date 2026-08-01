import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const fmtKpi = (fmt, v) => (fmt === 'currency' ? brl(v) : fmt === 'int' ? Math.round(Number(v) || 0).toLocaleString('pt-BR') : v)

/**
 * KanbanBoard — quadro por etapa com arrastar e soltar (DnD nativo).
 * Config: table, stageField (coluna das colunas), stages [[key,label,border]],
 * primary (campo do título; pode ser 'ref'), fields (modal), chips, valueField, kpis.
 */
export function KanbanBoard({
  notify, module, table, title, subtitle, icon = 'layout',
  stageField, stages, stageLabel = 'Etapa', primary, fields = [], chips = [], valueField, kpis = [],
}) {
  const { profile, canManage, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = module && canEdit ? canEdit(module) : true
  const mayDelete = module && canManage ? canManage(module) : true
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refOpts, setRefOpts] = useState({})
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const primaryField = fields.find((f) => f.key === primary)
  const load = async () => { setLoading(true); const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false }); setRows(data || []); setLoading(false) }
  useEffect(() => {
    load()
    const refs = fields.filter((f) => f.type === 'ref' && f.refTable)
    if (refs.length) {
      Promise.all(refs.map(async (f) => {
        const { data } = await supabase.from(f.refTable).select(`id, ${f.refLabel || 'name'}`).order(f.refLabel || 'name')
        return [f.key, (data || []).map((d) => ({ value: d.id, label: d[f.refLabel || 'name'] }))]
      })).then((p) => setRefOpts(Object.fromEntries(p)))
    }
  }, [table])

  const optLabel = (f, v) => {
    if (v == null || v === '') return ''
    if (f.type === 'ref') return (refOpts[f.key] || []).find((o) => String(o.value) === String(v))?.label || v
    if (f.options) return f.options[v] || v
    return v
  }
  const titleOf = (r) => (primaryField ? optLabel(primaryField, r[primary]) : r[primary]) || '—'

  const coerce = (f, v) => {
    if (v === '' || v == null) return (f.type === 'currency' || f.type === 'number' || f.type === 'int') ? null : null
    if (f.type === 'currency' || f.type === 'number') return Number(v) || 0
    if (f.type === 'int') return parseInt(v) || null
    return v
  }
  const openNew = (stage) => { const init = {}; fields.forEach((f) => { init[f.key] = f.default ?? '' }); setEditing(null); setForm({ ...init, [stageField]: stage || stages[0][0] }); setModal(true) }
  const openEdit = (r) => { const f = {}; fields.forEach((fl) => { f[fl.key] = r[fl.key] ?? '' }); setEditing(r); setForm({ ...f, [stageField]: r[stageField] || stages[0][0] }); setModal(true) }

  const save = async () => {
    if (primaryField?.required && !String(form[primary] || '').trim()) return notify(`${primaryField.label} é obrigatório`, 'error')
    const payload = { [stageField]: form[stageField] }
    fields.forEach((f) => { payload[f.key] = coerce(f, form[f.key]) })
    let error, id
    if (editing) { const r = await supabase.from(table).update(payload).eq('id', editing.id); error = r.error; id = editing.id }
    else { const r = await supabase.from(table).insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: table, resource_id: id, new_data: payload }, tenantId)
    setModal(false); setEditing(null); load()
  }
  const remove = async (r) => {
    if (!confirm('Remover este item?')) return
    const { error } = await supabase.from(table).delete().eq('id', r.id)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: table, resource_id: r.id, old_data: r }, tenantId)
    notify('Removido', 'success'); load()
  }
  const moveTo = async (stage) => {
    const id = dragId; setDragId(null); setOver(null)
    if (!id) return
    const r = rows.find((x) => x.id === id)
    if (!r || r[stageField] === stage) return
    setRows((ls) => ls.map((x) => x.id === id ? { ...x, [stageField]: stage } : x))
    const { error } = await supabase.from(table).update({ [stageField]: stage }).eq('id', id)
    if (error) { notify('Erro ao mover', 'error'); load(); return }
    logAudit({ action: 'update', resource_type: table, resource_id: id, new_data: { [stageField]: stage } }, tenantId)
  }

  const renderField = (f) => {
    const v = form[f.key] ?? ''
    if (f.type === 'textarea') return <textarea value={v} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
    if (f.type === 'currency' || f.type === 'number' || f.type === 'int') return <input type="number" value={v} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className={inputCls} />
    if (f.type === 'date') return <GlassDate value={v} onChange={(val) => setForm((s) => ({ ...s, [f.key]: val }))} />
    if (f.type === 'select') return <GlassSelect value={v} onChange={(val) => setForm((s) => ({ ...s, [f.key]: val }))} options={[{ value: '', label: '—' }, ...Object.entries(f.options).map(([value, label]) => ({ value, label }))]} />
    if (f.type === 'ref') return <GlassSelect value={v} onChange={(val) => setForm((s) => ({ ...s, [f.key]: val }))} options={[{ value: '', label: f.placeholder || '—' }, ...(refOpts[f.key] || [])]} />
    return <input value={v} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className={inputCls} placeholder={f.placeholder} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>{title && <h1 className="font-serif text-4xl text-admin-text">{title}</h1>}<p className="text-admin-muted/60 text-sm mt-1">{subtitle} — arraste os cards entre as etapas</p></div>
        {mayEdit && <button onClick={() => openNew()} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo</button>}
      </div>

      {kpis.length > 0 && (
        <div className={`grid gap-3 mb-6 grid-cols-2 lg:grid-cols-${Math.min(kpis.length, 4)}`}>
          {kpis.map((k, i) => <div key={i} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{k.label}</p><p className="text-admin-champ text-2xl font-medium">{fmtKpi(k.fmt, k.calc(rows))}</p></div>)}
        </div>
      )}

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <div className="flex flex-wrap gap-3 pb-3">
          {stages.map(([sk, sl, border]) => {
            const col = rows.filter((r) => (r[stageField] || stages[0][0]) === sk)
            const colVal = valueField ? col.reduce((s, r) => s + Number(r[valueField] || 0), 0) : null
            return (
              <div key={sk}
                onDragOver={(e) => { e.preventDefault(); setOver(sk) }}
                onDragLeave={() => setOver((o) => (o === sk ? null : o))}
                onDrop={() => moveTo(sk)}
                className={`flex-1 min-w-[220px] glass rounded-2xl p-3 border ${over === sk ? 'border-admin-champ/60 bg-admin-champ/[0.04]' : (border || 'border-white/[0.06]')} transition-colors`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div><p className="text-sm text-admin-text font-medium">{sl}</p><p className="text-admin-muted/40 text-[10px]">{col.length}{colVal != null ? ` · ${brl(colVal)}` : ''}</p></div>
                  {mayEdit && <button onClick={() => openNew(sk)} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="plus" className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {col.map((r) => (
                    <div key={r.id} draggable={mayEdit}
                      onDragStart={() => setDragId(r.id)} onDragEnd={() => { setDragId(null); setOver(null) }}
                      className={`glass-soft rounded-xl px-3 py-2.5 group ${mayEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === r.id ? 'opacity-40' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-admin-text text-sm leading-tight">{titleOf(r)}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {mayEdit && <button onClick={() => openEdit(r)} className="p-1 text-admin-muted hover:text-admin-champ rounded"><Icon name="pen" className="w-3 h-3" /></button>}
                          {mayDelete && <button onClick={() => remove(r)} className="p-1 text-admin-muted hover:text-admin-rose rounded"><Icon name="x" className="w-3 h-3" /></button>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {chips.map((ck) => { const f = fields.find((x) => x.key === ck); const val = f ? optLabel(f, r[ck]) : r[ck]; return val ? <span key={ck} className="text-[10px] text-admin-muted/50">{val}</span> : null })}
                      </div>
                      {valueField && r[valueField] > 0 && <p className="text-admin-gold/80 text-xs mt-1">{brl(r[valueField])}</p>}
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
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar' : 'Novo'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {primaryField && <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{primaryField.label}{primaryField.required ? ' *' : ''}</label>{renderField(primaryField)}</div>}
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{stageLabel}</label><GlassSelect value={form[stageField]} onChange={(v) => setForm((s) => ({ ...s, [stageField]: v }))} options={stages.map(([value, label]) => ({ value, label }))} /></div>
              {fields.filter((f) => f.key !== primary).map((f) => (
                <div key={f.key} className={f.full || f.type === 'textarea' ? 'col-span-2' : ''}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{f.label}</label>{renderField(f)}</div>
              ))}
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Adicionar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
