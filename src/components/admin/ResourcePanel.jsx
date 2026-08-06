import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'
import { parseCsv, autoMap, downloadCsvTemplate } from '../../lib/csv'
import { logAudit } from '../../lib/audit'
import { FlowImageField } from './FlowImageField'

/**
 * ResourcePanel — painel CRUD completo e config-driven do design system Seravie.
 *
 * Um único componente entrega, para qualquer tabela: KPIs no topo, busca,
 * filtros, criar/editar/duplicar/excluir, tela de detalhe e exportação CSV+PDF.
 * Cada módulo do sistema vira apenas um "config" — mantendo tudo consistente.
 *
 * Tipos de campo suportados: text, textarea, number, currency, int, year,
 * select, bool, status, date.
 */

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtVal = (fmt, v) => (fmt === 'currency' ? brl(v) : fmt === 'int' ? Math.round(Number(v) || 0).toLocaleString('pt-BR') : v)

const STATUS_STYLE = {
  active: 'bg-admin-sage/10 text-admin-sage', ativo: 'bg-admin-sage/10 text-admin-sage',
  draft: 'bg-admin-gold/10 text-admin-gold', rascunho: 'bg-admin-gold/10 text-admin-gold',
  archived: 'bg-white/[0.04] text-admin-muted/50', arquivado: 'bg-white/[0.04] text-admin-muted/50',
  paused: 'bg-admin-gold/10 text-admin-gold', inactive: 'bg-white/[0.04] text-admin-muted/50',
  planning: 'bg-admin-gold/10 text-admin-gold', in_progress: 'bg-admin-champ/10 text-admin-champ',
  done: 'bg-admin-sage/10 text-admin-sage', completed: 'bg-admin-sage/10 text-admin-sage',
  cancelled: 'bg-admin-rose/10 text-admin-rose', confirmed: 'bg-admin-champ/10 text-admin-champ',
}
export function StatusPill({ value, label }) {
  if (!value) return null
  return <span className={`text-[9px] px-2 py-0.5 rounded-lg shrink-0 ${STATUS_STYLE[value] || 'bg-white/[0.04] text-admin-muted/50'}`}>{label || value}</span>
}

function ConfirmDialog({ title, message, confirmLabel = 'Excluir', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-serif text-xl text-admin-text mb-2">{title}</h3>
        <p className="text-admin-muted/70 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">{confirmLabel}</button>
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const optsOf = (o) => (o ? Object.entries(o).map(([value, label]) => ({ value, label })) : [])
const labelOf = (field, v) => (field.options ? field.options[v] || v : v)

function FieldInput({ field, value, onChange, dynOptions }) {
  const v = value ?? ''
  switch (field.type) {
    case 'textarea':
      return <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={field.rows || 2} className={`${inputCls} resize-none`} placeholder={field.placeholder} />
    case 'number': case 'currency': case 'int': case 'year':
      return <input type="number" value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={field.placeholder} />
    case 'ref':
      return <GlassSelect value={v} onChange={onChange} options={[{ value: '', label: field.placeholder || '— nenhum —' }, ...(dynOptions || [])]} placeholder={field.placeholder || 'Selecione'} />
    case 'select': case 'status':
      return <GlassSelect value={v} onChange={onChange} options={optsOf(field.options)} placeholder={field.placeholder || 'Selecione'} />
    case 'bool':
      return (
        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-admin-muted">{field.checkboxLabel || field.label}</span>
        </label>
      )
    case 'date':
      return <GlassDate value={v} onChange={onChange} />
    case 'image':
      return <FlowImageField label="" value={v} onChange={onChange} folder={field.folder || 'admin'} />
    default:
      return <input value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={field.placeholder} />
  }
}

/** Wrapper de página com título + abas, cada aba renderizando um ResourcePanel embedded. */
export function ResourceTabs({ title, subtitle, tabs }) {
  const [tab, setTab] = useState(tabs[0].key)
  const active = tabs.find((t) => t.key === tab) || tabs[0]
  return (
    <div>
      <div className="mb-4"><h1 className="font-serif text-4xl text-admin-text">{title}</h1>{subtitle && <p className="text-admin-muted/60 text-sm mt-1">{subtitle}</p>}</div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{t.label}</button>
        ))}
      </div>
      {active.render()}
    </div>
  )
}

