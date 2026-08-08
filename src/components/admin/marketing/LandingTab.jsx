import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { uploadFile } from '../../../lib/storage'

const BLOCK_TYPES = [
  { type: 'hero', label: 'Cabeçalho (hero)', icon: 'star' },
  { type: 'text', label: 'Texto', icon: 'book' },
  { type: 'image', label: 'Imagem', icon: 'image' },
  { type: 'cta', label: 'Botão (CTA)', icon: 'spark' },
  { type: 'form', label: 'Formulário', icon: 'check' },
]
let _blkSeq = 0
const newBlock = (type) => {
  const id = `b_${_blkSeq++}_${type}`
  const base = { id, type }
  if (type === 'hero') return { ...base, props: { title: 'Título de impacto', subtitle: 'Uma frase que convence o visitante.', cta: 'Quero saber mais' } }
  if (type === 'text') return { ...base, props: { text: 'Escreva aqui o texto do bloco.' } }
  if (type === 'image') return { ...base, props: { url: '', alt: 'Imagem' } }
  if (type === 'cta') return { ...base, props: { label: 'Comprar agora', url: '#' } }
  if (type === 'form') return { ...base, props: { formId: '', title: 'Deixe seu contato' } }
  return base
}

const ACCENTS = [
  { value: '#B89C61', label: 'Dourado' }, { value: '#55634D', label: 'Sálvia' }, { value: '#C1835B', label: 'Cobre' }, { value: '#B7745E', label: 'Rosé' },
]

