import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Experience Collections — coleções curadas (moodboards do ecossistema) que
// reúnem fornecedores, produtos, membros e imagens em torno de um conceito.

const THEMES = ['Hospitalidade', 'Retail', 'Gastronomia', 'Escritório', 'Residencial', 'Evento', 'Beleza', 'Outro']

export function Collections({ me, notify, onOpenSupplier }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [cols, setCols] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('network_collections').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(100); setCols(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async (payload) => {
    const { data, error } = await supabase.from('network_collections').insert({ ...payload, tenant_id: tenantId, status: 'published' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setCols((c) => [data, ...c]); setCreating(false); notify?.('Coleção criada', 'success'); setOpen(data)
  }

  if (open) return <CollectionDetail collection={cols.find((c) => c.id === open.id) || open} tenantId={tenantId} onBack={() => { setOpen(null); load() }} onOpenSupplier={onOpenSupplier} notify={notify} />

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Experience Collections</h1><p className="text-admin-muted/50 text-sm mt-1">Coleções curadas que reúnem fornecedores, produtos e referências por conceito.</p></div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova coleção</button>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-56 animate-pulse opacity-40" />)}</div>
        : cols.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="layers" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhuma coleção ainda.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cols.map((c) => (
                <button key={c.id} onClick={() => setOpen(c)} className="glass rounded-2xl overflow-hidden text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="h-36 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 flex items-center justify-center">{c.cover_url ? <img src={c.cover_url} alt="" className="w-full h-full object-cover" /> : <Icon name="layers" className="w-8 h-8 text-admin-champ/25" />}</div>
                  <div className="p-4">
                    {c.theme && <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1">{c.theme}</p>}
                    <p className="text-admin-text font-medium">{c.title}</p>
                    {c.description && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2">{c.description}</p>}
                    <p className="text-admin-muted/40 text-[11px] mt-2">{c.items_count || 0} itens{c.curator ? ` · por ${c.curator}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>}

      {creating && <CreateCollection onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
    </div>
  )
}

function CreateCollection({ onClose, onCreate, notify }) {
  const [f, setF] = useState({ title: '', theme: '', description: '', curator: '', cover_url: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'network/collections', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Nova coleção</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Capa</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-24 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar capa'}</span>}
            </button>
          </div>
          <div><label className={lbl}>Título *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Cafeteria Aconchegante" className={cls} /></div>
          <div><label className={lbl}>Tema</label><GlassSelect value={f.theme} onChange={(v) => set('theme', v)} options={[{ value: '', label: '—' }, ...THEMES.map((t) => ({ value: t, label: t }))]} /></div>
          <div><label className={lbl}>Descrição</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${cls} resize-none`} /></div>
          <div><label className={lbl}>Curador</label><input value={f.curator} onChange={(e) => set('curator', e.target.value)} placeholder="Seu nome / estúdio" className={cls} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, theme: f.theme || null, description: f.description || null, curator: f.curator || null, cover_url: f.cover_url || null })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar</button></div>
      </div>
    </div>
  )
}

const ITEM_KINDS = { supplier: 'Fornecedor', member: 'Profissional', product: 'Produto', image: 'Imagem', note: 'Nota' }

function CollectionDetail({ collection: c, tenantId, onBack, onOpenSupplier, notify }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const isMine = c.tenant_id === tenantId

  const load = async () => {
    const { data } = await supabase.from('network_collection_items').select('*').eq('collection_id', c.id).order('sort', { ascending: true })
    setItems(data || [])
  }
  useEffect(() => { load() }, [c.id])

  const addItem = async (item) => {
    const { data, error } = await supabase.from('network_collection_items').insert({ ...item, tenant_id: tenantId, collection_id: c.id, sort: items.length }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setItems((it) => [...it, data]); setAdding(false)
    await supabase.from('network_collections').update({ items_count: items.length + 1 }).eq('id', c.id)
  }
  const rmItem = async (id) => {
    setItems((it) => it.filter((x) => x.id !== id))
    await supabase.from('network_collection_items').delete().eq('id', id)
    await supabase.from('network_collections').update({ items_count: Math.max(0, items.length - 1) }).eq('id', c.id)
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar às coleções</button>
      {c.cover_url && <div className="rounded-2xl overflow-hidden h-44 mb-4 relative"><img src={c.cover_url} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /></div>}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{c.title}</h1>{c.theme && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{c.theme}</span>}</div>
          {c.description && <p className="text-admin-muted/65 text-sm mt-2 max-w-2xl">{c.description}</p>}
          {c.curator && <p className="text-admin-muted/40 text-xs mt-1">Curadoria: {c.curator}</p>}
        </div>
        {isMine && <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Adicionar item</button>}
      </div>

      {items.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="layers" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">{isMine ? 'Adicione fornecedores, produtos, imagens e notas à coleção.' : 'Coleção ainda sem itens.'}</p></div>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <div key={it.id} className="glass rounded-2xl overflow-hidden group relative">
                {it.image_url && <div className="h-32 overflow-hidden"><img src={it.image_url} alt="" className="w-full h-full object-cover" /></div>}
                <div className="p-4">
                  <span className="text-[9px] uppercase tracking-wider text-admin-champ/60">{ITEM_KINDS[it.kind] || it.kind}</span>
                  <p className="text-admin-text text-sm mt-1">{it.title}</p>
                  {it.subtitle && <p className="text-admin-muted/45 text-xs mt-0.5">{it.subtitle}</p>}
                  {it.note && <p className="text-admin-muted/55 text-xs mt-2 leading-relaxed">{it.note}</p>}
                </div>
                {isMine && <button onClick={() => rmItem(it.id)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white/80 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>}

      {adding && <AddItemModal tenantId={tenantId} onClose={() => setAdding(false)} onAdd={addItem} notify={notify} />}
    </div>
  )
}

function AddItemModal({ tenantId, onClose, onAdd, notify }) {
  const [kind, setKind] = useState('image')
  const [f, setF] = useState({ title: '', subtitle: '', note: '', image_url: '' })
  const [supplierPick, setSupplierPick] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  useEffect(() => {
    if (kind === 'supplier' && suppliers.length === 0) {
      supabase.from('suppliers').select('id,name,city,logo_url,category').eq('status', 'published').limit(300).then(({ data }) => setSuppliers(data || []))
    }
  }, [kind])

  const upImg = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'network/collections', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('image_url', r.url)
  }
  const submit = () => {
    if (kind === 'supplier') {
      const s = suppliers.find((x) => x.id === supplierPick)
      if (!s) return notify?.('Selecione um fornecedor', 'error')
      return onAdd({ kind: 'supplier', ref_id: s.id, title: s.name, subtitle: [s.category, s.city].filter(Boolean).join(' · '), image_url: s.logo_url || null })
    }
    if (!f.title.trim() && !f.image_url) return notify?.('Preencha o item', 'error')
    onAdd({ kind, title: f.title || null, subtitle: f.subtitle || null, note: f.note || null, image_url: f.image_url || null })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Adicionar item</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className={lbl}>Tipo</label><GlassSelect value={kind} onChange={setKind} options={Object.entries(ITEM_KINDS).map(([value, label]) => ({ value, label }))} /></div>
          {kind === 'supplier' ? (
            <div><label className={lbl}>Fornecedor</label><GlassSelect value={supplierPick} onChange={setSupplierPick} options={[{ value: '', label: 'Selecione…' }, ...suppliers.map((s) => ({ value: s.id, label: `${s.name}${s.city ? ' · ' + s.city : ''}` }))]} /></div>
          ) : (
            <>
              {(kind === 'image' || kind === 'product' || kind === 'member') && (
                <div>
                  <label className={lbl}>Imagem</label>
                  <input ref={imgRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upImg(e.target.files[0])} className="hidden" />
                  <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading} className="w-full h-24 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
                    {f.image_url ? <img src={f.image_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar imagem'}</span>}
                  </button>
                </div>
              )}
              {kind !== 'image' && <div><label className={lbl}>Título</label><input value={f.title} onChange={(e) => set('title', e.target.value)} className={cls} /></div>}
              {kind !== 'image' && <div><label className={lbl}>Subtítulo</label><input value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={cls} /></div>}
              <div><label className={lbl}>Nota</label><textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} className={`${cls} resize-none`} /></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={submit} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Adicionar</button></div>
      </div>
    </div>
  )
}
