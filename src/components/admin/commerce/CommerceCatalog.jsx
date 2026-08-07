import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { ITEM_TYPES, typeMeta, WORKFLOW, workflowMeta, fieldsForType, RECURRENCE, brl } from '../../../lib/commerceTypes'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const accentText = { champ: 'text-admin-champ', sage: 'text-admin-sage', gold: 'text-admin-gold', copper: 'text-admin-copper', rose: 'text-admin-rose', muted: 'text-admin-muted/60' }

// Catálogo multi-tipo do Commerce Hub — vende produto, serviço, experiência,
// reserva, assinatura, kit, digital, gift card, curso, evento. O editor muda
// os campos conforme o tipo do item.
export function CommerceCatalog({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [collections, setCollections] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: l }, { data: c }, { data: b }] = await Promise.all([
      supabase.from('store_listings').select('*').order('created_at', { ascending: false }),
      supabase.from('commerce_collections').select('id,name').eq('active', true).order('name'),
      supabase.from('commerce_brands').select('id,name').eq('active', true).order('name'),
    ])
    setRows(l || []); setCollections(c || []); setBrands(b || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const m = {}
    rows.forEach((r) => { m[r.item_type || 'product'] = (m[r.item_type || 'product'] || 0) + 1 })
    return m
  }, [rows])

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeFilter && (r.item_type || 'product') !== typeFilter) return false
    if (statusFilter && (r.status || 'draft') !== statusFilter) return false
    if (search.trim() && !`${r.title} ${r.category} ${r.sku || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [rows, typeFilter, statusFilter, search])

  const openNew = (type = 'product') => setModal({ item_type: type, title: '', subtitle: '', price: '', cost: '', category: '', status: 'draft', is_published: false, stock: '', capacity: '', duration_minutes: '', recurrence: 'monthly', start_at: '', location: '', digital_url: '', collection_id: '', brand_id: '' })
  const openEdit = (r) => setModal({ ...r, start_at: r.start_at ? r.start_at.slice(0, 10) : '' })
  const save = async () => {
    if (!modal.title?.trim()) return notify?.('Informe o título', 'error')
    const p = {
      tenant_id: tenantId, item_type: modal.item_type, title: modal.title.trim(), subtitle: modal.subtitle || null,
      price: Number(modal.price) || 0, cost: modal.cost === '' ? null : Number(modal.cost), category: modal.category || null,
      status: modal.status, is_published: modal.status === 'published',
      stock: modal.stock === '' ? null : Number(modal.stock), capacity: modal.capacity === '' ? null : Number(modal.capacity),
      duration_minutes: modal.duration_minutes === '' ? null : Number(modal.duration_minutes),
      recurrence: modal.item_type === 'subscription' ? modal.recurrence : null,
      start_at: modal.start_at ? new Date(modal.start_at + 'T12:00:00').toISOString() : null,
      location: modal.location || null, digital_url: modal.digital_url || null,
      collection_id: modal.collection_id || null, brand_id: modal.brand_id || null,
    }
    const res = modal.id ? await supabase.from('store_listings').update(p).eq('id', modal.id) : await supabase.from('store_listings').insert(p)
    if (res.error) return notify?.('Erro: ' + res.error.message, 'error')
    notify?.(modal.id ? 'Item atualizado' : 'Item criado', 'success'); setModal(null); load()
  }
  const remove = async (r) => { if (confirm(`Remover "${r.title}"?`)) { await supabase.from('store_listings').delete().eq('id', r.id); load() } }
  const setF = (k, v) => setModal((m) => ({ ...m, [k]: v }))
  const showField = (f) => fieldsForType(modal.item_type).includes(f)
  const margin = modal && Number(modal.price) > 0 && modal.cost !== '' ? Math.round(((Number(modal.price) - Number(modal.cost)) / Number(modal.price)) * 100) : null

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando catálogo…</p>

  return (
    <div>
      {/* filtros por tipo (chips grandes) */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setTypeFilter('')} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors ${!typeFilter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todos <span className="text-[10px] opacity-60">{rows.length}</span></button>
        {ITEM_TYPES.filter((t) => counts[t.key]).map((t) => (
          <button key={t.key} onClick={() => setTypeFilter(t.key)} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors ${typeFilter === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>
            <Icon name={t.icon} className="w-4 h-4" />{t.label} <span className="text-[10px] opacity-60">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* busca + status + novo */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-44"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no catálogo…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" /></div>
        <div className="w-40"><GlassSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Todos os status' }, ...WORKFLOW.map((w) => ({ value: w.key, label: w.label }))]} /></div>
        <div className="w-48"><GlassSelect value="" onChange={(v) => v && openNew(v)} options={[{ value: '', label: '+ Novo item…' }, ...ITEM_TYPES.map((t) => ({ value: t.key, label: t.label }))]} /></div>
      </div>

      {/* grade de itens */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-12">Nenhum item. Crie produtos, serviços, experiências, kits e mais.</p>}
        {filtered.map((r) => {
          const tm = typeMeta(r.item_type); const wm = workflowMeta(r.status)
          return (
            <div key={r.id} className="glass rounded-2xl p-4 group hover:bg-white/[0.03] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${accentText[tm.accent]}`}><Icon name={tm.icon} className="w-3.5 h-3.5" />{tm.label}</div>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg ${wm.chip}`}>{wm.label}</span>
              </div>
              <p className="text-admin-text text-sm font-medium leading-tight line-clamp-2">{r.title}</p>
              {r.subtitle && <p className="text-admin-muted/50 text-[11px] mt-0.5 line-clamp-1">{r.subtitle}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-admin-gold text-sm">{brl(r.price)}</span>
                <div className="flex items-center gap-2 text-[10px] text-admin-muted/50">
                  {r.stock != null && <span>{r.stock} un</span>}
                  {r.capacity != null && <span>{r.booked || 0}/{r.capacity} vagas</span>}
                  {r.recurrence && <span>{RECURRENCE.find((x) => x.value === r.recurrence)?.label}</span>}
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose ml-auto"><Icon name="trash" className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* editor multi-tipo */}
      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-admin-text flex items-center gap-2"><Icon name={typeMeta(modal.item_type).icon} className="w-5 h-5 text-admin-champ" />{modal.id ? 'Editar' : 'Novo'} · {typeMeta(modal.item_type).label}</h2>
              <button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>

            {/* tipo (troca campos) */}
            <div className="mb-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo de item</label>
              <div className="flex gap-1.5 flex-wrap">
                {ITEM_TYPES.map((t) => <button key={t.key} onClick={() => setF('item_type', t.key)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ${modal.item_type === t.key ? 'bg-admin-champ/15 text-admin-champ ring-1 ring-admin-champ/30' : 'bg-white/[0.04] text-admin-muted/60'}`}><Icon name={t.icon} className="w-3.5 h-3.5" />{t.label}</button>)}
              </div>
            </div>

            <div className="space-y-3">
              <input value={modal.title} onChange={(e) => setF('title', e.target.value)} className={inputCls} placeholder="Título" />
              <input value={modal.subtitle || ''} onChange={(e) => setF('subtitle', e.target.value)} className={inputCls} placeholder="Subtítulo / chamada curta" />

              <div className="grid grid-cols-3 gap-3">
                {showField('price') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Preço (R$)</label><input type="number" step="0.01" value={modal.price} onChange={(e) => setF('price', e.target.value)} className={inputCls} /></div>}
                {showField('cost') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Custo (R$)</label><input type="number" step="0.01" value={modal.cost} onChange={(e) => setF('cost', e.target.value)} className={inputCls} /></div>}
                {showField('category') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Categoria</label><input value={modal.category || ''} onChange={(e) => setF('category', e.target.value)} className={inputCls} /></div>}
              </div>
              {margin != null && <p className={`text-[11px] ${margin >= 0 ? 'text-admin-sage' : 'text-admin-rose'}`}>Margem: {margin}% · lucro {brl(Number(modal.price) - Number(modal.cost))}</p>}

              <div className="grid grid-cols-2 gap-3">
                {showField('collection') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Coleção</label><GlassSelect value={modal.collection_id || ''} onChange={(v) => setF('collection_id', v)} options={[{ value: '', label: '— nenhuma —' }, ...collections.map((c) => ({ value: c.id, label: c.name }))]} /></div>}
                {showField('brand') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Marca</label><GlassSelect value={modal.brand_id || ''} onChange={(v) => setF('brand_id', v)} options={[{ value: '', label: '— nenhuma —' }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} /></div>}
              </div>

              {/* campos por tipo */}
              <div className="grid grid-cols-2 gap-3">
                {showField('sku') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">SKU</label><input value={modal.sku || ''} onChange={(e) => setF('sku', e.target.value)} className={inputCls} /></div>}
                {showField('stock') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Estoque</label><input type="number" value={modal.stock} onChange={(e) => setF('stock', e.target.value)} className={inputCls} /></div>}
                {showField('capacity') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Vagas / capacidade</label><input type="number" value={modal.capacity} onChange={(e) => setF('capacity', e.target.value)} className={inputCls} /></div>}
                {showField('duration') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Duração (min)</label><input type="number" value={modal.duration_minutes} onChange={(e) => setF('duration_minutes', e.target.value)} className={inputCls} /></div>}
                {showField('start_at') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Data</label><GlassDate value={modal.start_at} onChange={(v) => setF('start_at', v)} /></div>}
                {showField('location') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Local</label><input value={modal.location || ''} onChange={(e) => setF('location', e.target.value)} className={inputCls} /></div>}
                {showField('recurrence') && <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Recorrência</label><GlassSelect value={modal.recurrence} onChange={(v) => setF('recurrence', v)} options={RECURRENCE} /></div>}
                {showField('digital_url') && <div className="col-span-2"><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">URL do arquivo digital</label><input value={modal.digital_url || ''} onChange={(e) => setF('digital_url', e.target.value)} className={inputCls} placeholder="https://…" /></div>}
              </div>

              {/* workflow */}
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Status (workflow)</label>
                <div className="flex gap-1.5">
                  {WORKFLOW.map((w) => <button key={w.key} onClick={() => setF('status', w.key)} className={`px-3 py-1.5 rounded-lg text-[11px] ${modal.status === w.key ? w.chip + ' ring-1 ring-white/20' : 'bg-white/[0.04] text-admin-muted/60'}`}>{w.label}</button>)}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.id ? 'Salvar' : 'Criar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