// Growth Studio → Landing Pages. Construtor por blocos + preview + publicar.
export function LandingTab({ tenantId, notify }) {
  const [pages, setPages] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, fRes] = await Promise.all([
        supabase.from('landing_pages').select('*').order('created_at', { ascending: false }),
        supabase.from('marketing_forms').select('id, name').eq('is_active', true),
      ])
      setPages(pRes.data || [])
      setForms(fRes.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const [confirmDel, setConfirmDel] = useState(null)
  const startNew = () => setEditing({ id: null, name: '', status: 'draft', theme: { accent: '#B89C61' }, blocks: [newBlock('hero'), newBlock('text'), newBlock('cta')] })
  const remove = async (p) => { try { await supabase.from('landing_pages').delete().eq('id', p.id) } catch { /* noop */ } setConfirmDel(null); notify('Página removida', 'success'); load() }
  const togglePublish = async (p) => { try { await supabase.from('landing_pages').update({ status: p.status === 'published' ? 'draft' : 'published', updated_at: new Date().toISOString() }).eq('id', p.id) } catch { /* noop */ } load() }

  const pageUrl = (p) => `${window.location.origin}/lp/${p.slug || p.id}`
  const share = async (p) => {
    const url = pageUrl(p)
    if (p.status !== 'published') { notify('Publique a página antes de compartilhar o link', 'info') }
    try {
      if (navigator.share) { await navigator.share({ title: p.name || 'Landing page', url }) }
      else { await navigator.clipboard.writeText(url); notify('Link copiado: ' + url, 'success') }
    } catch { try { await navigator.clipboard.writeText(url); notify('Link copiado', 'success') } catch { notify(url, 'info') } }
  }

  if (editing) return <LandingBuilder page={editing} forms={forms} tenantId={tenantId} notify={notify} onBack={() => { setEditing(null); load() }} onSaved={() => { setEditing(null); load() }} />

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-xs max-w-lg leading-relaxed">Monte páginas de captura e vendas por blocos (cabeçalho, texto, imagem, botão, formulário), com prévia ao vivo.</p>
        <button onClick={startNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova landing page</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p>
        : pages.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><Icon name="layers" className="w-9 h-9 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma landing page ainda.</p></div>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((p) => (
              <div key={p.id} className="glass rounded-2xl p-4 group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-admin-text text-sm font-medium truncate">{p.name || 'Sem nome'}</p>
                  <span className={`text-[9px] px-2 py-0.5 rounded shrink-0 ${p.status === 'published' ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/40'}`}>{p.status === 'published' ? 'publicada' : 'rascunho'}</span>
                </div>
                <p className="text-admin-muted/40 text-xs">{(p.blocks || []).length} blocos{p.views ? ` · ${p.views} views` : ''}</p>
                {p.status === 'published' && <p className="text-admin-champ/50 text-[10px] mt-1 truncate font-mono">/lp/{p.slug || p.id}</p>}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                  <button onClick={() => togglePublish(p)} className={`px-2.5 py-1 rounded-lg ${p.status === 'published' ? 'bg-admin-rose/10 text-admin-rose/80 hover:bg-admin-rose/20' : 'bg-admin-sage/10 text-admin-sage hover:bg-admin-sage/20'} transition-colors`}>{p.status === 'published' ? 'despublicar' : 'publicar'}</button>
                  <button onClick={() => share(p)} className="flex items-center gap-1 text-admin-muted/60 hover:text-admin-champ" title="Compartilhar link"><Icon name="share" className="w-3.5 h-3.5" />link</button>
                  <button onClick={() => setEditing(p)} className="ml-auto text-admin-champ/80 hover:underline">editar</button>
                  <button onClick={() => setConfirmDel(p)} className="text-admin-muted/40 hover:text-admin-rose" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir página</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover “{confirmDel.name || 'Sem nome'}”? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3"><button onClick={() => remove(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function LandingBuilder({ page, forms, tenantId, notify, onBack, onSaved }) {
  const [name, setName] = useState(page.name || '')
  const [accent, setAccent] = useState(page.theme?.accent || '#B89C61')
  const [blocks, setBlocks] = useState(page.blocks?.length ? page.blocks : [newBlock('hero')])
  const [sel, setSel] = useState(blocks[0]?.id || null)
  const [busy, setBusy] = useState(false)

  const selBlock = blocks.find((b) => b.id === sel)
  const setBlockProps = (id, patch) => setBlocks((bs) => bs.map((b) => b.id === id ? { ...b, props: { ...b.props, ...patch } } : b))
  const addBlock = (type) => { const nb = newBlock(type); setBlocks((bs) => [...bs, nb]); setSel(nb.id) }
  const removeBlock = (id) => setBlocks((bs) => bs.filter((b) => b.id !== id))
  const move = (id, dir) => setBlocks((bs) => { const i = bs.findIndex((b) => b.id === id); const j = i + dir; if (j < 0 || j >= bs.length) return bs; const a = [...bs];[a[i], a[j]] = [a[j], a[i]]; return a })

  const save = async () => {
    if (!name.trim()) return notify('Nome obrigatório', 'error')
    setBusy(true)
    const payload = { name: name.trim(), theme: { accent }, blocks, updated_at: new Date().toISOString() }
    try {
      let error
      if (page.id) { const r = await supabase.from('landing_pages').update(payload).eq('id', page.id); error = r.error }
      else { const r = await supabase.from('landing_pages').insert({ ...payload, tenant_id: tenantId, status: 'draft' }); error = r.error }
      if (error) throw error
      notify('Landing page salva', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da página" className="glass-input rounded-xl px-4 py-2 text-sm text-admin-text outline-none flex-1 min-w-[10rem] max-w-xs" />
        <div className="flex items-center gap-1.5">
          {ACCENTS.map((a) => <button key={a.value} onClick={() => setAccent(a.value)} className={`w-6 h-6 rounded-full border-2 ${accent === a.value ? 'border-admin-text' : 'border-transparent'}`} style={{ backgroundColor: a.value }} title={a.label} />)}
        </div>
        <button onClick={save} disabled={busy} className="ml-auto flex items-center gap-1.5 text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl transition-colors disabled:opacity-50"><Icon name="check" className="w-4 h-4" />{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* blocos + editor */}
        <div className="lg:col-span-2 space-y-3">
          <div className="glass-soft rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2 px-1"><p className="text-[10px] uppercase tracking-wider text-admin-muted/40">Blocos</p></div>
            <div className="space-y-1.5">
              {blocks.map((b) => {
                const meta = BLOCK_TYPES.find((t) => t.type === b.type)
                return (
                  <div key={b.id} onClick={() => setSel(b.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel === b.id ? 'bg-admin-champ/10' : 'hover:bg-white/[0.03]'}`}>
                    <Icon name={meta?.icon || 'grid'} className="w-3.5 h-3.5 text-admin-champ/60" />
                    <span className="text-admin-text text-xs flex-1">{meta?.label}</span>
                    <button onClick={(e) => { e.stopPropagation(); move(b.id, -1) }} className="text-admin-muted/40 hover:text-admin-text"><Icon name="up" className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(b.id, 1) }} className="text-admin-muted/40 hover:text-admin-text"><Icon name="down" className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id) }} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
              {BLOCK_TYPES.map((t) => <button key={t.type} onClick={() => addBlock(t.type)} className="text-[11px] px-2 py-1 rounded-lg bg-white/[0.04] text-admin-muted/70 hover:text-admin-text flex items-center gap-1"><Icon name="plus" className="w-3 h-3" />{t.label}</button>)}
            </div>
          </div>

          {selBlock && <BlockEditor block={selBlock} forms={forms} notify={notify} onChange={(patch) => setBlockProps(selBlock.id, patch)} />}
        </div>

        {/* preview */}
        <div className="lg:col-span-3 glass-soft rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2 px-1">Prévia</p>
          <div className="rounded-xl bg-admin-bg overflow-hidden max-h-[34rem] overflow-y-auto border border-white/[0.06]">
            {blocks.map((b) => <PreviewBlock key={b.id} block={b} accent={accent} forms={forms} />)}
            {blocks.length === 0 && <p className="text-admin-muted/30 text-sm text-center py-16">Adicione blocos para montar a página.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// Botão de upload de imagem reutilizável → Storage (bucket media)
function ImageUpload({ value, onChange, notify, label = 'Imagem' }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    const r = await uploadFile(file)
    setBusy(false)
    if (r.error) { notify && notify(r.error, 'error'); return }
    onChange(r.url)
  }
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {value ? (
        <div className="relative group">
          <img src={value} alt={label} className="rounded-lg max-h-28 w-full object-cover" />
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <button onClick={() => ref.current?.click()} className="w-6 h-6 rounded bg-black/60 text-admin-text flex items-center justify-center hover:bg-black/80" title="Trocar"><Icon name="upload" className="w-3.5 h-3.5" /></button>
            <button onClick={() => onChange('')} className="w-6 h-6 rounded bg-black/60 text-admin-text flex items-center justify-center hover:bg-admin-rose/60" title="Remover"><Icon name="x" className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} disabled={busy} className="w-full glass-input rounded-lg py-4 flex flex-col items-center gap-1.5 text-admin-muted/60 hover:text-admin-text transition-colors border border-dashed border-white/10 disabled:opacity-50">
          <Icon name="upload" className="w-4 h-4" />
          <span className="text-[11px]">{busy ? 'Enviando…' : 'Enviar imagem'}</span>
        </button>
      )}
    </div>
  )
}

function BlockEditor({ block, forms, notify, onChange }) {
  const p = block.props || {}
  const L = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  const inp = 'w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none'
  return (
    <div className="glass-soft rounded-2xl p-4 space-y-3">
      <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Editar bloco</p>
      {block.type === 'hero' && <>
        <div><L>Título</L><input value={p.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inp} /></div>
        <div><L>Subtítulo</L><textarea value={p.subtitle || ''} onChange={(e) => onChange({ subtitle: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
        <div><L>Texto do botão</L><input value={p.cta || ''} onChange={(e) => onChange({ cta: e.target.value })} className={inp} /></div>
        <div><L>Imagem de fundo (opcional)</L><ImageUpload value={p.bg} onChange={(v) => onChange({ bg: v })} notify={notify} label="fundo" /></div>
      </>}
      {block.type === 'text' && <div><L>Texto</L><textarea value={p.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={4} className={inp + ' resize-none'} /></div>}
      {block.type === 'image' && <>
        <div><L>Imagem</L><ImageUpload value={p.url} onChange={(v) => onChange({ url: v })} notify={notify} /></div>
        <div><L>Ou colar URL</L><input value={p.url || ''} onChange={(e) => onChange({ url: e.target.value })} className={inp} placeholder="https://…" /></div>
        <div><L>Texto alternativo</L><input value={p.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} className={inp} /></div>
      </>}
      {block.type === 'cta' && <>
        <div><L>Texto do botão</L><input value={p.label || ''} onChange={(e) => onChange({ label: e.target.value })} className={inp} /></div>
        <div><L>Link</L><input value={p.url || ''} onChange={(e) => onChange({ url: e.target.value })} className={inp} /></div>
      </>}
      {block.type === 'form' && <>
        <div><L>Título</L><input value={p.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inp} /></div>
        <div><L>Formulário</L><GlassSelect value={p.formId || ''} onChange={(v) => onChange({ formId: v })} options={[{ value: '', label: 'Selecione…' }, ...forms.map((f) => ({ value: f.id, label: f.name }))]} /></div>
      </>}
    </div>
  )
}

function PreviewBlock({ block, accent, forms }) {
  const p = block.props || {}
  if (block.type === 'hero') return (
    <div className="px-6 py-12 text-center relative overflow-hidden" style={p.bg ? { backgroundImage: `linear-gradient(160deg, rgba(18,21,18,0.55), rgba(18,21,18,0.8)), url(${p.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(160deg, ${accent}22, transparent)` }}>
      <h1 className="font-serif text-3xl text-admin-text mb-2">{p.title}</h1>
      <p className="text-admin-muted/70 text-sm max-w-md mx-auto mb-5">{p.subtitle}</p>
      <button className="px-6 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: accent, color: '#121512' }}>{p.cta}</button>
    </div>
  )
  if (block.type === 'text') return <div className="px-6 py-6"><p className="text-admin-text/80 text-sm leading-relaxed whitespace-pre-wrap max-w-lg mx-auto">{p.text}</p></div>
  if (block.type === 'image') return <div className="px-6 py-4">{p.url ? <img src={p.url} alt={p.alt} className="rounded-xl mx-auto max-h-64 object-cover" /> : <div className="rounded-xl bg-white/[0.04] h-40 flex items-center justify-center text-admin-muted/30 text-xs">Imagem</div>}</div>
  if (block.type === 'cta') return <div className="px-6 py-6 text-center"><button className="px-6 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: accent, color: '#121512' }}>{p.label}</button></div>
  if (block.type === 'form') {
    const form = forms.find((f) => f.id === p.formId)
    return <div className="px-6 py-6"><div className="glass rounded-2xl p-5 max-w-sm mx-auto"><h3 className="text-admin-text font-medium mb-3">{p.title}</h3>{form ? <p className="text-admin-muted/50 text-xs mb-3">Formulário: {form.name}</p> : <p className="text-admin-muted/40 text-xs mb-3">Selecione um formulário</p>}<div className="glass-input rounded-lg h-9 mb-2" /><div className="glass-input rounded-lg h-9 mb-3" /><button className="w-full py-2 rounded-lg text-sm" style={{ backgroundColor: accent, color: '#121512' }}>Enviar</button></div></div>
  }
  return null
}
