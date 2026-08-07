import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { uploadToVault, vaultSignedUrl, removeFromVault } from '../../lib/storage'
import { logAudit } from '../../lib/audit'

// Cofre de Documentos: qualquer usuário guarda arquivos organizados por categoria,
// assunto e data. Categorias e assuntos são criáveis por todos. Busca e filtros.
const CAT_COLORS = ['champ', 'gold', 'sage', 'copper', 'rose']
const colorCls = (c) => ({
  champ: 'bg-admin-champ/15 text-admin-champ', gold: 'bg-admin-gold/15 text-admin-gold',
  sage: 'bg-admin-sage/15 text-admin-sage', copper: 'bg-admin-copper/15 text-admin-copper',
  rose: 'bg-admin-rose/15 text-admin-rose',
}[c] || 'bg-admin-champ/15 text-admin-champ')
const fmtSize = (b) => { const n = Number(b) || 0; if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`; return `${(n / 1048576).toFixed(1)} MB` }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const extIcon = (ext) => {
  const e = (ext || '').toLowerCase()
  if (e === 'pdf') return 'book'
  if (['doc', 'docx'].includes(e)) return 'pen'
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'chart'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) return 'image'
  return 'box'
}
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

export function DocumentVault({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true

  const [cats, setCats] = useState([])
  const [subjects, setSubjects] = useState([])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  // filtros
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fSubj, setFSubj] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  // modais
  const [uploadOpen, setUploadOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: c }, { data: s }, { data: d }] = await Promise.all([
      supabase.from('doc_categories').select('*').order('name'),
      supabase.from('doc_subjects').select('*').order('name'),
      supabase.from('vault_documents').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    setCats(c || []); setSubjects(s || []); setDocs(d || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats])
  const subjById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects])
  const subjectsOfFilter = useMemo(() => fCat ? subjects.filter((s) => s.category_id === fCat) : subjects, [subjects, fCat])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return docs.filter((d) => {
      if (fCat && d.category_id !== fCat) return false
      if (fSubj && d.subject_id !== fSubj) return false
      if (fFrom && (d.doc_date || '') < fFrom) return false
      if (fTo && (d.doc_date || '') > fTo) return false
      if (term) {
        const hay = `${d.title || ''} ${d.description || ''} ${d.file_name || ''} ${(d.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [docs, q, fCat, fSubj, fFrom, fTo])

  const openDoc = async (d) => {
    // propostas guardam o link vivo na descrição (sem arquivo físico)
    if (d.source === 'proposal') {
      const m = (d.description || '').match(/https?:\/\/\S+/)
      if (m) return window.open(m[0], '_blank', 'noopener')
      return notify?.('Link da proposta indisponível', 'error')
    }
    if (!d.storage_path) return notify?.('Arquivo indisponível', 'error')
    const { url, error } = await vaultSignedUrl(d.storage_path, 3600)
    if (error) return notify?.('Erro ao abrir: ' + error, 'error')
    window.open(url, '_blank', 'noopener')
  }

  const removeDoc = async (d) => {
    if (d.storage_path) await removeFromVault(d.storage_path)
    const { error } = await supabase.from('vault_documents').delete().eq('id', d.id)
    if (error) return notify?.('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'vault_documents', resource_id: d.id, old_data: { title: d.title } }, tenantId)
    notify?.('Documento removido', 'success'); load()
  }

  const clearFilters = () => { setQ(''); setFCat(''); setFSubj(''); setFFrom(''); setFTo('') }
  const hasFilters = q || fCat || fSubj || fFrom || fTo

  return (
    <div>
      {/* barra de ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-admin-muted/50 text-sm">{filtered.length} de {docs.length} documento(s) no cofre</p>
        <div className="flex gap-2">
          <button onClick={() => setManageOpen(true)} className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] text-admin-muted hover:text-admin-text px-3 py-2 rounded-xl text-sm"><Icon name="folder" className="w-4 h-4" />Categorias & assuntos</button>
          {mayEdit && <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Enviar documento</button>}
        </div>
      </div>

      {/* filtros */}
      <div className="glass rounded-2xl p-4 mb-4 grid md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Buscar</label>
          <div className="relative">
            <Icon name="search" className="w-4 h-4 text-admin-muted/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, descrição, tag…" className={`${inputCls} pl-9`} />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Categoria</label>
          <GlassSelect value={fCat} onChange={(v) => { setFCat(v); setFSubj('') }} options={[{ value: '', label: 'Todas' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Assunto</label>
          <GlassSelect value={fSubj} onChange={setFSubj} options={[{ value: '', label: 'Todos' }, ...subjectsOfFilter.map((s) => ({ value: s.id, label: s.name }))]} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">De</label>
          <GlassDate value={fFrom} onChange={setFFrom} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Até</label>
          <GlassDate value={fTo} onChange={setFTo} />
        </div>
        {hasFilters && <div className="md:col-span-6"><button onClick={clearFilters} className="text-admin-muted/60 hover:text-admin-text text-xs flex items-center gap-1"><Icon name="x" className="w-3 h-3" />Limpar filtros</button></div>}
      </div>

      {/* lista */}
      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando cofre…</p>
        : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Icon name="folder" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
            <p className="text-admin-muted/50 text-sm">{docs.length === 0 ? 'Cofre vazio.' : 'Nenhum documento com esses filtros.'}</p>
            {mayEdit && docs.length === 0 && <p className="text-admin-muted/30 text-xs mt-1">Clique em "Enviar documento" para guardar seu primeiro arquivo.</p>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((d) => {
              const cat = catById[d.category_id]; const subj = subjById[d.subject_id]
              return (
                <div key={d.id} className="glass rounded-2xl p-4 flex flex-col group">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorCls(cat?.color)}`}><Icon name={extIcon(d.file_ext)} className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-admin-text text-sm font-medium truncate">{d.title}</p>
                      <p className="text-admin-muted/40 text-[11px] truncate">{d.file_name} · {fmtSize(d.file_size)}</p>
                    </div>
                  </div>
                  {d.description && <p className="text-admin-muted/55 text-xs mt-2 line-clamp-2">{d.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cat && <span className={`text-[10px] px-2 py-0.5 rounded-lg ${colorCls(cat.color)}`}>{cat.name}</span>}
                    {subj && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{subj.name}</span>}
                    {d.source === 'proposal' && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-sage/10 text-admin-sage/80">proposta</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05] text-[11px] text-admin-muted/40">
                    <Icon name="calendar" className="w-3 h-3" />{fmtDate(d.doc_date)}
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => openDoc(d)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05]" title="Abrir / baixar"><Icon name="download" className="w-3.5 h-3.5" /></button>
                      {mayEdit && <button onClick={() => removeDoc(d)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05]" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {uploadOpen && <UploadModal cats={cats} subjects={subjects} tenantId={tenantId} notify={notify} onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); load() }} />}
      {manageOpen && <ManageModal cats={cats} subjects={subjects} tenantId={tenantId} notify={notify} onClose={() => setManageOpen(false)} onChange={load} />}
    </div>
  )
}

// ---------- Upload ----------
function UploadModal({ cats, subjects, tenantId, notify, onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [catId, setCatId] = useState('')
  const [subjId, setSubjId] = useState('')
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10))
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const inRef = useRef(null)
  const subjOpts = useMemo(() => catId ? subjects.filter((s) => s.category_id === catId) : subjects, [subjects, catId])

  const pick = (f) => { if (!f) return; setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')) }

  const submit = async () => {
    if (!file) return notify?.('Selecione um arquivo', 'error')
    if (!title.trim()) return notify?.('Dê um título ao documento', 'error')
    setBusy(true)
    const up = await uploadToVault(file, { folder: 'docs' })
    if (up.error) { setBusy(false); return notify?.('Erro no upload: ' + up.error, 'error') }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const payload = {
      title: title.trim(), description: description.trim() || null,
      category_id: catId || null, subject_id: subjId || null,
      storage_path: up.path, file_name: file.name, file_type: file.type, file_ext: ext, file_size: file.size,
      source: 'upload', doc_date: docDate,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const { data, error } = await supabase.from('vault_documents').insert(payload).select('id').single()
    setBusy(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: 'create', resource_type: 'vault_documents', resource_id: data?.id, new_data: { title: payload.title } }, tenantId)
    notify?.('Documento guardado no cofre', 'success'); onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Enviar documento</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        <div onClick={() => inRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
          className="border border-dashed border-white/15 rounded-xl p-6 text-center cursor-pointer hover:border-admin-champ/40 transition-colors mb-4">
          <Icon name={file ? 'check' : 'plus'} className={`w-7 h-7 mx-auto mb-2 ${file ? 'text-admin-sage' : 'text-admin-champ/60'}`} />
          <p className="text-admin-text text-sm">{file ? file.name : 'Clique ou arraste um arquivo (PDF, Word, planilha, imagem…)'}</p>
          <p className="text-admin-muted/40 text-xs mt-0.5">{file ? fmtSize(file.size) : 'Até 50 MB'}</p>
          <input ref={inRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <div className="space-y-3">
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Título *</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Descrição</label><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Categoria</label><GlassSelect value={catId} onChange={(v) => { setCatId(v); setSubjId('') }} options={[{ value: '', label: '— nenhuma —' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Assunto</label><GlassSelect value={subjId} onChange={setSubjId} options={[{ value: '', label: '— nenhum —' }, ...subjOpts.map((s) => ({ value: s.id, label: s.name }))]} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Data do documento</label><GlassDate value={docDate} onChange={setDocDate} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Tags (vírgula)</label><input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="contrato, 2026" /></div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={submit} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm disabled:opacity-50">{busy ? 'Enviando…' : 'Guardar no cofre'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Gestão de categorias & assuntos ----------
function ManageModal({ cats, subjects, tenantId, notify, onClose, onChange }) {
  const [newCat, setNewCat] = useState('')
  const [newCatColor, setNewCatColor] = useState('champ')
  const [newSubj, setNewSubj] = useState('')
  const [newSubjCat, setNewSubjCat] = useState('')

  const addCat = async () => {
    if (!newCat.trim()) return
    const { error } = await supabase.from('doc_categories').insert({ name: newCat.trim(), color: newCatColor })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setNewCat(''); notify?.('Categoria criada', 'success'); onChange()
  }
  const delCat = async (c) => { const { error } = await supabase.from('doc_categories').delete().eq('id', c.id); if (error) return notify?.('Erro ao excluir', 'error'); notify?.('Categoria removida', 'success'); onChange() }
  const addSubj = async () => {
    if (!newSubj.trim()) return
    const { error } = await supabase.from('doc_subjects').insert({ name: newSubj.trim(), category_id: newSubjCat || null })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setNewSubj(''); notify?.('Assunto criado', 'success'); onChange()
  }
  const delSubj = async (s) => { const { error } = await supabase.from('doc_subjects').delete().eq('id', s.id); if (error) return notify?.('Erro ao excluir', 'error'); notify?.('Assunto removido', 'success'); onChange() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Categorias & assuntos</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* categorias */}
          <div>
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Categorias</p>
            <div className="flex gap-2 mb-3">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="Nova categoria" className={inputCls} />
              <button onClick={addCat} className="bg-admin-champ/15 text-admin-champ px-3 rounded-xl text-sm shrink-0"><Icon name="plus" className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1.5 mb-3">
              {CAT_COLORS.map((c) => <button key={c} onClick={() => setNewCatColor(c)} className={`w-6 h-6 rounded-lg ${colorCls(c)} ${newCatColor === c ? 'ring-2 ring-white/40' : ''}`} />)}
            </div>
            <div className="space-y-1.5">
              {cats.length === 0 && <p className="text-admin-muted/40 text-xs">Nenhuma categoria ainda.</p>}
              {cats.map((c) => (
                <div key={c.id} className="flex items-center gap-2 glass-soft rounded-lg px-3 py-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${colorCls(c.color)}`} />
                  <span className="text-admin-text text-sm flex-1 truncate">{c.name}</span>
                  <button onClick={() => delCat(c)} className="text-admin-muted/50 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* assuntos */}
          <div>
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Assuntos</p>
            <div className="space-y-2 mb-3">
              <input value={newSubj} onChange={(e) => setNewSubj(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubj()} placeholder="Novo assunto" className={inputCls} />
              <div className="flex gap-2">
                <GlassSelect value={newSubjCat} onChange={setNewSubjCat} options={[{ value: '', label: 'Sem categoria' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} className="flex-1" />
                <button onClick={addSubj} className="bg-admin-champ/15 text-admin-champ px-3 rounded-xl text-sm shrink-0"><Icon name="plus" className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-1.5">
              {subjects.length === 0 && <p className="text-admin-muted/40 text-xs">Nenhum assunto ainda.</p>}
              {subjects.map((s) => (
                <div key={s.id} className="flex items-center gap-2 glass-soft rounded-lg px-3 py-2">
                  <Icon name="tag" className="w-3.5 h-3.5 text-admin-muted/40" />
                  <span className="text-admin-text text-sm flex-1 truncate">{s.name}</span>
                  {s.category_id && <span className="text-admin-muted/40 text-[10px]">{cats.find((c) => c.id === s.category_id)?.name}</span>}
                  <button onClick={() => delSubj(s)} className="text-admin-muted/50 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-admin-muted/40 text-[11px] mt-5">Qualquer usuário pode criar categorias e assuntos. Eles ficam disponíveis para toda a empresa.</p>
      </div>
    </div>
  )
}
