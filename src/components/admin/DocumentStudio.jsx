import { useState, useEffect } from 'react'
import { supabase, SUPABASE_URL } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { FlowImageField } from './FlowImageField'
import { logAudit } from '../../lib/audit'
import { ResourceTabs } from './ResourcePanel'
import { DocumentVault } from './DocumentVault'
import { SignaturePanel } from './SignaturePanel'
import { DocumentBranding } from './DocumentBranding'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS = { draft: ['Rascunho', 'bg-admin-gold/10 text-admin-gold'], sent: ['Enviado', 'bg-admin-champ/10 text-admin-champ'], viewed: ['Visto', 'bg-admin-champ/10 text-admin-champ'], accepted: ['Aceito', 'bg-admin-sage/10 text-admin-sage'], signed: ['Assinado', 'bg-admin-sage/15 text-admin-sage'], rejected: ['Recusado', 'bg-admin-rose/10 text-admin-rose'] }
const BLOCK_LIB = [
  { type: 'cover', label: 'Capa' },
  { type: 'heading', label: 'Título de seção' },
  { type: 'text', label: 'Parágrafo' },
  { type: 'image', label: 'Imagem' },
  { type: 'quote_table', label: 'Tabela de valores (do orçamento)' },
  { type: 'terms', label: 'Termos & condições' },
]
const publicUrl = (slug) => `${window.location.origin}/p/${slug}`
const slugify = (s) => (s || 'proposta').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 7)

// blocos padrão de uma proposta comercial
const defaultBlocks = () => [
  { type: 'cover', eyebrow: 'Proposta Comercial', title: '{{title}}', subtitle: 'Preparado para {{client}}' },
  { type: 'heading', text: 'Quem somos' },
  { type: 'text', text: 'Apresente aqui a sua empresa e o valor que entrega.' },
  { type: 'heading', text: 'Escopo & solução' },
  { type: 'text', text: 'Descreva o que será entregue ao cliente.' },
  { type: 'quote_table', title: 'Investimento' },
  { type: 'terms', title: 'Termos', text: 'Validade da proposta, formas de pagamento e condições.' },
]

