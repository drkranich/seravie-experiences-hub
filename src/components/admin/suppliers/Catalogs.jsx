import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { uploadTo } from '../../../lib/storage'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, brl } from '../../../lib/suppliersMarket'

// Catálogos + Marketplace de produtos — grade de produtos de todos os fornecedores,
// filtrável por categoria/tipo. Cada usuário cria os produtos dos SEUS fornecedores.

export function Catalogs({ suppliers, tenantId, onOpenSupplier, notify }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  // fornecedores do próprio tenant (para criar produtos neles)
  const mySuppliers = useMemo(() => suppliers.filter((s) => s.tenant_id === tenantId), [suppliers, tenantId])

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('supplier_products').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(300); setProducts(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products])
  const filtered = useMemo(() => {
    const nq = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return products.filter((p) => {
      if (cat && p.category !== cat) return false
      if (nq && !`${p.name} ${p.description || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nq)) return false
      return true
    })
  }, [products, cat, q])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Catálogos</h1><p className="text-admin-muted/50 text-sm mt-1">Produtos de todos os fornecedores homologados, num só lugar.</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-56"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
          {mySuppliers.length > 0 && <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Criar produto</button>}
        </div>
      </div>

      {cats.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
          <button onClick={() => setCat('')} className={`shrink-0 text-xs px-3.5 py-2 rounded-xl transition-colors ${!cat ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos</button>
          {cats.map((c) => <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-colors ${cat === c ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}><Icon name={CATEGORY_ICON[c] || 'box'} className="w-3.5 h-3.5" />{SUPPLIER_CATEGORIES[c] || c}</button>)}
        </div>
      )}

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="glass rounded-2xl h-56 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <Empty text="Nenhum produto encontrado. Fornecedores publicam produtos no perfil deles." />
          : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((p) => { const sup = supplierById[p.supplier_id]; return (
                <button key={p.id} onClick={() => sup && onOpenSupplier(sup)} className="group text-left glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="h-40 bg-white/[0.03] overflow-hidden">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="box" className="w-9 h-9 text-admin-champ/20" /></div>}</div>
                  <div className="p-4">
                    <p className="text-admin-text text-sm font-medium truncate">{p.name}</p>
                    {sup && <p className="text-admin-muted/40 text-[11px] truncate">{sup.name}</p>}
                    <div className="flex items-center justify-between mt-3"><span className="text-admin-champ text-sm">{p.price ? brl(p.price) : 'Sob consulta'}</span>{p.unit && <span className="text-admin-muted/40 text-[11px]">/{p.unit}</span>}</div>
                  </div>
                </button>
              )})}
            </div>}

      {creating && <ProductModal suppliers={mySuppliers} tenantId={tenantId} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} notify={notify} />}
    </div>
  )
}

function Empty({ text }) { return <div className="glass rounded-2xl p-12 text-center"><Icon name="box" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">{text}</p></div> }

function ProductModal({ suppliers, tenantId, onClose, onSaved, notify }) {
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id || '', name: '', description: '', category: '', price: '', unit: 'un', min_qty: '', image_url: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const r = await uploadTo(file, { folder: 'suppliers/produtos', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('image_url', r.url)
  }
  const save = async () => {
    if (!f.supplier_id || !f.name.trim()) return notify?.('Selecione o fornecedor e o nome do produto', 'error')
    setSaving(true)
    const { error } = await supabase.from('supplier_products').insert({
      tenant_id: tenantId, supplier_id: f.supplier_id, name: f.name, description: f.description || null,
      category: f.category || null, price: f.price !== '' ? Number(f.price) : null, unit: f.unit || null,
      min_qty: f.min_qty !== '' ? Number(f.min_qty) : null, image_url: f.image_url || null, status: 'active',
    })
    setSaving(false)
    if (error) return notify?.('Erro ao criar: ' + error.message, 'error')
    notify?.('Produto publicado no catálogo.', 'success'); onSaved()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Criar produto</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <GlassSelect value={f.supplier_id} onChange={(v) => set('supplier_id', v)} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome do produto *" className={cls} />
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Descrição" className={`${cls} resize-none`} />
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect value={f.category} onChange={(v) => set('category', v)} options={[{ value: '', label: 'Categoria' }, ...Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => ({ value, label }))]} />
            <input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Unidade (un, m², kg…)" className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="Preço (R$)" className={cls} />
            <input type="number" value={f.min_qty} onChange={(e) => set('min_qty', e.target.value)} placeholder="Qtd. mínima" className={cls} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full glass-input rounded-xl px-4 py-3 text-sm text-admin-muted/70 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <Icon name={uploading ? 'clock' : f.image_url ? 'check' : 'image'} className="w-4 h-4" />{uploading ? 'Enviando…' : f.image_url ? 'Imagem pronta' : 'Foto do produto'}
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Publicar'}</button>
        </div>
      </div>
    </div>
  )
}
