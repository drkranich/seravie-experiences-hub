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
import { DocStudioEditor } from './DocStudioEditor'

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
  const [confirmDel, setConfirmDel] = useState(null)

  // baixar a proposta como HTML autocontido (abre para imprimir/salvar em PDF)
  const downloadDoc = (d) => {
    const t = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ...(d.theme || {}) }
    const dd = d.data || {}
    const mg = (s) => typeof s === 'string' ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'title' ? d.title : dd[k]) ?? '') : s
    const money = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    const bl = (b) => {
      if (b.type === 'cover') return `<div style="text-align:center;padding:40px 0">${b.logo_url ? `<img src="${b.logo_url}" style="height:48px;margin-bottom:24px"/>` : ''}${b.eyebrow ? `<p style="letter-spacing:3px;text-transform:uppercase;font-size:12px;color:${t.accent}">${esc(mg(b.eyebrow))}</p>` : ''}<h1 style="font-family:Georgia,serif;font-size:40px">${esc(mg(b.title)) || 'Proposta'}</h1>${b.subtitle ? `<p style="opacity:.6">${esc(mg(b.subtitle))}</p>` : ''}</div>`
      if (b.type === 'heading') return `<h2 style="font-family:Georgia,serif;font-size:26px;margin:28px 0 10px">${esc(mg(b.text))}</h2>`
      if (b.type === 'text') return `<p style="opacity:.78;line-height:1.7;white-space:pre-wrap;margin:0 0 14px">${esc(mg(b.text))}</p>`
      if (b.type === 'callout') return `<div style="border-left:3px solid ${t.accent};background:rgba(255,255,255,.05);border-radius:12px;padding:16px 20px;margin:16px 0">${b.title ? `<p style="color:${t.accent};text-transform:uppercase;font-size:12px">${esc(mg(b.title))}</p>` : ''}<p style="opacity:.85">${esc(mg(b.text))}</p></div>`
      if (b.type === 'divider') return `<hr style="border:none;border-top:1px solid rgba(255,255,255,.12);margin:24px 0"/>`
      if (b.type === 'terms') return `<div style="margin:24px 0;opacity:.75"><h3 style="font-family:Georgia,serif;color:${t.accent};font-size:20px">${esc(b.title || 'Termos')}</h3><p style="white-space:pre-wrap;line-height:1.6">${esc(mg(b.text))}</p></div>`
      if (b.type === 'signature_line') return `<div style="display:flex;gap:40px;margin:32px 0"><div style="flex:1;text-align:center;border-top:1px solid rgba(255,255,255,.4);margin-top:48px;padding-top:8px;font-size:12px;opacity:.6">${esc(b.left_label || 'Contratante')}</div><div style="flex:1;text-align:center;border-top:1px solid rgba(255,255,255,.4);margin-top:48px;padding-top:8px;font-size:12px;opacity:.6">${esc(b.right_label || 'Contratada')}</div></div>`
      if (b.type === 'pricing_table') { const rows = b.rows || []; const st = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit) || 0), 0); const di = st * ((Number(b.discount_pct) || 0) / 100); const tx = (st - di) * ((Number(b.tax_pct) || 0) / 100); const tt = st - di + tx; return `<div style="background:rgba(255,255,255,.05);border-radius:16px;padding:20px;margin:24px 0">${b.title ? `<p style="color:${t.accent};text-transform:uppercase;font-size:11px;letter-spacing:2px">${esc(b.title)}</p>` : ''}${rows.map((r) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="opacity:.8">${Number(r.qty) || 0}× ${esc(r.desc || 'Item')}</span><span>${money((Number(r.qty) || 0) * (Number(r.unit) || 0))}</span></div>`).join('')}<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12)"><span style="font-family:Georgia,serif;font-size:18px">Total</span><span style="font-family:Georgia,serif;font-size:24px;color:${t.accent}">${money(tt)}</span></div></div>` }
      if (b.type === 'quote_table') { const items = dd.items || []; return `<div style="background:rgba(255,255,255,.05);border-radius:16px;padding:20px;margin:24px 0">${b.title ? `<p style="color:${t.accent};text-transform:uppercase;font-size:11px;letter-spacing:2px">${esc(b.title)}</p>` : ''}${items.map((it) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="opacity:.8">${it.qty}× ${esc(it.name)}</span><span>${money(it.total)}</span></div>`).join('')}<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12)"><span style="font-family:Georgia,serif;font-size:18px">Total</span><span style="font-family:Georgia,serif;font-size:24px;color:${t.accent}">${money(dd.total)}</span></div></div>` }
      if (b.type === 'image' && b.url) return `<img src="${b.url}" style="width:100%;border-radius:16px;margin:24px 0"/>`
      if (b.type === 'kpi') return `<div style="display:flex;gap:12px;margin:24px 0">${(b.stats || []).map((s) => `<div style="flex:1;background:rgba(255,255,255,.05);border-radius:14px;padding:16px;text-align:center"><p style="font-family:Georgia,serif;font-size:28px;color:${t.accent}">${esc(s.value)}</p><p style="font-size:11px;opacity:.55;text-transform:uppercase">${esc(s.label)}</p></div>`).join('')}</div>`
      if (b.type === 'timeline') return `<div style="margin:24px 0">${b.title ? `<p style="color:${t.accent};text-transform:uppercase;font-size:11px;letter-spacing:2px;margin-bottom:12px">${esc(b.title)}</p>` : ''}${(b.items || []).map((it) => `<div style="padding:6px 0 6px 16px;border-left:2px solid ${t.accent}80;margin-left:4px">${it.when ? `<p style="font-size:11px;color:${t.accent}">${esc(it.when)}</p>` : ''}<p>${esc(it.label)}</p>${it.desc ? `<p style="font-size:13px;opacity:.6">${esc(it.desc)}</p>` : ''}</div>`).join('')}</div>`
      return ''
    }
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.title || 'Documento')}</title><style>@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body style="margin:0;background:linear-gradient(165deg,${t.bg1},${t.bg2});color:${t.text};font-family:system-ui,Arial"><div style="max-width:720px;margin:0 auto;padding:56px 40px">${(Array.isArray(d.blocks) ? d.blocks : []).map(bl).join('')}<p style="text-align:center;opacity:.2;font-size:10px;margin-top:32px;letter-spacing:2px;text-transform:uppercase">Seravie Document Studio</p></div></body></html>`
    const w = window.open('', '_blank')
    if (!w) return notify('Permita pop-ups para baixar/imprimir.', 'error')
    w.document.write(html); w.document.close()
    notify('Documento aberto — use Imprimir → Salvar como PDF.', 'success')
  }
  const removeDoc = async (d) => {
    const { error } = await supabase.from('documents').delete().eq('id', d.id); setConfirmDel(null)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'documents', resource_id: d.id, old_data: { title: d.title } }, tenantId)
    notify('Proposta excluída', 'success'); load()
  }

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
    await supabase.from('documents').update({ blocks, title: editing.title, theme: editing.theme || {}, data: editing.data || {}, slug: editing.slug, updated_at: new Date().toISOString() }).eq('id', editing.id)
    logAudit({ action: 'update', resource_type: 'documents', resource_id: editing.id, new_data: { blocks: blocks.length } }, tenantId)
    // snapshot automático de versão (mantém as últimas 20)
    try {
      await supabase.from('doc_versions').insert({ document_id: editing.id, blocks, theme: editing.theme || {}, title: editing.title, label: 'auto' })
      const { data: old } = await supabase.from('doc_versions').select('id').eq('document_id', editing.id).order('created_at', { ascending: false }).range(20, 999)
      if (old && old.length) await supabase.from('doc_versions').delete().in('id', old.map((x) => x.id))
    } catch { /* não bloqueia o salvar */ }
    setDirty(false); notify('Proposta salva', 'success')
  }
  // edição local de campos do documento (título/tema/cliente) — persiste no Salvar
  const patchDoc = (patch) => { setEditing((d) => ({ ...d, ...patch })); setDirty(true) }
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
            <div key={d.id} className="w-full glass rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors group">
              <button onClick={() => open(d)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2"><p className="text-admin-text text-sm font-medium truncate">{d.title}</p><StatusBadge s={d.status} />{d.public_enabled && <span className="text-[9px] text-admin-sage">● no ar</span>}</div>
                <p className="text-admin-muted/40 text-xs mt-0.5">{d.contact?.name || 'Sem cliente'}{d.signer_name ? ` · assinado por ${d.signer_name}` : ''}</p>
              </button>
              {d.data?.total > 0 && <span className="text-admin-gold text-sm shrink-0">{brl(d.data.total)}</span>}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => downloadDoc(d)} title="Baixar / imprimir" className="p-2 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05]"><Icon name="download" className="w-4 h-4" /></button>
                {mayEdit && <button onClick={() => setConfirmDel(d)} title="Excluir" className="p-2 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05]"><Icon name="trash" className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir proposta</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover “{confirmDel.title}”? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3"><button onClick={() => removeDoc(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
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

  // ---- EDITOR (estúdio três colunas) ----
  return (
    <DocStudioEditor
      editing={editing}
      blocks={blocks}
      onChange={(nb) => { setBlocks(nb); setDirty(true) }}
      data={editing.data || {}}
      sel={sel} setSel={setSel}
      dirty={dirty} mayEdit={mayEdit}
      onSave={save} onPublish={publish} onVault={saveToVault} onInvoice={issueInvoice}
      onDocField={patchDoc} onBack={() => { setEditing(null); load() }}
      publicUrl={publicUrl} invoicing={invoicing} vaulting={vaulting} notify={notify}
    />
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
