import { useState, useRef, useMemo, useEffect } from 'react'
import { Icon } from './ui'
import { FlowImageField } from './FlowImageField'

// Seravie Document Studio — editor em três colunas (Biblioteca · Documento · Inspetor).
// Canvas WYSIWYG: mostra o documento exatamente como sairá publicado. Toolbar premium,
// zoom, undo/redo e preview. A lógica (salvar/publicar/cofre/fatura) vem por props.

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const DEFAULT_THEME = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ink: '#0b0a08' }
const merge = (s, data) => typeof s === 'string' ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => (data?.[k] ?? '')) : s

// Biblioteca de blocos — os funcionais + grupos futuros (visíveis, marcados).
const BLOCKS = [
  { type: 'cover', label: 'Capa', icon: 'image', group: 'Estrutura' },
  { type: 'heading', label: 'Título de seção', icon: 'tag', group: 'Estrutura' },
  { type: 'text', label: 'Parágrafo', icon: 'book', group: 'Texto' },
  { type: 'callout', label: 'Destaque', icon: 'star', group: 'Texto' },
  { type: 'divider', label: 'Divisória', icon: 'grip', group: 'Texto' },
  { type: 'image', label: 'Imagem', icon: 'image', group: 'Mídia' },
  { type: 'quote_table', label: 'Tabela de valores', icon: 'chart', group: 'Comercial' },
  { type: 'terms', label: 'Termos & condições', icon: 'check', group: 'Comercial' },
  { type: 'signature_line', label: 'Campo de assinatura', icon: 'pen', group: 'Comercial' },
]
const SOON = ['Galeria', 'Gráfico', 'Timeline', 'Checklist', 'QR Code', 'Cronograma', 'Depoimentos', 'Equipe']
const LABEL = Object.fromEntries(BLOCKS.map((b) => [b.type, b.label]))

const ZOOMS = [0.5, 0.75, 1, 1.25]

