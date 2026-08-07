import { useState, useRef, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'
import { FlowImageField } from './FlowImageField'

// Seravie Document Studio — editor em três colunas (Biblioteca · Documento · Inspetor).
// Canvas WYSIWYG + toolbar premium, zoom, undo/redo, preview, templates, marca, IA,
// blocos inteligentes, versões e comentários.

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const DEFAULT_THEME = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ink: '#0b0a08' }
const merge = (s, data) => typeof s === 'string' ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => (data?.[k] ?? '')) : s
const qrSrc = (content) => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(content || 'https://seravieexperiences.com')}`

// cálculo da tabela financeira inteligente
function priceCalc(b) {
  const rows = Array.isArray(b.rows) ? b.rows : []
  const subtotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit) || 0), 0)
  const disc = subtotal * ((Number(b.discount_pct) || 0) / 100)
  const taxable = subtotal - disc
  const tax = taxable * ((Number(b.tax_pct) || 0) / 100)
  const total = taxable + tax
  return { subtotal, disc, tax, total }
}

const BLOCKS = [
  { type: 'cover', label: 'Capa', icon: 'image', group: 'Estrutura' },
  { type: 'heading', label: 'Título de seção', icon: 'tag', group: 'Estrutura' },
  { type: 'text', label: 'Parágrafo', icon: 'book', group: 'Texto' },
  { type: 'callout', label: 'Destaque', icon: 'star', group: 'Texto' },
  { type: 'divider', label: 'Divisória', icon: 'grip', group: 'Texto' },
  { type: 'image', label: 'Imagem', icon: 'image', group: 'Mídia' },
  { type: 'gallery', label: 'Galeria', icon: 'image', group: 'Mídia' },
  { type: 'quote_table', label: 'Tabela do orçamento', icon: 'chart', group: 'Comercial' },
  { type: 'pricing_table', label: 'Tabela financeira', icon: 'chart', group: 'Comercial' },
  { type: 'kpi', label: 'Indicadores (KPIs)', icon: 'chart', group: 'Comercial' },
  { type: 'terms', label: 'Termos & condições', icon: 'check', group: 'Comercial' },
  { type: 'signature_line', label: 'Campo de assinatura', icon: 'pen', group: 'Comercial' },
  { type: 'timeline', label: 'Timeline / Cronograma', icon: 'calendar', group: 'Avançado' },
  { type: 'qr', label: 'QR / PIX', icon: 'grid', group: 'Avançado' },
]
const SOON = ['Gráfico', 'Mapa', 'Checklist', 'Depoimentos', 'Equipe']
const LABEL = Object.fromEntries(BLOCKS.map((b) => [b.type, b.label]))

// ---------------- TEMPLATES ----------------
const TEMPLATES = [
  { key: 'proposta', name: 'Proposta Comercial', desc: 'Capa, sobre, escopo, investimento e termos', blocks: () => [
    { type: 'cover', eyebrow: 'Proposta Comercial', title: '{{title}}', subtitle: 'Preparado para {{client}}' },
    { type: 'heading', text: 'Quem somos' }, { type: 'text', text: 'Apresente sua empresa e o valor que entrega.' },
    { type: 'heading', text: 'Escopo & solução' }, { type: 'text', text: 'Descreva o que será entregue.' },
    { type: 'callout', title: 'Diferencial', text: 'Por que escolher a sua empresa.' },
    { type: 'quote_table', title: 'Investimento' },
    { type: 'terms', title: 'Termos', text: 'Validade, pagamento e condições.' },
  ] },
  { key: 'contrato', name: 'Contrato', desc: 'Cláusulas, condições e assinaturas', blocks: () => [
    { type: 'cover', eyebrow: 'Contrato', title: '{{title}}', subtitle: 'Entre as partes' },
    { type: 'heading', text: 'Objeto' }, { type: 'text', text: 'Descrição do objeto do contrato.' },
    { type: 'heading', text: 'Obrigações' }, { type: 'text', text: 'Obrigações das partes.' },
    { type: 'heading', text: 'Prazo e valores' }, { type: 'text', text: 'Vigência, valores e forma de pagamento.' },
    { type: 'terms', title: 'Cláusulas gerais', text: 'Foro, rescisão e demais condições.' },
    { type: 'signature_line', left_label: 'Contratante', right_label: 'Contratada' },
  ] },
  { key: 'nda', name: 'NDA (Confidencialidade)', desc: 'Acordo de sigilo', blocks: () => [
    { type: 'cover', eyebrow: 'Acordo de Confidencialidade', title: '{{title}}', subtitle: 'NDA' },
    { type: 'heading', text: 'Informações confidenciais' }, { type: 'text', text: 'Definição do que é confidencial.' },
    { type: 'heading', text: 'Obrigações de sigilo' }, { type: 'text', text: 'Compromissos das partes.' },
    { type: 'terms', title: 'Vigência e penalidades', text: 'Prazo do sigilo e consequências do descumprimento.' },
    { type: 'signature_line', left_label: 'Parte reveladora', right_label: 'Parte receptora' },
  ] },
  { key: 'orcamento', name: 'Orçamento', desc: 'Direto ao ponto, com valores', blocks: () => [
    { type: 'cover', eyebrow: 'Orçamento', title: '{{title}}', subtitle: 'Para {{client}}' },
    { type: 'text', text: 'Resumo do que está sendo orçado.' },
    { type: 'pricing_table', title: 'Itens do orçamento', rows: [{ desc: 'Serviço / produto', qty: 1, unit: 0 }], discount_pct: 0, tax_pct: 0 },
    { type: 'terms', title: 'Condições', text: 'Validade e forma de pagamento.' },
  ] },
  { key: 'relatorio', name: 'Relatório', desc: 'Indicadores e análise', blocks: () => [
    { type: 'cover', eyebrow: 'Relatório', title: '{{title}}', subtitle: 'Período' },
    { type: 'kpi', stats: [{ value: '0', label: 'Métrica 1' }, { value: '0', label: 'Métrica 2' }, { value: '0', label: 'Métrica 3' }] },
    { type: 'heading', text: 'Análise' }, { type: 'text', text: 'Leitura dos resultados.' },
    { type: 'heading', text: 'Próximos passos' }, { type: 'text', text: 'Recomendações.' },
  ] },
]

export function DocStudioEditor({
  editing, blocks, onChange, data, sel, setSel, dirty, mayEdit,
  onSave, onPublish, onVault, onInvoice, onDocField, onBack, publicUrl,
  invoicing, vaulting, notify,
}) {
  const [zoom, setZoom] = useState(0.85)
  const [preview, setPreview] = useState(false)
  const [modal, setModal] = useState(null) // 'templates' | 'ai' | 'versions' | 'comments'
  const hist = useRef({ past: [], future: [] })
  const [, force] = useState(0)

  const theme = useMemo(() => ({ ...DEFAULT_THEME, ...(editing?.theme || {}) }), [editing])
  const mergeData = useMemo(() => ({ ...(data || {}), title: editing?.title }), [data, editing])

  const commit = (next) => { hist.current.past.push(blocks); hist.current.future = []; onChange(next); force((x) => x + 1) }
  const setBlock = (i, patch) => commit(blocks.map((b, j) => j === i ? { ...b, ...patch } : b))
  const addBlock = (type) => { const nb = [...blocks, newBlock(type)]; commit(nb); setSel(nb.length - 1) }
  const removeBlock = (i) => { commit(blocks.filter((_, j) => j !== i)); setSel(null) }
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= blocks.length) return; const xs = [...blocks];[xs[i], xs[j]] = [xs[j], xs[i]]; commit(xs); setSel(j) }
  const moveTo = (from, to) => { if (from === to || to < 0 || to >= blocks.length) return; const xs = [...blocks]; const [it] = xs.splice(from, 1); xs.splice(to, 0, it); commit(xs); setSel(to) }
  const duplicate = (i) => { const xs = [...blocks]; xs.splice(i + 1, 0, { ...blocks[i] }); commit(xs); setSel(i + 1) }
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.unshift(blocks); onChange(h.past.pop()); setSel(null); force((x) => x + 1) }
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(blocks); onChange(h.future.shift()); setSel(null); force((x) => x + 1) }
  const applyBlocks = (nb) => { commit(nb); setSel(null) }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })

  const grouped = useMemo(() => { const g = {}; BLOCKS.forEach((b) => { (g[b.group] = g[b.group] || []).push(b) }); return g }, [])

  const tbtn = 'h-8 px-2.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors'
  return (
    <div className="flex flex-col h-[calc(100vh-150px)] min-h-[560px] -mx-1">
      {/* ---------- TOOLBAR ---------- */}
      <div className="flex items-center gap-1.5 px-2 py-2 glass rounded-2xl mb-3 flex-wrap">
        <button onClick={onBack} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="x" className="w-3.5 h-3.5" />Fechar</button>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        <button onClick={undo} disabled={!hist.current.past.length} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05] disabled:opacity-30`} title="Desfazer"><span className="text-base leading-none">↶</span></button>
        <button onClick={redo} disabled={!hist.current.future.length} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05] disabled:opacity-30`} title="Refazer"><span className="text-base leading-none">↷</span></button>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05]`}>−</button>
        <span className="text-[11px] text-admin-muted/60 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} className={`${tbtn} text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.05]`}>+</button>
        <button onClick={() => setZoom(0.85)} className={`${tbtn} text-admin-muted/60 hover:text-admin-champ hover:bg-white/[0.05]`}>Ajustar</button>
        <div className="w-px h-6 bg-white/10 mx-0.5" />
        {mayEdit && <button onClick={() => setModal('templates')} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="grid" className="w-3.5 h-3.5" />Templates</button>}
        {mayEdit && <button onClick={() => setModal('ai')} className={`${tbtn} text-admin-champ hover:bg-admin-champ/10`}><Icon name="spark" className="w-3.5 h-3.5" />IA</button>}

        <div className="mx-auto" />
        <button onClick={() => setModal('comments')} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="mail" className="w-3.5 h-3.5" />Comentários</button>
        <button onClick={() => setModal('versions')} className={`${tbtn} text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05]`}><Icon name="clock" className="w-3.5 h-3.5" />Versões</button>
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
        <div className={`glass rounded-2xl p-3 overflow-y-auto hidden lg:block ${preview ? 'opacity-40 pointer-events-none' : ''}`}>
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
            <div className="flex flex-wrap gap-1 px-1">{SOON.map((s) => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] text-admin-muted/30">{s}</span>)}</div>
          </div>
        </div>

        {/* CANVAS */}
        <div className="rounded-2xl overflow-auto bg-[#0a0b0e] border border-white/[0.06] relative">
          <div className="min-h-full flex flex-col items-center py-8 px-4">
            <div style={{ width: 794 * zoom }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: 794 }}>
                <Paper theme={theme} blocks={blocks} data={mergeData} sel={preview ? null : sel} setSel={setSel}
                  onMove={move} onMoveTo={moveTo} onRemove={removeBlock} onDup={duplicate} preview={preview} />
              </div>
            </div>
            {blocks.length === 0 && <p className="text-admin-muted/30 text-sm mt-8">Documento vazio — adicione blocos, escolha um template ou peça à IA.</p>}
          </div>
        </div>

        {/* INSPETOR */}
        <div className={`glass rounded-2xl p-4 overflow-y-auto hidden lg:block ${preview ? 'opacity-40 pointer-events-none' : ''}`}>
          {sel == null || !blocks[sel]
            ? <DocInspector editing={editing} theme={theme} onDocField={onDocField} onApplyBrand={applyBrand(editing, onDocField, blocks, applyBlocks, notify)} />
            : <BlockInspector block={blocks[sel]} onChange={(p) => setBlock(sel, p)} onRemove={() => removeBlock(sel)} onDup={() => duplicate(sel)} />}
        </div>
      </div>

      {modal === 'templates' && <TemplatesModal onClose={() => setModal(null)} onPick={(t) => { applyBlocks(t.blocks()); setModal(null); notify?.('Template aplicado', 'success') }} />}
      {modal === 'ai' && <AIModal editing={editing} onClose={() => setModal(null)} onApply={(nb) => { applyBlocks(nb); setModal(null) }} notify={notify} />}
      {modal === 'versions' && <VersionsModal editing={editing} blocks={blocks} onClose={() => setModal(null)} onRestore={(v) => { applyBlocks(v.blocks || []); onDocField?.({ theme: v.theme || editing.theme }); setModal(null); notify?.('Versão restaurada', 'success') }} notify={notify} />}
      {modal === 'comments' && <CommentsModal editing={editing} sel={sel} onClose={() => setModal(null)} notify={notify} />}
    </div>
  )
}