export function ResourcePanel({
  notify, table, title, subtitle, icon = 'box', fields = [], kpis = [],
  orderBy = { column: 'created_at', ascending: false }, select = '*',
  noTenant = false, exportName, embedded = false, inject = {}, baseFilter, newLabel = 'Novo', module,
}) {
  const { profile, canEdit, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const allowEdit = module && canEdit ? canEdit(module) : true      // criar/editar/duplicar
  const allowDelete = module && canManage ? canManage(module) : true // excluir (só quem gerencia)
  const readOnly = !allowEdit && !allowDelete
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [detail, setDetail] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [dynOpts, setDynOpts] = useState({})
  // Importação de planilha (CSV) com mapeamento de colunas
  const [imp, setImp] = useState(null) // { headers, rows, map }
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const refFields = fields.filter((f) => f.type === 'ref' && f.refTable)
  useEffect(() => {
    if (!refFields.length) return
    let alive = true
    Promise.all(refFields.map(async (f) => {
      const { data } = await supabase.from(f.refTable).select(`id, ${f.refLabel || 'name'}`).order(f.refLabel || 'name')
      return [f.key, (data || []).map((d) => ({ value: d.id, label: d[f.refLabel || 'name'] }))]
    })).then((pairs) => { if (alive) setDynOpts(Object.fromEntries(pairs)) })
    return () => { alive = false }
  }, [table])
  const dynLabel = (field, val) => (dynOpts[field.key] || []).find((o) => String(o.value) === String(val))?.label || val

  const primary = fields.find((f) => f.primary) || fields[0]
  const currencyField = fields.find((f) => f.type === 'currency')
  const descField = fields.find((f) => f.type === 'textarea')
  const chipFields = fields.filter((f) => f.chip)
  const statusField = fields.find((f) => f.type === 'status' || f.badge)
  const filterFields = fields.filter((f) => f.filter && (f.options || f.type === 'status'))
  const searchKeys = fields.filter((f) => f.search || f.primary || (!f.type || f.type === 'text')).map((f) => f.key)

  const load = async () => {
    setLoading(true)
    let q = supabase.from(table).select(select)
    if (baseFilter) {
      if (baseFilter.op === 'contains') q = q.contains(baseFilter.column, baseFilter.value)
      else if (baseFilter.op === 'neq') q = q.neq(baseFilter.column, baseFilter.value)
      else q = q.eq(baseFilter.column, baseFilter.value)
    }
    const { data } = await q.order(orderBy.column, { ascending: orderBy.ascending })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [table, JSON.stringify(baseFilter)])

  const openNew = () => {
    const init = {}
    fields.forEach((f) => { if (f.default !== undefined) init[f.key] = f.default })
    setEditing(null); setForm(init); setModal(true)
  }
  const openEdit = (r) => {
    const f = {}
    fields.forEach((fl) => { f[fl.key] = r[fl.key] })
    setEditing(r); setForm(f); setModal(true); setDetail(null)
  }

  const coerce = (f, val) => {
    if (val === '' || val === undefined) return f.type === 'currency' || f.type === 'number' || f.type === 'int' || f.type === 'year' ? (f.required ? 0 : null) : (f.type === 'bool' ? false : null)
    if (f.type === 'currency' || f.type === 'number') return Number(val) || 0
    if (f.type === 'int' || f.type === 'year') return parseInt(val) || null
    if (f.type === 'bool') return !!val
    return val
  }

  const save = async () => {
    if (primary && !String(form[primary.key] || '').trim()) return notify(`${primary.label} é obrigatório`, 'error')
    const payload = {}
    fields.forEach((f) => { payload[f.key] = coerce(f, form[f.key]) })
    if (!noTenant) payload.tenant_id = tenantId
    let error, savedId
    if (editing) {
      const res = await supabase.from(table).update(payload).eq('id', editing.id)
      error = res.error; savedId = editing.id
    } else {
      const res = await supabase.from(table).insert({ ...inject, ...payload }).select('id').single()
      error = res.error; savedId = res.data?.id
    }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: table, resource_id: savedId, old_data: editing || null, new_data: payload }, tenantId)
    notify(editing ? 'Registro atualizado' : 'Registro criado', 'success')
    setModal(false); setEditing(null); setForm({}); load()
  }

  const duplicate = async (r) => {
    const payload = {}
    fields.forEach((f) => { payload[f.key] = r[f.key] })
    if (primary) payload[primary.key] = `${r[primary.key]} (cópia)`
    if (!noTenant) payload.tenant_id = tenantId
    const { data, error } = await supabase.from(table).insert({ ...inject, ...payload }).select('id').single()
    if (error) return notify('Erro ao duplicar', 'error')
    logAudit({ action: 'create', resource_type: table, resource_id: data?.id, new_data: payload }, tenantId)
    notify('Registro duplicado', 'success'); setDetail(null); load()
  }

  const remove = async (r) => {
    const { error } = await supabase.from(table).delete().eq('id', r.id)
    setConfirm(null); setDetail(null)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: table, resource_id: r.id, old_data: r }, tenantId)
    notify('Registro excluído', 'success'); load()
  }

  // --- Importação de planilha (CSV genérico com mapeamento de colunas) ---
  // Campos que podem ser importados (exclui imagens, que dependem de upload).
  const importFields = fields.filter((f) => f.type !== 'image')

  const downloadModel = () => {
    const cols = importFields.map((f) => f.label)
    const example = {}
    importFields.forEach((f) => {
      example[f.label] = f.type === 'currency' || f.type === 'number' ? '0'
        : f.type === 'int' || f.type === 'year' ? '0'
        : f.type === 'bool' ? 'sim'
        : f.type === 'date' ? '2024-01-31'
        : f.options ? Object.keys(f.options)[0] || ''
        : `Ex: ${f.label}`
    })
    downloadCsvTemplate(`modelo-${exportName || table}.csv`, cols, example)
    notify('Modelo baixado — preencha e importe', 'success')
  }

  const onPickFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    if (!headers.length || !rows.length) { notify('Planilha vazia ou inválida', 'error'); return }
    setImp({ headers, rows, map: autoMap(headers, importFields) })
  }

  // Converte um valor de célula (texto) para o tipo do campo.
  const coerceImport = (f, raw) => {
    const val = String(raw ?? '').trim()
    if (val === '') return f.type === 'bool' ? false : null
    if (f.type === 'currency' || f.type === 'number') return Number(val.replace(/\./g, '').replace(',', '.')) || Number(val) || 0
    if (f.type === 'int' || f.type === 'year') return parseInt(val, 10) || null
    if (f.type === 'bool') return /^(sim|true|1|x|yes|y|s)$/i.test(val)
    if (f.options) {
      // aceita a chave OU o rótulo (case-insensitive)
      if (f.options[val] !== undefined) return val
      const hit = Object.entries(f.options).find(([, label]) => String(label).toLowerCase() === val.toLowerCase())
      return hit ? hit[0] : val
    }
    return val
  }

  const runImport = async () => {
    if (!imp) return
    const mapped = importFields.filter((f) => imp.map[f.key])
    if (!mapped.length) { notify('Mapeie ao menos uma coluna', 'error'); return }
    const payloads = imp.rows.map((row) => {
      const o = {}
      mapped.forEach((f) => { o[f.key] = coerceImport(f, row[imp.map[f.key]]) })
      return o
    }).filter((o) => (primary ? String(o[primary.key] ?? '').trim() !== '' : true))
    if (!payloads.length) { notify(`Nenhuma linha com "${primary?.label || 'valor'}" preenchido`, 'error'); return }
    setImporting(true)
    const toInsert = payloads.map((o) => ({ ...inject, ...o, ...(noTenant ? {} : { tenant_id: tenantId }) }))
    const { error } = await supabase.from(table).insert(toInsert)
    setImporting(false)
    if (error) { notify('Erro ao importar: ' + error.message, 'error'); return }
    logAudit({ action: 'create', resource_type: table, resource_id: null, new_data: { imported: toInsert.length } }, tenantId)
    notify(`${toInsert.length} registro(s) importado(s)`, 'success')
    setImp(null); load()
  }

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
    }
    Object.entries(filters).forEach(([k, val]) => { if (val) out = out.filter((r) => String(r[k]) === String(val)) })
    return out
  }, [rows, search, filters])

  const exportRows = () => filtered.map((r) => {
    const o = {}
    fields.filter((f) => f.type !== 'textarea').forEach((f) => {
      let v = r[f.key]
      if (f.type === 'currency') v = brl(v)
      else if (f.type === 'bool') v = v ? 'Sim' : 'Não'
      else if (f.type === 'ref') v = dynLabel(f, v)
      else if (f.options) v = labelOf(f, v)
      o[f.label] = v ?? ''
    })
    return o
  })

  const kpiValues = kpis.map((k) => ({ label: k.label, value: fmtVal(k.fmt, k.calc(rows)) }))

  return (
    <div>
      <div className={`flex items-center justify-between gap-4 flex-wrap ${embedded ? 'mb-4' : 'mb-6'}`}>
        {embedded
          ? <p className="text-admin-muted/50 text-sm">{rows.length} {subtitle || 'registros'}</p>
          : <div><h1 className="font-serif text-4xl text-admin-text">{title}</h1><p className="text-admin-muted/60 text-sm mt-1">{rows.length} {subtitle || 'registros'}</p></div>}
        <div className="flex gap-2 ml-auto">
          <button onClick={() => exportCsv(`${exportName || table}.csv`, exportRows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(title, exportRows(), subtitle) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
          {allowEdit && (
            <>
              <button onClick={downloadModel} title="Baixar planilha-modelo (.csv)" className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="download" className="w-4 h-4" />Modelo</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onPickFile(e.target.files[0]); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} title="Importar registros de uma planilha CSV" className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />Importar</button>
            </>
          )}
          {allowEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />{newLabel}</button>}
        </div>
      </div>

      {kpiValues.length > 0 && (
        <div className={`grid gap-3 mb-6 sm:grid-cols-2 lg:grid-cols-${Math.min(kpiValues.length, 4)}`}>
          {kpiValues.map((k, i) => (
            <div key={i} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{k.label}</p><p className="text-admin-champ text-2xl font-medium">{k.value}</p></div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
        </div>
        {filterFields.map((f) => (
          <div key={f.key} className="min-w-40">
            <GlassSelect value={filters[f.key] || ''} onChange={(v) => setFilters((s) => ({ ...s, [f.key]: v }))}
              options={[{ value: '', label: `Todos · ${f.label}` }, ...optsOf(f.options)]} />
          </div>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name={icon} className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{rows.length === 0 ? 'Nenhum registro ainda' : 'Nada encontrado com esses filtros'}</p>{rows.length === 0 && <button onClick={openNew} className="mt-4 text-admin-champ text-sm hover:underline">Criar o primeiro</button>}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 group relative hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <button onClick={() => setDetail(r)} className="text-left min-w-0 flex-1"><p className="text-admin-text text-sm font-medium truncate hover:text-admin-champ transition-colors">{r[primary.key]}</p></button>
                  {currencyField && <p className="text-admin-gold text-sm shrink-0">{brl(r[currencyField.key])}</p>}
                </div>
                <div className="flex gap-2 flex-wrap items-center mb-1">
                  {chipFields.map((f) => r[f.key] != null && r[f.key] !== '' && (
                    <span key={f.key} className="text-admin-muted/50 text-xs">{f.type === 'bool' ? (r[f.key] ? f.label : null) : f.type === 'ref' ? dynLabel(f, r[f.key]) : labelOf(f, r[f.key])}</span>
                  ))}
                  {statusField && <StatusPill value={r[statusField.key]} label={statusField.options ? labelOf(statusField, r[statusField.key]) : undefined} />}
                </div>
                {descField && r[descField.key] && <p className="text-admin-muted/40 text-xs line-clamp-2 mt-1">{r[descField.key]}</p>}
                {!readOnly && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
                    {allowEdit && <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>}
                    {allowEdit && <button onClick={() => duplicate(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Duplicar"><Icon name="copy" className="w-3.5 h-3.5" /></button>}
                    {allowDelete && <button onClick={() => setConfirm(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05] transition-colors ml-auto" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Modal criar/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? `Editar ${title.toLowerCase()}` : `Novo · ${title}`}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {fields.map((f) => (
                <div key={f.key} className={f.full || f.type === 'textarea' || f.type === 'bool' ? 'col-span-2' : ''}>
                  {f.type !== 'bool' && <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{f.label}{f.required ? ' *' : ''}</label>}
                  <FieldInput field={f} value={form[f.key]} dynOptions={dynOpts[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar alterações' : 'Criar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {/* Detalhe */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name={icon} className="w-5 h-5 text-admin-champ" /></div>
                <div className="min-w-0"><h2 className="font-serif text-2xl text-admin-text leading-tight truncate">{detail[primary.key]}</h2>{statusField && <div className="mt-1"><StatusPill value={detail[statusField.key]} label={statusField.options ? labelOf(statusField, detail[statusField.key]) : undefined} /></div>}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-admin-muted hover:text-admin-text shrink-0"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {fields.filter((f) => !f.primary && f.type !== 'textarea' && detail[f.key] != null && detail[f.key] !== '').map((f) => (
                <div key={f.key} className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">{f.label}</p><p className="text-admin-text text-sm mt-0.5">{f.type === 'currency' ? brl(detail[f.key]) : f.type === 'bool' ? (detail[f.key] ? 'Sim' : 'Não') : f.type === 'ref' ? dynLabel(f, detail[f.key]) : labelOf(f, detail[f.key])}</p></div>
              ))}
            </div>
            {descField && detail[descField.key] && <div className="mb-5"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-1">{descField.label}</p><p className="text-admin-muted/70 text-sm whitespace-pre-wrap">{detail[descField.key]}</p></div>}
            {readOnly ? <p className="text-admin-muted/40 text-xs text-center">Você tem acesso somente de leitura neste módulo.</p> : (
              <div className="flex gap-2">
                {allowEdit && <button onClick={() => openEdit(detail)} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Editar</button>}
                {allowEdit && <button onClick={() => duplicate(detail)} className="px-4 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-champ border border-white/[0.06] transition-colors">Duplicar</button>}
                {allowDelete && <button onClick={() => setConfirm(detail)} className="px-4 py-2.5 rounded-xl text-sm text-admin-rose hover:bg-admin-rose/10 transition-colors">Excluir</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de importação: mapeamento de colunas + prévia */}
      {imp && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !importing && setImp(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2"><h2 className="font-serif text-2xl text-admin-text">Importar planilha</h2><button onClick={() => !importing && setImp(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <p className="text-admin-muted/60 text-sm mb-5">{imp.rows.length} linha(s) lida(s). Confirme para quais campos vão as colunas da sua planilha:</p>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3 mb-6">
              {importFields.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="text-sm text-admin-text w-32 shrink-0 truncate" title={f.label}>{f.label}{f.primary || f.required ? <span className="text-admin-rose"> *</span> : ''}</label>
                  <div className="flex-1 min-w-0">
                    <GlassSelect
                      value={imp.map[f.key] || ''}
                      onChange={(v) => setImp((s) => ({ ...s, map: { ...s.map, [f.key]: v } }))}
                      options={[{ value: '', label: '— não importar —' }, ...imp.headers.map((h) => ({ value: h, label: h }))]}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Prévia das primeiras linhas com os campos já mapeados */}
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Prévia</p>
            <div className="glass rounded-xl overflow-hidden overflow-x-auto mb-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-admin-muted/50 uppercase tracking-wider border-b border-white/[0.06]">
                    {importFields.filter((f) => imp.map[f.key]).map((f) => <th key={f.key} className="text-left px-3 py-2 whitespace-nowrap">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {imp.rows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03]">
                      {importFields.filter((f) => imp.map[f.key]).map((f) => {
                        const v = coerceImport(f, row[imp.map[f.key]])
                        const show = f.type === 'currency' ? brl(v) : f.type === 'bool' ? (v ? 'Sim' : 'Não') : f.options ? labelOf(f, v) : v
                        return <td key={f.key} className="px-3 py-2 text-admin-muted/80 whitespace-nowrap">{show == null || show === '' ? '—' : String(show)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {imp.rows.length > 8 && <p className="text-admin-muted/40 text-xs mb-4">…e mais {imp.rows.length - 8} linha(s).</p>}

            <div className="flex gap-3">
              <button onClick={runImport} disabled={importing} className="flex-1 bg-admin-sage/15 hover:bg-admin-sage/25 text-admin-sage py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">{importing ? 'Importando…' : `Importar ${imp.rows.length} registro(s)`}</button>
              <button onClick={() => setImp(null)} disabled={importing} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted disabled:opacity-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog title="Excluir registro" message={`Remover "${confirm[primary.key]}"? Esta ação não pode ser desfeita.`} onConfirm={() => remove(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  )
}
