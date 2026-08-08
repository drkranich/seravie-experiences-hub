import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Biblioteca Técnica — arquivos dos fornecedores (PDF, DWG, BIM, 3D, manuais, vídeos).
// Leitura pública (marketplace) + upload pelo dono do fornecedor.

const KINDS = {
  pdf: { label: 'PDF', icon: 'book', accept: '.pdf' },
  dwg: { label: 'DWG (CAD)', icon: 'layout', accept: '.dwg,.dxf' },
  bim: { label: 'BIM', icon: 'grid', accept: '.rvt,.ifc' },
  model3d: { label: 'Modelo 3D', icon: 'box', accept: '.obj,.fbx,.glb,.gltf,.stl,.skp' },
  video: { label: 'Vídeo', icon: 'play', accept: 'video/*' },
  manual: { label: 'Manual', icon: 'book', accept: '.pdf,.doc,.docx' },
  image: { label: 'Imagem', icon: 'image', accept: 'image/*' },
  other: { label: 'Outro', icon: 'folder', accept: 'any' },
}

export function TechLibrary({ suppliers, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const mySupplierIds = useMemo(() => new Set(suppliers.filter((s) => s.tenant_id === tenantId).map((s) => s.id)), [suppliers, tenantId])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('')
  const [sup, setSup] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('supplier_library').select('*').order('created_at', { ascending: false }).limit(300); setItems(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const filtered = items.filter((it) => (!kind || it.kind === kind) && (!sup || it.supplier_id === sup))
  const mySuppliers = suppliers.filter((s) => mySupplierIds.has(s.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Biblioteca Técnica</h1><p className="text-admin-muted/50 text-sm mt-1">Catálogos, PDFs, DWG, BIM, modelos 3D e manuais dos fornecedores.</p></div>
        {mySuppliers.length > 0 && <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="upload" className="w-4 h-4" />Enviar arquivo</button>}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
        <button onClick={() => setKind('')} className={`shrink-0 text-xs px-3.5 py-2 rounded-xl transition-colors ${!kind ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos</button>
        {Object.entries(KINDS).map(([k, v]) => <button key={k} onClick={() => setKind(kind === k ? '' : k)} className={`shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-colors ${kind === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}><Icon name={v.icon} className="w-3.5 h-3.5" />{v.label}</button>)}
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-24 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="folder" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhum arquivo técnico ainda.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((it) => { const s = supplierById[it.supplier_id]; const kv = KINDS[it.kind] || KINDS.other; const mine = mySupplierIds.has(it.supplier_id); return (
                <div key={it.id} className="group glass rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name={kv.icon} className="w-5 h-5 text-admin-champ/70" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-admin-text text-sm font-medium truncate">{it.title}</p>
                    <p className="text-admin-muted/40 text-[11px] truncate">{kv.label}{s ? ` · ${s.name}` : ''}{it.size_kb ? ` · ${(it.size_kb / 1024).toFixed(1)} MB` : ''}</p>
                    {it.file_url && <a href={it.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-admin-champ/80 hover:text-admin-champ mt-2"><Icon name="download" className="w-3.5 h-3.5" />Baixar</a>}
                  </div>
                  {mine && <button onClick={async () => { if (confirm('Excluir este arquivo?')) { await supabase.from('supplier_library').delete().eq('id', it.id); load() } }} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Excluir"><Icon name="trash" className="w-4 h-4" /></button>}
                </div>
              )})}
            </div>}

      {adding && <UploadModal suppliers={mySuppliers} tenantId={tenantId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} notify={notify} />}
    </div>
  )
}

function UploadModal({ suppliers, tenantId, onClose, onDone, notify }) {
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id || '', kind: 'pdf', title: '', description: '', file_url: '', size_kb: null })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const r = await uploadTo(file, { folder: 'suppliers/lib', accept: 'any', maxMB: 50 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('file_url', r.url); set('size_kb', Math.round(file.size / 1024)); if (!f.title) set('title', file.name)
  }
  const save = async () => {
    if (!f.supplier_id || !f.title.trim() || !f.file_url) return notify?.('Selecione fornecedor, título e arquivo', 'error')
    setSaving(true)
    const { error } = await supabase.from('supplier_library').insert({ tenant_id: tenantId, supplier_id: f.supplier_id, kind: f.kind, title: f.title, description: f.description || null, file_url: f.file_url, size_kb: f.size_kb })
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.('Arquivo publicado na biblioteca.', 'success'); onDone()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Enviar arquivo técnico</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <GlassSelect value={f.supplier_id} onChange={(v) => set('supplier_id', v)} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <GlassSelect value={f.kind} onChange={(v) => set('kind', v)} options={Object.entries(KINDS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Título do arquivo" className={cls} />
          <input ref={fileRef} type="file" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full glass-input rounded-xl px-4 py-3 text-sm text-admin-muted/70 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <Icon name={uploading ? 'clock' : f.file_url ? 'check' : 'upload'} className="w-4 h-4" />{uploading ? 'Enviando…' : f.file_url ? 'Arquivo pronto' : 'Escolher arquivo'}
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