export function DocStudioEditor({
  editing, blocks, onChange, data, sel, setSel, dirty, mayEdit,
  onSave, onPublish, onVault, onInvoice, onDocField, onBack, publicUrl,
  invoicing, vaulting, notify,
}) {
  const [zoom, setZoom] = useState(0.85)
  const [preview, setPreview] = useState(false)
  const hist = useRef({ past: [], future: [] })
  const [, force] = useState(0)

  const theme = useMemo(() => ({ ...DEFAULT_THEME, ...(editing?.theme || {}) }), [editing])
  const mergeData = useMemo(() => ({ ...(data || {}), title: editing?.title, client: (data?.client || editing?.client) }), [data, editing])

  // ---- operações de bloco (com histórico) ----
  const commit = (next) => { hist.current.past.push(blocks); hist.current.future = []; onChange(next); force((x) => x + 1) }
  const setBlock = (i, patch) => commit(blocks.map((b, j) => j === i ? { ...b, ...patch } : b))
  const addBlock = (type) => { const nb = [...blocks, newBlock(type)]; commit(nb); setSel(nb.length - 1) }
  const removeBlock = (i) => { commit(blocks.filter((_, j) => j !== i)); setSel(null) }
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= blocks.length) return; const xs = [...blocks];[xs[i], xs[j]] = [xs[j], xs[i]]; commit(xs); setSel(j) }
  const duplicate = (i) => { const xs = [...blocks]; xs.splice(i + 1, 0, { ...blocks[i] }); commit(xs); setSel(i + 1) }
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.unshift(blocks); onChange(h.past.pop()); setSel(null); force((x) => x + 1) }
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(blocks); onChange(h.future.shift()); setSel(null); force((x) => x + 1) }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const grouped = useMemo(() => {
    const g = {}; BLOCKS.forEach((b) => { (g[b.group] = g[b.group] || []).push(b) }); return g
  }, [])

  const tbtn = 'h-8 px-2.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors'
  return (
    <div className="flex flex-col h-[calc(100vh-150px)] min-h-[560px] -mx-1">
      {/* ---------- TOOLBAR ---------- */}
      <div className="flex items-center gap-2 px-2 py-2 glass rounded-2xl mb-3 flex-wrap">
        <button onClick={onBack} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="x" className="w-3.5 h-3.5" />Fechar</button>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        <button onClick={undo} disabled={!hist.current.past.length} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05] disabled:opacity-30`} title="Desfazer (Ctrl+Z)"><span className="text-base leading-none">↶</span></button>
        <button onClick={redo} disabled={!hist.current.future.length} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05] disabled:opacity-30`} title="Refazer"><span className="text-base leading-none">↷</span></button>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        {/* zoom */}
        <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05]`}>−</button>
        <span className="text-[11px] text-admin-muted/60 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05]`}>+</button>
        <button onClick={() => setZoom(0.85)} className={`${tbtn} text-admin-muted/60 hover:text-admin-champ hover:bg-white/[0.05]`}>Ajustar</button>

        <div className="mx-auto" />
        <span className="text-[11px] text-admin-muted/50 hidden md:block truncate max-w-[220px]">{editing.title || 'Sem título'}</span>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        <button onClick={() => setPreview((p) => !p)} className={`${tbtn} ${preview ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05]'}`}><Icon name="eye" className="w-3.5 h-3.5" />Preview</button>
        {editing.public_enabled && <a href={publicUrl(editing.slug)} target="_blank" rel="noreferrer" className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}>Ver ao vivo</a>}
        {mayEdit && <button onClick={onVault} disabled={vaulting} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05] disabled:opacity-50`}><Icon name="book" className="w-3.5 h-3.5" />{vaulting ? '…' : 'Cofre'}</button>}
        {editing.stripe_invoice_id ? (
          <a href={editing.stripe_invoice_url || '#'} target="_blank" rel="noreferrer" className={`${tbtn} bg-admin-sage/15 text-admin-sage`}>Fatura {editing.invoice_status === 'paid' ? '✓' : '↗'}</a>
        ) : mayEdit && ['accepted', 'signed'].includes(editing.status) && editing.quote_id && (
          <button onClick={onInvoice} disabled={invoicing} className={`${tbtn} bg-admin-champ/10 text-admin-champ disabled:opacity-50`}>{invoicing ? '…' : 'Fatura'}</button>
        )}
        {mayEdit && <button onClick={onSave} className={`${tbtn} ${dirty ? 'bg-admin-sage/20 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/60'}`}><Icon name="check" className="w-3.5 h-3.5" />Salvar</button>}
        {mayEdit && <button onClick={onPublish} className={`${tbtn} ${editing.public_enabled ? 'bg-admin-gold/15 text-admin-gold' : 'bg-admin-champ/20 text-admin-champ'}`}><Icon name="share" className="w-3.5 h-3.5" />{editing.public_enabled ? 'Publicado' : 'Publicar'}</button>}
      </div>

      {/* ---------- CORPO 3 COLUNAS ---------- */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[210px_1fr_290px] gap-3 overflow-hidden">

        {/* BIBLIOTECA */}
        <div className={`glass rounded-2xl p-3 overflow-y-auto ${preview ? 'hidden lg:block lg:opacity-40 lg:pointer-events-none' : 'hidden lg:block'}`}>
          <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2 px-1">Biblioteca</p>
          {Object.entries(grouped).map(([g, items]) => (
            <div key={g} className="mb-3">
              <p className="text-[9px] uppercase tracking-wider text-admin-muted/40 mb-1.5 px-1">{g}</p>
              <div className="space-y-1">
                {items.map((b) => (
                  <button key={b.type} onClick={() => addBlock(b.type)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-admin-muted/80 hover:text-admin-champ hover:bg-admin-champ/[0.08] transition-colors group">
                    <span className="w-7 h-7 rounded-lg bg-white/[0.04] group-hover:bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name={b.icon} className="w-3.5 h-3.5" /></span>
                    <span className="text-xs">{b.label}</span>
                    <Icon name="plus" className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <p className="text-[9px] uppercase tracking-wider text-admin-muted/40 mb-1.5 px-1">Em breve</p>
            <div className="flex flex-wrap gap-1 px-1">
              {SOON.map((s) => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] text-admin-muted/30">{s}</span>)}
            </div>
          </div>
        </div>

        {/* CANVAS — documento WYSIWYG */}
        <div className="rounded-2xl overflow-auto bg-[#0a0b0e] border border-white/[0.06] relative">
          <div className="min-h-full flex flex-col items-center py-8 px-4">
            <div style={{ width: 794 * zoom }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: 794 }}>
                <Paper theme={theme} blocks={blocks} data={mergeData} sel={preview ? null : sel} setSel={setSel}
                  onMove={move} onRemove={removeBlock} onDup={duplicate} preview={preview} />
              </div>
            </div>
            {blocks.length === 0 && <p className="text-admin-muted/30 text-sm mt-8">Documento vazio — adicione blocos pela Biblioteca.</p>}
          </div>
        </div>

        {/* INSPETOR */}
        <div className={`glass rounded-2xl p-4 overflow-y-auto ${preview ? 'hidden lg:block lg:opacity-40 lg:pointer-events-none' : 'hidden lg:block'}`}>
          {sel == null || !blocks[sel]
            ? <DocInspector editing={editing} theme={theme} onDocField={onDocField} notify={notify} />
            : <BlockInspector block={blocks[sel]} onChange={(p) => setBlock(sel, p)} onRemove={() => removeBlock(sel)} onDup={() => duplicate(sel)} />}
        </div>
      </div>
    </div>
  )
}

// ---------------- PAPER (documento renderizado) ----------------
function Paper({ theme, blocks, data, sel, setSel, onMove, onRemove, onDup, preview }) {
  const bg = { backgroundImage: `radial-gradient(70% 45% at 80% -5%, ${theme.accent}22, transparent 60%), linear-gradient(165deg, ${theme.bg1}, ${theme.bg2})`, color: theme.text }
  return (
    <div style={{ ...bg, minHeight: 1123, borderRadius: 6, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }} className="overflow-hidden">
      <div style={{ padding: '64px 64px 40px' }}>
        {blocks.map((b, i) => (
          <BlockShell key={i} i={i} selected={sel === i} onSelect={() => setSel(i)} preview={preview}
            onMove={onMove} onRemove={onRemove} onDup={onDup} last={i === blocks.length - 1}>
            <PaperBlock b={b} theme={theme} data={data} />
          </BlockShell>
        ))}
        {/* rodapé de aceite (como no público) */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24, marginTop: 32 }}>
          <p className="font-serif" style={{ fontSize: 22 }}>Aceitar proposta</p>
          <p style={{ opacity: 0.55, fontSize: 13, marginTop: 4 }}>Ao assinar, você concorda com os termos apresentados acima.</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 16px', marginTop: 12, opacity: 0.5, fontSize: 14 }}>Seu nome completo</div>
          <div style={{ background: theme.accent, color: theme.ink, borderRadius: 14, padding: '13px', textAlign: 'center', marginTop: 10, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>Assinar e aceitar</div>
        </div>
        <p style={{ textAlign: 'center', opacity: 0.2, fontSize: 10, marginTop: 24, letterSpacing: 2, textTransform: 'uppercase' }}>Seravie Document Studio</p>
      </div>
    </div>
  )
}

function BlockShell({ children, i, selected, onSelect, onMove, onRemove, onDup, preview, last }) {
  if (preview) return <div>{children}</div>
  return (
    <div onClick={(e) => { e.stopPropagation(); onSelect() }}
      className="relative group"
      style={{ outline: selected ? '2px solid #D6C49A' : '2px solid transparent', outlineOffset: 4, borderRadius: 6, cursor: 'pointer', transition: 'outline-color .15s' }}>
      {!selected && <div className="absolute inset-0 rounded pointer-events-none opacity-0 group-hover:opacity-100" style={{ outline: '1px dashed rgba(214,196,154,0.4)', outlineOffset: 4, borderRadius: 6 }} />}
      {selected && (
        <div className="absolute -top-3 right-0 flex items-center gap-0.5 z-10" style={{ transform: 'translateY(-100%)' }}>
          <button onClick={(e) => { e.stopPropagation(); onMove(i, -1) }} className="w-6 h-6 rounded-md bg-[#1b1c1f] border border-white/10 text-white/70 hover:text-admin-champ text-xs flex items-center justify-center">▲</button>
          <button onClick={(e) => { e.stopPropagation(); onMove(i, 1) }} className="w-6 h-6 rounded-md bg-[#1b1c1f] border border-white/10 text-white/70 hover:text-admin-champ text-xs flex items-center justify-center">▼</button>
          <button onClick={(e) => { e.stopPropagation(); onDup(i) }} className="w-6 h-6 rounded-md bg-[#1b1c1f] border border-white/10 text-white/70 hover:text-admin-champ text-xs flex items-center justify-center" title="Duplicar"><Icon name="copy" className="w-3 h-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(i) }} className="w-6 h-6 rounded-md bg-[#1b1c1f] border border-white/10 text-white/70 hover:text-admin-rose text-xs flex items-center justify-center">✕</button>
        </div>
      )}
      {children}
    </div>
  )
}

// bloco renderizado no papel — espelha DocumentView (público)
function PaperBlock({ b, theme, data }) {
  const t = b.type
  if (t === 'cover') return (
    <div style={{ textAlign: 'center', marginBottom: 40, padding: '40px 0' }}>
      {b.logo_url && <img src={b.logo_url} alt="" style={{ height: 48, margin: '0 auto 32px', objectFit: 'contain' }} />}
      {b.eyebrow && <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: theme.accent }}>{merge(b.eyebrow, data)}</p>}
      <h1 className="font-serif" style={{ fontSize: 40, lineHeight: 1.1 }}>{merge(b.title, data) || 'Proposta Comercial'}</h1>
      {b.subtitle && <p style={{ opacity: 0.6, marginTop: 12 }}>{merge(b.subtitle, data)}</p>}
      {b.image_url && <img src={b.image_url} alt="" style={{ width: '100%', height: 224, objectFit: 'cover', marginTop: 32, borderRadius: 16 }} />}
    </div>
  )
  if (t === 'heading') return <h2 className="font-serif" style={{ fontSize: 26, marginTop: 32, marginBottom: 12 }}>{merge(b.text, data) || 'Título da seção'}</h2>
  if (t === 'text') return <p style={{ opacity: 0.75, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{merge(b.text, data) || 'Parágrafo de texto…'}</p>
  if (t === 'callout') return (
    <div style={{ borderLeft: `3px solid ${theme.accent}`, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px', margin: '16px 0' }}>
      {b.title && <p style={{ color: theme.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{merge(b.title, data)}</p>}
      <p style={{ opacity: 0.85, lineHeight: 1.6 }}>{merge(b.text, data) || 'Texto de destaque…'}</p>
    </div>
  )
  if (t === 'divider') return <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '24px 0' }} />
  if (t === 'image') return b.url ? <img src={b.url} alt="" style={{ width: '100%', objectFit: 'cover', margin: '24px 0', borderRadius: 16 }} /> : <div style={{ height: 160, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: 13, margin: '24px 0' }}>Imagem</div>
  if (t === 'quote_table') {
    const items = data.items || []
    return (
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 20, margin: '24px 0' }}>
        {b.title && <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, color: theme.accent }}>{b.title}</p>}
        {items.length === 0 && <p style={{ opacity: 0.4, fontSize: 13 }}>Itens do orçamento vinculado aparecem aqui.</p>}
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ opacity: 0.8 }}>{it.qty}× {it.name}</span><span style={{ opacity: 0.9 }}>{brl(it.total)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="font-serif" style={{ fontSize: 18 }}>Total</span>
          <span className="font-serif" style={{ fontSize: 24, color: theme.accent }}>{brl(data.total)}</span>
        </div>
      </div>
    )
  }
  if (t === 'terms') return (
    <div style={{ margin: '24px 0', opacity: 0.7, fontSize: 14 }}>
      <h3 className="font-serif" style={{ fontSize: 20, marginBottom: 8, color: theme.accent }}>{b.title || 'Termos'}</h3>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{merge(b.text, data) || 'Validade da proposta, formas de pagamento e condições.'}</p>
    </div>
  )
  if (t === 'signature_line') return (
    <div style={{ display: 'flex', gap: 40, margin: '32px 0 8px' }}>
      {[b.left_label || 'Contratante', b.right_label || 'Contratada'].map((lbl, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)', marginTop: 40, paddingTop: 8, fontSize: 12, opacity: 0.6 }}>{lbl}</div>
        </div>
      ))}
    </div>
  )
  return null
}

// ---------------- INSPETORES ----------------
const insInput = 'w-full rounded-xl px-3 py-2 text-sm outline-none bg-white/[0.05] border border-white/[0.1] text-admin-text'
function Field({ label, value, onChange, area, placeholder }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label>
      {area
        ? <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={placeholder} className={`${insInput} resize-none`} />
        : <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={insInput} />}
    </div>
  )
}

function BlockInspector({ block: b, onChange, onRemove, onDup }) {
  const set = (patch) => onChange(patch)
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-wider text-admin-champ/70">{LABEL[b.type] || b.type}</p>
        <div className="flex gap-1">
          <button onClick={onDup} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-champ flex items-center justify-center"><Icon name="copy" className="w-3 h-3" /></button>
          <button onClick={onRemove} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose flex items-center justify-center"><Icon name="trash" className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="space-y-3">
        {b.type === 'cover' && <>
          <Field label="Selo (acima do título)" value={b.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="Proposta Comercial" />
          <Field label="Título" value={b.title} onChange={(v) => set({ title: v })} placeholder="{{title}}" />
          <Field label="Subtítulo" value={b.subtitle} onChange={(v) => set({ subtitle: v })} placeholder="Preparado para {{client}}" />
          <FlowImageField label="Logo" value={b.logo_url || ''} onChange={(url) => set({ logo_url: url })} folder="documents" />
          <FlowImageField label="Imagem de capa" value={b.image_url || ''} onChange={(url) => set({ image_url: url })} folder="documents" />
        </>}
        {b.type === 'heading' && <Field label="Título da seção" value={b.text} onChange={(v) => set({ text: v })} />}
        {b.type === 'text' && <Field label="Parágrafo" value={b.text} onChange={(v) => set({ text: v })} area />}
        {b.type === 'callout' && <>
          <Field label="Título (opcional)" value={b.title} onChange={(v) => set({ title: v })} />
          <Field label="Texto do destaque" value={b.text} onChange={(v) => set({ text: v })} area />
        </>}
        {b.type === 'divider' && <p className="text-admin-muted/40 text-xs">Uma linha divisória. Sem propriedades.</p>}
        {b.type === 'image' && <FlowImageField label="Imagem" value={b.url || ''} onChange={(url) => set({ url })} folder="documents" />}
        {b.type === 'quote_table' && <>
          <Field label="Título da tabela" value={b.title} onChange={(v) => set({ title: v })} placeholder="Investimento" />
          <p className="text-admin-muted/40 text-xs">Os itens e o total vêm do orçamento vinculado automaticamente.</p>
        </>}
        {b.type === 'terms' && <>
          <Field label="Título" value={b.title} onChange={(v) => set({ title: v })} />
          <Field label="Texto dos termos" value={b.text} onChange={(v) => set({ text: v })} area />
        </>}
        {b.type === 'signature_line' && <>
          <Field label="Rótulo esquerdo" value={b.left_label} onChange={(v) => set({ left_label: v })} placeholder="Contratante" />
          <Field label="Rótulo direito" value={b.right_label} onChange={(v) => set({ right_label: v })} placeholder="Contratada" />
        </>}
      </div>
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-1.5">Variáveis</p>
        <div className="flex flex-wrap gap-1">
          {['title', 'client'].map((v) => <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-admin-champ/10 text-admin-champ">{`{{${v}}}`}</code>)}
        </div>
      </div>
    </div>
  )
}

const THEME_PRESETS = [
  { name: 'Onyx & Champagne', bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A' },
  { name: 'Marinho & Ouro', bg1: '#0f1826', bg2: '#080d16', accent: '#C9A85F' },
  { name: 'Vinho & Rosé', bg1: '#1e0f14', bg2: '#120a0c', accent: '#C98BA0' },
  { name: 'Sálvia & Névoa', bg1: '#121a16', bg2: '#0a0f0c', accent: '#9DB39B' },
  { name: 'Grafite & Cobre', bg1: '#17140f', bg2: '#0c0a08', accent: '#C1835B' },
]
function DocInspector({ editing, theme, onDocField, notify }) {
  const setTheme = (patch) => onDocField?.({ theme: { ...(editing.theme || {}), ...patch } })
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-4">Documento</p>
      <div className="space-y-3">
        <Field label="Título do documento" value={editing.title} onChange={(v) => onDocField?.({ title: v })} />
        <Field label="Cliente" value={editing.data?.client} onChange={(v) => onDocField?.({ data: { ...(editing.data || {}), client: v } })} placeholder="Nome do cliente" />
      </div>
      <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mt-5 mb-2">Tema visual</p>
      <div className="space-y-1.5">
        {THEME_PRESETS.map((p) => {
          const active = (editing.theme?.accent || theme.accent) === p.accent
          return (
            <button key={p.name} onClick={() => setTheme({ bg1: p.bg1, bg2: p.bg2, accent: p.accent })} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors ${active ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'border-white/[0.06] hover:bg-white/[0.03]'}`}>
              <span className="flex -space-x-1">
                <span className="w-4 h-4 rounded-full border border-black/30" style={{ background: p.bg1 }} />
                <span className="w-4 h-4 rounded-full border border-black/30" style={{ background: p.accent }} />
              </span>
              <span className="text-xs text-admin-text/80">{p.name}</span>
              {active && <Icon name="check" className="w-3.5 h-3.5 text-admin-champ ml-auto" />}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mt-5 mb-2">Cor de destaque</p>
      <div className="flex items-center gap-2">
        <input type="color" value={editing.theme?.accent || theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} className="w-10 h-9 rounded-lg bg-transparent cursor-pointer" />
        <input value={editing.theme?.accent || theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} className={`${insInput} w-28`} />
      </div>
      <p className="text-admin-muted/30 text-[11px] mt-5 leading-relaxed">Clique num bloco do documento para editar o conteúdo dele aqui. Use a Biblioteca à esquerda para adicionar novos blocos.</p>
    </div>
  )
}

function newBlock(type) {
  if (type === 'cover') return { type, eyebrow: 'Proposta Comercial', title: '{{title}}', subtitle: 'Preparado para {{client}}' }
  if (type === 'heading') return { type, text: 'Nova seção' }
  if (type === 'text') return { type, text: 'Escreva aqui o conteúdo do parágrafo.' }
  if (type === 'callout') return { type, title: 'Destaque', text: 'Ponto importante que merece atenção.' }
  if (type === 'quote_table') return { type, title: 'Investimento' }
  if (type === 'terms') return { type, title: 'Termos', text: 'Validade da proposta, formas de pagamento e condições.' }
  if (type === 'signature_line') return { type, left_label: 'Contratante', right_label: 'Contratada' }
  return { type }
}