function ProposalsStudio({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [sel, setSel] = useState(null)
  const [creating, setCreating] = useState(false)
  const [quotes, setQuotes] = useState([])
  const [dirty, setDirty] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('documents').select('*, contact:contacts(name)').order('created_at', { ascending: false }).limit(200); setDocs(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const open = (d) => { setEditing(d); setBlocks(Array.isArray(d.blocks) ? d.blocks : []); setSel(null); setDirty(false) }

  const openNew = async () => {
    setCreating(true)
    const { data } = await supabase.from('quotes').select('id, number, title, total, contact_id, deal_id, contact:contacts(name)').in('status', ['draft', 'sent', 'accepted']).order('created_at', { ascending: false }).limit(100)
    setQuotes(data || [])
  }

  const createDoc = async (quote) => {
    let data = {}
    if (quote) {
      const { data: qi } = await supabase.from('quote_items').select('name, qty, total').eq('quote_id', quote.id).order('sort_order')
      data = { title: quote.title, client: quote.contact?.name || 'Cliente', items: qi || [], total: quote.total }
    }
    const title = quote ? quote.title : 'Nova proposta'
    const payload = {
      tenant_id: tenantId, title, type: 'proposal', slug: slugify(title), status: 'draft',
      blocks: defaultBlocks(), theme: {}, data,
      quote_id: quote?.id || null, deal_id: quote?.deal_id || null, contact_id: quote?.contact_id || null, created_by: profile?.user_id,
    }
    const { data: doc, error } = await supabase.from('documents').insert(payload).select('*, contact:contacts(name)').single()
    if (error) return notify('Erro ao criar: ' + error.message, 'error')
    setCreating(false); load(); open(doc); notify('Proposta criada', 'success')
  }

  const save = async () => {
    await supabase.from('documents').update({ blocks, updated_at: new Date().toISOString() }).eq('id', editing.id)
    logAudit({ action: 'update', resource_type: 'documents', resource_id: editing.id, new_data: { blocks: blocks.length } }, tenantId)
    setDirty(false); notify('Proposta salva', 'success')
  }
  const setField = async (patch) => { await supabase.from('documents').update(patch).eq('id', editing.id); setEditing((d) => ({ ...d, ...patch })); load() }

  const publish = async () => {
    const enable = !editing.public_enabled
    await setField({ public_enabled: enable, status: enable && editing.status === 'draft' ? 'sent' : editing.status })
    if (enable) { navigator.clipboard?.writeText(publicUrl(editing.slug)); notify('Publicado! Link copiado.', 'success') }
    else notify('Link desativado', 'success')
  }

  const [invoicing, setInvoicing] = useState(false)
  const issueInvoice = async () => {
    setInvoicing(true)
    const { data, error } = await supabase.functions.invoke('document-invoice', { body: { document_id: editing.id } })
    setInvoicing(false)
    if (error || data?.error) {
      const msg = { stripe_not_configured: 'Configure o Stripe na plataforma primeiro.', connect_required: 'Conecte a conta Stripe (Recebimentos) antes de faturar.', contact_email_required: 'O contato precisa ter e-mail.', invalid_amount: 'Vincule um orçamento com valor.', invoice_exists: 'Este documento já tem uma fatura emitida.' }[data?.error] || data?.detail || 'Erro ao emitir fatura'
      return notify(msg, data?.error === 'invoice_exists' ? 'info' : 'error')
    }
    await setField({ stripe_invoice_id: data.invoice_id, stripe_invoice_url: data.hosted_invoice_url, invoice_status: data.status })
    notify('Fatura emitida e enviada ao cliente', 'success')
  }

  const [vaulting, setVaulting] = useState(false)
  const saveToVault = async () => {
    setVaulting(true)
    const link = publicUrl(editing.slug)
    // procura categoria "Propostas" (cria se não existir) para organizar
    let catId = null
    const { data: existingCat } = await supabase.from('doc_categories').select('id').ilike('name', 'Propostas').limit(1).maybeSingle()
    if (existingCat) catId = existingCat.id
    else { const { data: nc } = await supabase.from('doc_categories').insert({ name: 'Propostas', color: 'sage', icon: 'book' }).select('id').single(); catId = nc?.id || null }
    // evita duplicar: se já existe entrada dessa proposta, atualiza
    const { data: existing } = await supabase.from('vault_documents').select('id').eq('source', 'proposal').contains('tags', [editing.id]).limit(1).maybeSingle()
    const payload = {
      title: editing.title || 'Proposta', description: `Proposta viva · ${link}`,
      category_id: catId, source: 'proposal', file_name: (editing.title || 'proposta') + ' (link)', file_ext: 'link',
      file_type: 'text/uri-list', storage_path: null, doc_date: new Date().toISOString().slice(0, 10),
      tags: [editing.id, 'proposta'],
    }
    let error
    if (existing) { const r = await supabase.from('vault_documents').update(payload).eq('id', existing.id); error = r.error }
    else { const r = await supabase.from('vault_documents').insert(payload); error = r.error }
    setVaulting(false)
    if (error) return notify('Erro ao guardar no cofre: ' + error.message, 'error')
    notify(existing ? 'Proposta atualizada no cofre' : 'Proposta guardada no cofre', 'success')
  }

  const setBlock = (i, patch) => { setBlocks((xs) => xs.map((b, j) => j === i ? { ...b, ...patch } : b)); setDirty(true) }
  const addBlock = (type) => { setBlocks((xs) => [...xs, { type, ...(type === 'cover' ? { title: '{{title}}' } : {}) }]); setDirty(true) }
  const removeBlock = (i) => { setBlocks((xs) => xs.filter((_, j) => j !== i)); setSel(null); setDirty(true) }
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= blocks.length) return; const xs = [...blocks];[xs[i], xs[j]] = [xs[j], xs[i]]; setBlocks(xs); setDirty(true) }

  const StatusBadge = ({ s }) => { const x = STATUS[s] || STATUS.draft; return <span className={`text-[9px] px-2 py-0.5 rounded-lg ${x[1]}`}>{x[0]}</span> }

  // ---- LISTA ----
  if (!editing) return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="font-serif text-2xl text-admin-text">Propostas & Contratos</h2><p className="text-admin-muted/60 text-sm mt-1">documentos premium — em PDF e página web viva com assinatura</p></div>
        {mayEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Nova proposta</button>}
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p> : docs.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="book" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhuma proposta ainda.</p><p className="text-admin-muted/30 text-xs mt-1">Gere uma a partir de um orçamento — os valores entram automaticamente.</p></div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <button key={d.id} onClick={() => open(d)} className="w-full glass rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-admin-text text-sm font-medium truncate">{d.title}</p><StatusBadge s={d.status} />{d.public_enabled && <span className="text-[9px] text-admin-sage">● no ar</span>}</div><p className="text-admin-muted/40 text-xs mt-0.5">{d.contact?.name || 'Sem cliente'}{d.signer_name ? ` · assinado por ${d.signer_name}` : ''}</p></div>
              {d.data?.total > 0 && <span className="text-admin-gold text-sm shrink-0">{brl(d.data.total)}</span>}
            </button>
          ))}
        </div>
      )}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Nova proposta</h2><button onClick={() => setCreating(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <button onClick={() => createDoc(null)} className="w-full glass-soft rounded-xl px-4 py-3 text-left hover:bg-white/[0.04] mb-3"><p className="text-admin-text text-sm">Em branco</p><p className="text-admin-muted/40 text-xs">Modelo de proposta padrão</p></button>
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-2">A partir de um orçamento</p>
            {quotes.length === 0 ? <p className="text-admin-muted/40 text-xs">Nenhum orçamento disponível.</p> : (
              <div className="space-y-1.5">{quotes.map((q) => (
                <button key={q.id} onClick={() => createDoc(q)} className="w-full glass-soft rounded-xl px-4 py-2.5 text-left hover:bg-white/[0.04]"><div className="flex justify-between"><p className="text-admin-text text-sm truncate">{q.title}</p><span className="text-admin-gold text-xs shrink-0">{brl(q.total)}</span></div><p className="text-admin-muted/40 text-[10px]">{q.number} · {q.contact?.name || 'sem cliente'}</p></button>
              ))}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ---- EDITOR ----
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3"><button onClick={() => { setEditing(null); load() }} className="text-[11px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-champ">← Propostas</button><StatusBadge s={editing.status} /></div>
        <div className="flex items-center gap-2">
          {editing.public_enabled && <a href={publicUrl(editing.slug)} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Ver ao vivo</a>}
          {editing.stripe_invoice_id ? (
            <a href={editing.stripe_invoice_url || '#'} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-xl bg-admin-sage/15 text-admin-sage">Fatura {editing.invoice_status === 'paid' ? 'paga ✓' : 'emitida'}</a>
          ) : mayEdit && ['accepted', 'signed'].includes(editing.status) && editing.quote_id && (
            <button onClick={issueInvoice} disabled={invoicing} className="text-xs px-4 py-2 rounded-xl bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 disabled:opacity-50">{invoicing ? 'Emitindo…' : 'Emitir fatura'}</button>
          )}
          {mayEdit && <button onClick={saveToVault} disabled={vaulting} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ disabled:opacity-50">{vaulting ? 'Guardando…' : 'Guardar no cofre'}</button>}
          {mayEdit && dirty && <button onClick={save} className="text-xs px-4 py-2 rounded-xl bg-admin-sage/15 text-admin-sage hover:bg-admin-sage/25">Salvar</button>}
          {mayEdit && <button onClick={publish} className={`text-xs px-4 py-2 rounded-xl ${editing.public_enabled ? 'bg-admin-gold/15 text-admin-gold' : 'bg-admin-champ/15 text-admin-champ'}`}>{editing.public_enabled ? 'Despublicar' : 'Publicar link'}</button>}
        </div>
      </div>

      {editing.public_enabled && <div className="glass-soft rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2"><Icon name="link" className="w-4 h-4 text-admin-champ/70" /><code className="text-admin-text/80 text-xs break-all flex-1">{publicUrl(editing.slug)}</code><button onClick={() => { navigator.clipboard?.writeText(publicUrl(editing.slug)); notify('Link copiado', 'success') }} className="text-[10px] px-2 py-1 rounded-lg bg-admin-champ/15 text-admin-champ shrink-0">copiar</button></div>}

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        {/* blocos */}
        <div className="glass rounded-2xl p-4 h-fit">
          <div className="flex items-center justify-between mb-3"><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Blocos ({blocks.length})</p></div>
          <div className="space-y-1.5 mb-4">
            {blocks.map((b, i) => (
              <div key={i} onClick={() => setSel(i)} className={`rounded-lg border p-2 cursor-pointer transition-colors ${sel === i ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'border-white/[0.06] hover:bg-white/[0.03]'}`}>
                <div className="flex items-center gap-1.5"><span className="text-admin-text text-xs truncate flex-1">{BLOCK_LIB.find((x) => x.type === b.type)?.label || b.type}</span>
                  <button onClick={(e) => { e.stopPropagation(); move(i, -1) }} className="text-admin-muted/40 hover:text-admin-champ text-[10px]">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); move(i, 1) }} className="text-admin-muted/40 hover:text-admin-champ text-[10px]">▼</button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(i) }} className="text-admin-muted/40 hover:text-admin-rose text-[10px]">✕</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-1.5">Adicionar</p>
          <div className="grid grid-cols-2 gap-1.5">{BLOCK_LIB.map((b) => <button key={b.type} onClick={() => addBlock(b.type)} className="text-[10px] px-2 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/70 hover:text-admin-champ hover:bg-admin-champ/10 text-left">{b.label}</button>)}</div>
        </div>

        {/* editor do bloco */}
        <div className="glass rounded-2xl p-5">
          {sel == null ? <p className="text-admin-muted/30 text-sm text-center py-16">Selecione um bloco para editar.<br /><span className="text-xs">Variáveis: <code className="text-admin-champ">{'{{title}}'}</code>, <code className="text-admin-champ">{'{{client}}'}</code></span></p> : (() => {
            const b = blocks[sel]; const set = (p) => setBlock(sel, p)
            const F = ({ k, label, area }) => area
              ? <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label><textarea value={b[k] || ''} onChange={(e) => set({ [k]: e.target.value })} rows={4} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
              : <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label><input value={b[k] || ''} onChange={(e) => set({ [k]: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            return (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-admin-champ/70">{BLOCK_LIB.find((x) => x.type === b.type)?.label}</p>
                {b.type === 'cover' && <><F k="eyebrow" label="Selo (acima do título)" /><F k="title" label="Título" /><F k="subtitle" label="Subtítulo" /><FlowImageField label="Logo" value={b.logo_url || ''} onChange={(url) => set({ logo_url: url })} folder="documents" /><FlowImageField label="Imagem de capa" value={b.image_url || ''} onChange={(url) => set({ image_url: url })} folder="documents" /></>}
                {b.type === 'heading' && <F k="text" label="Título da seção" />}
                {b.type === 'text' && <F k="text" label="Parágrafo" area />}
                {b.type === 'image' && <FlowImageField label="Imagem" value={b.url || ''} onChange={(url) => set({ url })} folder="documents" />}
                {b.type === 'quote_table' && <><F k="title" label="Título da tabela" /><p className="text-admin-muted/40 text-xs">Os itens e o total vêm do orçamento vinculado automaticamente.</p></>}
                {b.type === 'terms' && <><F k="title" label="Título" /><F k="text" label="Texto dos termos" area /></>}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// Document Studio = Propostas & Contratos + Cofre de Documentos (em abas).
export function DocumentStudio({ notify }) {
  return (
    <ResourceTabs title="Seravie Document Studio" subtitle="propostas, contratos e o cofre de documentos da empresa"
      tabs={[
        { key: 'proposals', label: 'Propostas & Contratos', render: () => <ProposalsStudio notify={notify} /> },
        { key: 'signatures', label: 'Assinaturas', render: () => <SignaturePanel notify={notify} /> },
        { key: 'vault', label: 'Cofre de Documentos', render: () => <DocumentVault notify={notify} /> },
        { key: 'branding', label: 'Marca dos documentos', render: () => <DocumentBranding notify={notify} /> },
      ]}
    />
  )
}