// aplica a marca do tenant (cor + logo na capa)
function applyBrand(editing, onDocField, blocks, applyBlocks, notify) {
  return async () => {
    const { data: b } = await supabase.from('document_branding').select('*').eq('tenant_id', editing.tenant_id).maybeSingle()
    if (!b || !b.enabled) return notify?.('Ative a marca própria na aba "Marca dos documentos" primeiro.', 'info')
    if (b.brand_color) onDocField?.({ theme: { ...(editing.theme || {}), accent: b.brand_color } })
    if (b.logo_url) {
      const idx = blocks.findIndex((x) => x.type === 'cover')
      if (idx >= 0) { const nb = blocks.map((x, j) => j === idx ? { ...x, logo_url: b.logo_url } : x); applyBlocks(nb) }
    }
    notify?.('Marca aplicada ao documento', 'success')
  }
}

// ---------------- PAPER ----------------
function Paper({ theme, blocks, data, sel, setSel, onMove, onMoveTo, onRemove, onDup, preview }) {
  const bg = { backgroundImage: `radial-gradient(70% 45% at 80% -5%, ${theme.accent}22, transparent 60%), linear-gradient(165deg, ${theme.bg1}, ${theme.bg2})`, color: theme.text }
  const [drag, setDrag] = useState(null)
  return (
    <div style={{ ...bg, minHeight: 1123, borderRadius: 6, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }} className="overflow-hidden">
      <div style={{ padding: '64px 64px 40px' }}>
        {blocks.map((b, i) => (
          <BlockShell key={i} i={i} selected={sel === i} onSelect={() => setSel(i)} preview={preview}
            onMove={onMove} onRemove={onRemove} onDup={onDup} drag={drag} setDrag={setDrag} onMoveTo={onMoveTo}>
            <PaperBlock b={b} theme={theme} data={data} />
          </BlockShell>
        ))}
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

function BlockShell({ children, i, selected, onSelect, onMove, onRemove, onDup, preview, drag, setDrag, onMoveTo }) {
  if (preview) return <div>{children}</div>
  const isDragging = drag === i
  return (
    <div
      draggable
      onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (drag != null && drag !== i) onMoveTo(drag, i); setDrag(null) }}
      onDragEnd={() => setDrag(null)}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      className="relative group"
      style={{ outline: selected ? '2px solid #D6C49A' : '2px solid transparent', outlineOffset: 4, borderRadius: 6, cursor: 'pointer', opacity: isDragging ? 0.4 : 1, transition: 'outline-color .15s' }}>
      {!selected && <div className="absolute inset-0 rounded pointer-events-none opacity-0 group-hover:opacity-100" style={{ outline: '1px dashed rgba(214,196,154,0.4)', outlineOffset: 4, borderRadius: 6 }} />}
      {selected && (
        <div className="absolute -top-3 right-0 flex items-center gap-0.5 z-10" style={{ transform: 'translateY(-100%)' }}>
          <span className="w-6 h-6 rounded-md bg-[#1b1c1f] border border-white/10 text-white/40 text-xs flex items-center justify-center cursor-grab" title="Arraste para mover">⠿</span>
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
  if (t === 'gallery') {
    const imgs = (b.images || []).filter(Boolean)
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '24px 0' }}>
      {imgs.length ? imgs.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10 }} />)
        : [0, 1, 2].map((i) => <div key={i} style={{ height: 110, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)' }} />)}
    </div>
  }
  if (t === 'kpi') {
    const stats = b.stats || []
    return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, stats.length || 3))},1fr)`, gap: 12, margin: '24px 0' }}>
      {(stats.length ? stats : [{ value: '0', label: 'Indicador' }]).map((s, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <p className="font-serif" style={{ fontSize: 28, color: theme.accent }}>{s.value}</p>
          <p style={{ fontSize: 11, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{s.label}</p>
        </div>
      ))}
    </div>
  }
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
  if (t === 'pricing_table') {
    const c = priceCalc(b); const rows = b.rows || []
    return (
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 20, margin: '24px 0' }}>
        {b.title && <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, color: theme.accent }}>{b.title}</p>}
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ opacity: 0.8 }}>{(Number(r.qty) || 0)}× {r.desc || 'Item'}</span>
            <span style={{ opacity: 0.9 }}>{brl((Number(r.qty) || 0) * (Number(r.unit) || 0))}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
          <Row l="Subtotal" v={brl(c.subtotal)} />
          {(Number(b.discount_pct) || 0) > 0 && <Row l={`Desconto (${b.discount_pct}%)`} v={`− ${brl(c.disc)}`} />}
          {(Number(b.tax_pct) || 0) > 0 && <Row l={`Impostos (${b.tax_pct}%)`} v={brl(c.tax)} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="font-serif" style={{ fontSize: 18 }}>Total</span>
          <span className="font-serif" style={{ fontSize: 24, color: theme.accent }}>{brl(c.total)}</span>
        </div>
      </div>
    )
  }
  if (t === 'timeline') {
    const items = b.items || []
    return (
      <div style={{ margin: '24px 0' }}>
        {b.title && <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, color: theme.accent }}>{b.title}</p>}
        {(items.length ? items : [{ when: 'Etapa', label: 'Descreva a etapa' }]).map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.accent, marginTop: 4 }} />
              {i < items.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.15)', marginTop: 4 }} />}
            </div>
            <div>
              {it.when && <p style={{ fontSize: 11, color: theme.accent, opacity: 0.8 }}>{it.when}</p>}
              <p style={{ fontSize: 15 }}>{it.label}</p>
              {it.desc && <p style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>{it.desc}</p>}
            </div>
          </div>
        ))}
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
  if (t === 'qr') return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', margin: '24px 0', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20 }}>
      <img src={qrSrc(b.content)} alt="QR" style={{ width: 120, height: 120, borderRadius: 10, background: '#fff', padding: 6 }} />
      <div>
        {b.title && <p style={{ color: theme.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{b.title}</p>}
        <p style={{ fontSize: 14, opacity: 0.8 }}>{b.caption || 'Aponte a câmera para pagar ou acessar.'}</p>
        {b.content && <p style={{ fontSize: 11, opacity: 0.4, marginTop: 6, wordBreak: 'break-all', maxWidth: 340 }}>{b.content}</p>}
      </div>
    </div>
  )
  if (t === 'scenarios') {
    const scs = data.scenarios || []
    return (
      <div style={{ margin: '32px 0' }}>
        {b.title && <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: theme.accent, textAlign: 'center', marginBottom: 12 }}>{b.title}</p>}
        {scs.length === 0 ? <p style={{ opacity: 0.4, fontSize: 13, textAlign: 'center' }}>Cenários do orçamento aparecem aqui (Econômico / Premium / Signature).</p>
          : <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, scs.length)},1fr)`, gap: 14 }}>
              {scs.map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 18 }}>
                  <p style={{ color: theme.accent, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{s.name}</p>
                  <p className="font-serif" style={{ fontSize: 26 }}>{brl(s.total)}</p>
                  <div style={{ marginTop: 8 }}>{(s.items || []).slice(0, 6).map((it, j) => <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.65, padding: '2px 0' }}><span>{it.qty}× {it.name}</span><span>{brl(it.total)}</span></div>)}</div>
                </div>
              ))}
            </div>}
      </div>
    )
  }
  return null
}
const Row = ({ l, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>{l}</span><span>{v}</span></div>

// ---------------- INSPETORES ----------------
const insInput = 'w-full rounded-xl px-3 py-2 text-sm outline-none bg-white/[0.05] border border-white/[0.1] text-admin-text'
function Field({ label, value, onChange, area, placeholder, type }) {
  return (
    <div>
      {label && <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label>}
      {area
        ? <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={placeholder} className={`${insInput} resize-none`} />
        : <input type={type || 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={insInput} />}
    </div>
  )
}
// editor de lista genérico (linhas de objetos)
function ListEditor({ items, onChange, fields, addLabel, blank }) {
  const list = Array.isArray(items) ? items : []
  const setItem = (i, patch) => onChange(list.map((x, j) => j === i ? { ...x, ...patch } : x))
  const add = () => onChange([...list, { ...blank }])
  const rm = (i) => onChange(list.filter((_, j) => j !== i))
  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div key={i} className="glass-soft rounded-xl p-2 space-y-1.5">
          <div className="flex items-center justify-between"><span className="text-[10px] text-admin-muted/40">#{i + 1}</span><button onClick={() => rm(i)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3 h-3" /></button></div>
          {fields.map((f) => <input key={f.key} value={it[f.key] ?? ''} onChange={(e) => setItem(i, { [f.key]: e.target.value })} placeholder={f.placeholder} className={`${insInput} text-xs py-1.5`} />)}
        </div>
      ))}
      <button onClick={add} className="w-full text-[11px] py-2 rounded-lg bg-admin-champ/10 text-admin-champ hover:bg-admin-champ/20 flex items-center justify-center gap-1"><Icon name="plus" className="w-3 h-3" />{addLabel}</button>
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
        {b.type === 'callout' && <><Field label="Título (opcional)" value={b.title} onChange={(v) => set({ title: v })} /><Field label="Texto do destaque" value={b.text} onChange={(v) => set({ text: v })} area /></>}
        {b.type === 'divider' && <p className="text-admin-muted/40 text-xs">Uma linha divisória. Sem propriedades.</p>}
        {b.type === 'image' && <FlowImageField label="Imagem" value={b.url || ''} onChange={(url) => set({ url })} folder="documents" />}
        {b.type === 'gallery' && <>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Imagens</label>
          {(b.images || []).map((u, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input value={u} onChange={(e) => set({ images: (b.images || []).map((x, j) => j === i ? e.target.value : x) })} placeholder="URL da imagem" className={`${insInput} text-xs py-1.5`} />
              <button onClick={() => set({ images: (b.images || []).filter((_, j) => j !== i) })} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => set({ images: [...(b.images || []), ''] })} className="w-full text-[11px] py-2 rounded-lg bg-admin-champ/10 text-admin-champ hover:bg-admin-champ/20 flex items-center justify-center gap-1"><Icon name="plus" className="w-3 h-3" />Adicionar imagem</button>
        </>}
        {b.type === 'kpi' && <>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Indicadores</label>
          <ListEditor items={b.stats} onChange={(v) => set({ stats: v })} addLabel="Adicionar indicador" blank={{ value: '', label: '' }} fields={[{ key: 'value', placeholder: 'Valor (ex.: 98%)' }, { key: 'label', placeholder: 'Rótulo' }]} />
        </>}
        {b.type === 'quote_table' && <><Field label="Título da tabela" value={b.title} onChange={(v) => set({ title: v })} placeholder="Investimento" /><p className="text-admin-muted/40 text-xs">Itens e total vêm do orçamento vinculado.</p></>}
        {b.type === 'pricing_table' && <>
          <Field label="Título" value={b.title} onChange={(v) => set({ title: v })} placeholder="Investimento" />
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Itens</label>
          <ListEditor items={b.rows} onChange={(v) => set({ rows: v })} addLabel="Adicionar item" blank={{ desc: '', qty: 1, unit: 0 }} fields={[{ key: 'desc', placeholder: 'Descrição' }, { key: 'qty', placeholder: 'Qtd' }, { key: 'unit', placeholder: 'Valor unitário' }]} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Desconto %" type="number" value={b.discount_pct} onChange={(v) => set({ discount_pct: v })} />
            <Field label="Impostos %" type="number" value={b.tax_pct} onChange={(v) => set({ tax_pct: v })} />
          </div>
          <p className="text-admin-sage/70 text-xs">Total calculado automaticamente: {brl(priceCalc(b).total)}</p>
        </>}
        {b.type === 'timeline' && <>
          <Field label="Título" value={b.title} onChange={(v) => set({ title: v })} placeholder="Cronograma" />
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Etapas</label>
          <ListEditor items={b.items} onChange={(v) => set({ items: v })} addLabel="Adicionar etapa" blank={{ when: '', label: '', desc: '' }} fields={[{ key: 'when', placeholder: 'Quando (ex.: Semana 1)' }, { key: 'label', placeholder: 'Etapa' }, { key: 'desc', placeholder: 'Descrição (opcional)' }]} />
        </>}
        {b.type === 'terms' && <><Field label="Título" value={b.title} onChange={(v) => set({ title: v })} /><Field label="Texto dos termos" value={b.text} onChange={(v) => set({ text: v })} area /></>}
        {b.type === 'signature_line' && <><Field label="Rótulo esquerdo" value={b.left_label} onChange={(v) => set({ left_label: v })} placeholder="Contratante" /><Field label="Rótulo direito" value={b.right_label} onChange={(v) => set({ right_label: v })} placeholder="Contratada" /></>}
        {b.type === 'qr' && <>
          <Field label="Título" value={b.title} onChange={(v) => set({ title: v })} placeholder="Pague com PIX" />
          <Field label="Conteúdo (URL ou PIX copia-e-cola)" value={b.content} onChange={(v) => set({ content: v })} area placeholder="Cole aqui o código PIX ou uma URL" />
          <Field label="Legenda" value={b.caption} onChange={(v) => set({ caption: v })} placeholder="Aponte a câmera para pagar" />
        </>}
      </div>
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-1.5">Variáveis</p>
        <div className="flex flex-wrap gap-1">{['title', 'client'].map((v) => <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-admin-champ/10 text-admin-champ">{`{{${v}}}`}</code>)}</div>
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
function DocInspector({ editing, theme, onDocField, onApplyBrand }) {
  const setTheme = (patch) => onDocField?.({ theme: { ...(editing.theme || {}), ...patch } })
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-4">Documento</p>
      <div className="space-y-3">
        <Field label="Título do documento" value={editing.title} onChange={(v) => onDocField?.({ title: v })} />
        <Field label="Cliente" value={editing.data?.client} onChange={(v) => onDocField?.({ data: { ...(editing.data || {}), client: v } })} placeholder="Nome do cliente" />
      </div>
      <button onClick={onApplyBrand} className="w-full mt-4 text-xs py-2 rounded-xl bg-admin-champ/10 text-admin-champ hover:bg-admin-champ/20 flex items-center justify-center gap-1.5"><Icon name="star" className="w-3.5 h-3.5" />Aplicar minha marca</button>
      <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mt-5 mb-2">Tema visual</p>
      <div className="space-y-1.5">
        {THEME_PRESETS.map((p) => {
          const active = (editing.theme?.accent || theme.accent) === p.accent
          return (
            <button key={p.name} onClick={() => setTheme({ bg1: p.bg1, bg2: p.bg2, accent: p.accent })} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors ${active ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'border-white/[0.06] hover:bg-white/[0.03]'}`}>
              <span className="flex -space-x-1"><span className="w-4 h-4 rounded-full border border-black/30" style={{ background: p.bg1 }} /><span className="w-4 h-4 rounded-full border border-black/30" style={{ background: p.accent }} /></span>
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
      <p className="text-admin-muted/30 text-[11px] mt-5 leading-relaxed">Clique num bloco do documento para editar o conteúdo. Arraste blocos para reordenar.</p>
    </div>
  )
}

// ---------------- MODAIS ----------------
function Shell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`glass-pop rounded-2xl p-7 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}

function TemplatesModal({ onClose, onPick }) {
  return (
    <Shell title="Templates" onClose={onClose} wide>
      <p className="text-admin-muted/50 text-sm mb-4">Escolha um ponto de partida. Substitui o conteúdo atual do documento.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => onPick(t)} className="glass-soft rounded-2xl p-4 text-left hover:bg-white/[0.05] transition-colors group">
            <div className="flex items-center gap-2 mb-1"><Icon name="grid" className="w-4 h-4 text-admin-champ/70" /><p className="text-admin-text text-sm font-medium">{t.name}</p></div>
            <p className="text-admin-muted/50 text-xs">{t.desc}</p>
          </button>
        ))}
      </div>
    </Shell>
  )
}

function AIModal({ editing, onClose, onApply, notify }) {
  const [company, setCompany] = useState('')
  const [segment, setSegment] = useState('')
  const [objective, setObjective] = useState('')
  const [busy, setBusy] = useState(false)
  const gen = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('doc-ai', { body: { company, segment, objective, client: editing.data?.client } })
      setBusy(false)
      if (error || !data?.ok) return notify?.('Não consegui gerar agora. Tente de novo.', 'error')
      onApply(data.blocks || [])
      notify?.(data.source === 'fallback' ? 'Documento gerado (modelo base — conecte uma IA para textos mais ricos).' : 'Documento gerado pela IA', 'success')
    } catch { setBusy(false); notify?.('Falha ao gerar.', 'error') }
  }
  return (
    <Shell title="Gerar com IA" onClose={onClose}>
      <p className="text-admin-muted/50 text-sm mb-4">Descreva o contexto e a IA monta o documento inteiro. Você ajusta depois.</p>
      <div className="space-y-3">
        <Field label="Sua empresa" value={company} onChange={setCompany} placeholder="Ex.: Estúdio Aurora Arquitetura" />
        <Field label="Segmento / serviço" value={segment} onChange={setSegment} placeholder="Ex.: projetos residenciais de alto padrão" />
        <Field label="Objetivo da proposta" value={objective} onChange={setObjective} placeholder="Ex.: reforma completa de apartamento de 180m²" area />
      </div>
      <button onClick={gen} disabled={busy} className="w-full mt-5 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"><Icon name="spark" className="w-4 h-4" />{busy ? 'Gerando…' : 'Gerar documento'}</button>
    </Shell>
  )
}

function VersionsModal({ editing, blocks, onClose, onRestore, notify }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const { data } = await supabase.from('doc_versions').select('*').eq('document_id', editing.id).order('created_at', { ascending: false }).limit(50); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const snapshot = async () => {
    const { error } = await supabase.from('doc_versions').insert({ document_id: editing.id, blocks, theme: editing.theme || {}, title: editing.title, label: 'Manual' })
    if (error) return notify?.('Erro ao salvar versão', 'error')
    notify?.('Versão salva', 'success'); load()
  }
  return (
    <Shell title="Histórico de versões" onClose={onClose}>
      <button onClick={snapshot} className="w-full mb-4 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"><Icon name="plus" className="w-4 h-4" />Salvar versão atual</button>
      {loading ? <p className="text-admin-muted/40 text-sm py-8 text-center">Carregando…</p>
        : rows.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhuma versão salva ainda.</p>
        : <div className="space-y-2">
            {rows.map((v) => (
              <div key={v.id} className="glass-soft rounded-xl px-4 py-3 flex items-center justify-between">
                <div><p className="text-admin-text text-sm">{v.title || 'Documento'} <span className="text-admin-muted/40 text-xs">· {(v.blocks || []).length} blocos</span></p><p className="text-admin-muted/40 text-xs">{new Date(v.created_at).toLocaleString('pt-BR')} · {v.label || 'auto'}</p></div>
                <button onClick={() => onRestore(v)} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-sage/15 text-admin-sage hover:bg-admin-sage/25">Restaurar</button>
              </div>
            ))}
          </div>}
    </Shell>
  )
}

function CommentsModal({ editing, sel, onClose, notify }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [body, setBody] = useState('')
  const load = async () => { setLoading(true); const { data } = await supabase.from('doc_comments').select('*').eq('document_id', editing.id).order('created_at', { ascending: false }); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!body.trim()) return
    const { error } = await supabase.from('doc_comments').insert({ document_id: editing.id, block_index: sel, body: body.trim() })
    if (error) return notify?.('Erro ao comentar', 'error')
    setBody(''); load()
  }
  const toggle = async (c) => { await supabase.from('doc_comments').update({ resolved: !c.resolved }).eq('id', c.id); load() }
  const del = async (c) => { await supabase.from('doc_comments').delete().eq('id', c.id); load() }
  return (
    <Shell title="Comentários" onClose={onClose}>
      <div className="flex gap-2 mb-4">
        <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={sel != null ? `Comentar no bloco #${sel + 1}…` : 'Comentar no documento…'} className={insInput} />
        <button onClick={add} className="bg-admin-champ/15 text-admin-champ px-4 rounded-xl text-sm shrink-0">Enviar</button>
      </div>
      {loading ? <p className="text-admin-muted/40 text-sm py-6 text-center">Carregando…</p>
        : rows.length === 0 ? <p className="text-admin-muted/40 text-sm py-6 text-center">Nenhum comentário ainda.</p>
        : <div className="space-y-2">
            {rows.map((c) => (
              <div key={c.id} className={`glass-soft rounded-xl px-3 py-2.5 ${c.resolved ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-admin-text text-sm flex-1">{c.body}</p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggle(c)} className="text-admin-muted/50 hover:text-admin-sage" title={c.resolved ? 'Reabrir' : 'Resolver'}><Icon name="check" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(c)} className="text-admin-muted/50 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-admin-muted/40 text-[10px] mt-1">{c.block_index != null ? `Bloco #${c.block_index + 1} · ` : ''}{new Date(c.created_at).toLocaleString('pt-BR')}{c.resolved ? ' · resolvido' : ''}</p>
              </div>
            ))}
          </div>}
    </Shell>
  )
}

function newBlock(type) {
  if (type === 'cover') return { type, eyebrow: 'Proposta Comercial', title: '{{title}}', subtitle: 'Preparado para {{client}}' }
  if (type === 'heading') return { type, text: 'Nova seção' }
  if (type === 'text') return { type, text: 'Escreva aqui o conteúdo do parágrafo.' }
  if (type === 'callout') return { type, title: 'Destaque', text: 'Ponto importante que merece atenção.' }
  if (type === 'quote_table') return { type, title: 'Investimento' }
  if (type === 'pricing_table') return { type, title: 'Investimento', rows: [{ desc: 'Serviço / produto', qty: 1, unit: 0 }], discount_pct: 0, tax_pct: 0 }
  if (type === 'kpi') return { type, stats: [{ value: '100%', label: 'Satisfação' }, { value: '24h', label: 'Suporte' }, { value: '+50', label: 'Projetos' }] }
  if (type === 'gallery') return { type, images: [] }
  if (type === 'timeline') return { type, title: 'Cronograma', items: [{ when: 'Semana 1', label: 'Início', desc: '' }, { when: 'Semana 2', label: 'Desenvolvimento', desc: '' }] }
  if (type === 'terms') return { type, title: 'Termos', text: 'Validade da proposta, formas de pagamento e condições.' }
  if (type === 'signature_line') return { type, left_label: 'Contratante', right_label: 'Contratada' }
  if (type === 'qr') return { type, title: 'Pague com PIX', content: '', caption: 'Aponte a câmera para pagar.' }
  return { type }
}
