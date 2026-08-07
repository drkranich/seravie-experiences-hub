import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { uploadToVault, vaultSignedUrl } from '../../lib/storage'
import { logAudit } from '../../lib/audit'

// Assinaturas — solicitações de assinatura eletrônica dentro do Document Studio.
// Cria a partir de upload, arquivo do cofre ou proposta; compartilha link; acompanha
// status/trilha; renderiza a assinatura; edita e exclui.
const ST = {
  draft: ['Rascunho', 'bg-admin-gold/10 text-admin-gold'],
  sent: ['Enviado', 'bg-admin-champ/10 text-admin-champ'],
  viewed: ['Visto', 'bg-admin-champ/10 text-admin-champ'],
  signed: ['Assinado', 'bg-admin-sage/10 text-admin-sage'],
  completed: ['Concluído', 'bg-admin-sage/15 text-admin-sage'],
  cancelled: ['Cancelado', 'bg-admin-rose/10 text-admin-rose'],
}
const SIGNER_ST = { pending: 'Pendente', viewed: 'Visualizou', signed: 'Assinou', declined: 'Recusou' }
const EV = { created: 'Criado', sent: 'Enviado', viewed: 'Visualizado', signed: 'Assinado', completed: 'Concluído', cancelled: 'Cancelado' }
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const fmtDT = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—'
const signLink = (token) => `${window.location.origin}/sign/${token}`

// dispara o convite de assinatura por e-mail (via provedor conectado do tenant).
// retorna { sent, skipped, failed } — nunca lança: o fluxo não trava sem e-mail.
async function sendInvites(reqTitle, message, signers) {
  const out = { sent: 0, skipped: 0, failed: 0, notConfigured: false }
  for (const sg of signers) {
    if (!sg.email || sg.status === 'signed') { out.skipped++; continue }
    const link = signLink(sg.token)
    const html = `<div style="font-family:system-ui,Arial;max-width:560px;margin:auto;padding:28px;background:#faf8f2;border-radius:16px">
      <p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#B89C61;margin:0 0 6px">Documento para assinatura</p>
      <h1 style="color:#1F3A5F;font-size:24px;margin:0 0 10px">${reqTitle}</h1>
      ${message ? `<p style="color:#444;font-size:15px">${message}</p>` : ''}
      <p style="color:#444;font-size:15px">Olá${sg.name ? ' ' + sg.name : ''}, você foi convidado(a) a assinar este documento eletronicamente.</p>
      <a href="${link}" style="display:inline-block;margin:16px 0;background:#B89C61;color:#1a1a1a;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600">Revisar e assinar</a>
      <p style="color:#888;font-size:12px;margin-top:18px">Ou copie o link: ${link}</p>
    </div>`
    try {
      const { data, error } = await supabase.functions.invoke('send-email', { body: { action: 'send', to: sg.email, subject: `Assinatura: ${reqTitle}`, html, text: `Assine o documento "${reqTitle}": ${link}` } })
      if (data?.error === 'not_configured') { out.notConfigured = true; out.skipped++ }
      else if (error || data?.error) out.failed++
      else out.sent++
    } catch { out.failed++ }
  }
  return out
}

export function SignaturePanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)   // solicitação aberta (detalhe)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('signature_requests').select('*, signers:signature_signers(*)').order('created_at', { ascending: false }).limit(300)
    setReqs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (open) return <RequestDetail req={open} tenantId={tenantId} mayEdit={mayEdit} notify={notify} onBack={() => { setOpen(null); load() }} />

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-admin-muted/50 text-sm">{reqs.length} solicitação(ões) de assinatura</p>
        {mayEdit && <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Enviar para assinatura</button>}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
        : reqs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Icon name="pen" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
            <p className="text-admin-muted/50 text-sm">Nenhuma solicitação de assinatura.</p>
            {mayEdit && <p className="text-admin-muted/30 text-xs mt-1">Envie um documento (upload, cofre ou proposta) para coletar assinaturas.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {reqs.map((r) => {
              const s = ST[r.status] || ST.draft
              const signers = r.signers || []
              const signed = signers.filter((x) => x.status === 'signed').length
              return (
                <button key={r.id} onClick={() => setOpen(r)} className="w-full glass rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left">
                  <div className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="pen" className="w-5 h-5 text-admin-champ/70" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-admin-text text-sm font-medium truncate">{r.title}</p><span className={`text-[9px] px-2 py-0.5 rounded-lg ${s[1]}`}>{s[0]}</span></div>
                    <p className="text-admin-muted/40 text-xs mt-0.5">{signers.length ? `${signed}/${signers.length} assinaram · ${signers.map((x) => x.name || x.email).filter(Boolean).slice(0, 3).join(', ')}` : 'Sem signatários'}</p>
                  </div>
                  <Icon name="eye" className="w-4 h-4 text-admin-muted/30 shrink-0" />
                </button>
              )
            })}
          </div>
        )}

      {creating && <CreateModal tenantId={tenantId} notify={notify} onClose={() => setCreating(false)} onDone={(r) => { setCreating(false); load(); setOpen(r) }} />}
    </div>
  )
}

// ---------- Criar solicitação ----------
function CreateModal({ tenantId, notify, onClose, onDone }) {
  const [source, setSource] = useState('upload')
  const [file, setFile] = useState(null)
  const [vaultDocs, setVaultDocs] = useState([])
  const [vaultId, setVaultId] = useState('')
  const [proposals, setProposals] = useState([])
  const [proposalId, setProposalId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [signers, setSigners] = useState([{ name: '', email: '' }])
  const [busy, setBusy] = useState(false)
  const inRef = useRef(null)

  useEffect(() => {
    (async () => {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from('vault_documents').select('id,title,storage_path,file_name,file_ext,file_type').not('storage_path', 'is', null).order('created_at', { ascending: false }).limit(200),
        supabase.from('documents').select('id,title,slug').order('created_at', { ascending: false }).limit(100),
      ])
      setVaultDocs(v || []); setProposals(p || [])
    })()
  }, [])

  const pick = (f) => { if (!f) return; setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')) }
  const setSigner = (i, patch) => setSigners((xs) => xs.map((s, j) => j === i ? { ...s, ...patch } : s))
  const addSigner = () => setSigners((xs) => [...xs, { name: '', email: '' }])
  const rmSigner = (i) => setSigners((xs) => xs.filter((_, j) => j !== i))

  const submit = async () => {
    if (!title.trim()) return notify?.('Dê um título', 'error')
    const validSigners = signers.filter((s) => s.name.trim() || s.email.trim())
    if (validSigners.length === 0) return notify?.('Adicione ao menos um signatário', 'error')
    setBusy(true)

    // monta o payload conforme a origem
    const payload = { title: title.trim(), message: message.trim() || null, source, notify_email: notifyEmail.trim() || null, app_origin: window.location.origin }
    if (source === 'upload') {
      if (!file) { setBusy(false); return notify?.('Selecione um arquivo', 'error') }
      const up = await uploadToVault(file, { folder: 'sign' })
      if (up.error) { setBusy(false); return notify?.('Erro no upload: ' + up.error, 'error') }
      payload.storage_path = up.path; payload.file_name = file.name; payload.file_type = file.type
      payload.file_ext = (file.name.split('.').pop() || '').toLowerCase()
    } else if (source === 'vault') {
      const d = vaultDocs.find((x) => x.id === vaultId)
      if (!d) { setBusy(false); return notify?.('Escolha um arquivo do cofre', 'error') }
      payload.vault_document_id = d.id; payload.storage_path = d.storage_path
      payload.file_name = d.file_name; payload.file_type = d.file_type; payload.file_ext = d.file_ext
    } else if (source === 'proposal') {
      const p = proposals.find((x) => x.id === proposalId)
      if (!p) { setBusy(false); return notify?.('Escolha uma proposta', 'error') }
      payload.document_id = p.id; payload.file_ext = 'proposal'; payload.file_name = p.title
    }

    const { data: req, error } = await supabase.from('signature_requests').insert(payload).select('*').single()
    if (error) { setBusy(false); return notify?.('Erro ao criar: ' + error.message, 'error') }

    const rows = validSigners.map((s, i) => ({ request_id: req.id, name: s.name.trim() || null, email: s.email.trim() || null, order_index: i }))
    const { data: insertedSigners } = await supabase.from('signature_signers').insert(rows).select('*')
    await supabase.from('signature_events').insert({ request_id: req.id, tenant_id: tenantId, event: 'created' })
    logAudit({ action: 'create', resource_type: 'signature_requests', resource_id: req.id, new_data: { title: payload.title } }, tenantId)

    // dispara convites por e-mail (se houver provedor conectado)
    const withEmail = (insertedSigners || []).filter((s) => s.email)
    if (withEmail.length) {
      const res = await sendInvites(payload.title, payload.message, insertedSigners || [])
      if (res.sent > 0) {
        await supabase.from('signature_requests').update({ status: 'sent' }).eq('id', req.id)
        await supabase.from('signature_events').insert({ request_id: req.id, tenant_id: tenantId, event: 'sent' })
        notify?.(`Solicitação criada — ${res.sent} convite(s) enviado(s) por e-mail`, 'success')
      } else if (res.notConfigured) {
        notify?.('Solicitação criada. Conecte um provedor de e-mail para enviar automático — por ora, copie os links.', 'info')
      } else {
        notify?.('Solicitação criada. Não consegui enviar por e-mail; copie os links.', 'info')
      }
    } else {
      notify?.('Solicitação criada. Compartilhe os links (signatários sem e-mail).', 'success')
    }

    const { data: full } = await supabase.from('signature_requests').select('*, signers:signature_signers(*)').eq('id', req.id).single()
    setBusy(false); onDone(full)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Enviar para assinatura</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Origem do documento</label>
        <div className="flex gap-1 mb-4 bg-white/[0.03] p-1 rounded-xl">
          {[['upload', 'Upload'], ['vault', 'Do cofre'], ['proposal', 'Proposta']].map(([k, l]) => (
            <button key={k} onClick={() => setSource(k)} className={`flex-1 px-3 py-1.5 rounded-lg text-sm ${source === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{l}</button>
          ))}
        </div>

        {source === 'upload' && (
          <div onClick={() => inRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
            className="border border-dashed border-white/15 rounded-xl p-5 text-center cursor-pointer hover:border-admin-champ/40 mb-4">
            <Icon name={file ? 'check' : 'plus'} className={`w-6 h-6 mx-auto mb-1.5 ${file ? 'text-admin-sage' : 'text-admin-champ/60'}`} />
            <p className="text-admin-text text-sm">{file ? file.name : 'Clique ou arraste o PDF/arquivo'}</p>
            <input ref={inRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        )}
        {source === 'vault' && (
          <div className="mb-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Arquivo do cofre</label>
            <GlassSelect value={vaultId} onChange={setVaultId} options={[{ value: '', label: '— selecione —' }, ...vaultDocs.map((d) => ({ value: d.id, label: `${d.title} (${d.file_name})` }))]} /></div>
        )}
        {source === 'proposal' && (
          <div className="mb-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Proposta / contrato</label>
            <GlassSelect value={proposalId} onChange={setProposalId} options={[{ value: '', label: '— selecione —' }, ...proposals.map((p) => ({ value: p.id, label: p.title }))]} /></div>
        )}

        <div className="space-y-3">
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Título *</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Mensagem ao signatário</label><input value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} placeholder="Ex.: Por favor, revise e assine." /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Avisar por e-mail quando concluir (opcional)</label><input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} className={inputCls} placeholder="seu@email.com" /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60">Signatários</label><button onClick={addSigner} className="text-[11px] text-admin-champ flex items-center gap-1"><Icon name="plus" className="w-3 h-3" />adicionar</button></div>
          <div className="space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input value={s.name} onChange={(e) => setSigner(i, { name: e.target.value })} placeholder="Nome" className={`${inputCls} flex-1`} />
                <input value={s.email} onChange={(e) => setSigner(i, { email: e.target.value })} placeholder="E-mail (opcional)" className={`${inputCls} flex-1`} />
                {signers.length > 1 && <button onClick={() => rmSigner(i)} className="text-admin-muted/50 hover:text-admin-rose px-2"><Icon name="trash" className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
          <p className="text-admin-muted/40 text-[11px] mt-2">Cada signatário recebe um link único para assinar (com ou sem conta).</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={submit} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm disabled:opacity-50">{busy ? 'Criando…' : 'Criar solicitação'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Detalhe da solicitação ----------
function RequestDetail({ req: initial, tenantId, mayEdit, notify, onBack }) {
  const [req, setReq] = useState(initial)
  const [events, setEvents] = useState([])
  const [fileUrl, setFileUrl] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(initial.title)

  const load = async () => {
    const [{ data: r }, { data: ev }] = await Promise.all([
      supabase.from('signature_requests').select('*, signers:signature_signers(*)').eq('id', initial.id).single(),
      supabase.from('signature_events').select('*').eq('request_id', initial.id).order('created_at', { ascending: true }),
    ])
    if (r) { setReq(r); setTitleVal(r.title) }
    setEvents(ev || [])
    if (r?.storage_path) { const { url } = await vaultSignedUrl(r.storage_path, 3600); setFileUrl(url || null) }
  }
  useEffect(() => { load() }, [])

  const signers = req.signers || []
  const s = ST[req.status] || ST.draft

  const copyLink = (token) => { navigator.clipboard?.writeText(signLink(token)); notify?.('Link copiado', 'success') }
  const [sending, setSending] = useState(false)
  const resendEmail = async () => {
    const pend = signers.filter((s) => s.email && s.status !== 'signed')
    if (pend.length === 0) return notify?.('Sem signatários pendentes com e-mail. Use "Copiar link".', 'info')
    setSending(true)
    const res = await sendInvites(req.title, req.message, signers)
    setSending(false)
    if (res.sent > 0) {
      await supabase.from('signature_requests').update({ status: req.status === 'draft' ? 'sent' : req.status, updated_at: new Date().toISOString() }).eq('id', req.id)
      await supabase.from('signature_events').insert({ request_id: req.id, tenant_id: tenantId, event: 'sent' })
      notify?.(`${res.sent} e-mail(s) enviado(s)`, 'success'); load()
    } else if (res.notConfigured) notify?.('Nenhum provedor de e-mail conectado. Copie os links manualmente.', 'info')
    else notify?.('Não consegui enviar. Verifique o provedor de e-mail.', 'error')
  }
  const cancel = async () => {
    await supabase.from('signature_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', req.id)
    await supabase.from('signature_events').insert({ request_id: req.id, tenant_id: tenantId, event: 'cancelled' })
    notify?.('Solicitação cancelada', 'info'); load()
  }
  const saveTitle = async () => {
    await supabase.from('signature_requests').update({ title: titleVal.trim() || req.title }).eq('id', req.id)
    setEditTitle(false); notify?.('Título atualizado', 'success'); load()
  }
  const remove = async () => {
    const { error } = await supabase.from('signature_requests').delete().eq('id', req.id)
    if (error) return notify?.('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'signature_requests', resource_id: req.id, old_data: { title: req.title } }, tenantId)
    notify?.('Solicitação excluída', 'success'); onBack()
  }

  const allSigned = signers.length > 0 && signers.every((x) => x.status === 'signed')

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[11px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-champ">← Assinaturas</button>
          <span className={`text-[9px] px-2 py-0.5 rounded-lg ${s[1]}`}>{s[0]}</span>
        </div>
        <div className="flex items-center gap-2">
          {req.verification_code && <a href={`${window.location.origin}/validar/${req.verification_code}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-xl bg-admin-sage/15 text-admin-sage flex items-center gap-1"><Icon name="check" className="w-3.5 h-3.5" />Comprovante</a>}
          {mayEdit && req.status !== 'cancelled' && req.status !== 'completed' && <button onClick={resendEmail} disabled={sending} className="text-xs px-3 py-2 rounded-xl bg-admin-champ/15 text-admin-champ disabled:opacity-50">{sending ? 'Enviando…' : 'Enviar por e-mail'}</button>}
          {mayEdit && req.status !== 'cancelled' && req.status !== 'completed' && <button onClick={cancel} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-rose">Cancelar</button>}
          {mayEdit && <button onClick={() => setConfirmDel(true)} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* coluna principal: documento + signatários */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editTitle ? (
                  <div className="flex gap-2"><input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} className={inputCls} /><button onClick={saveTitle} className="text-admin-sage text-sm px-2">✓</button></div>
                ) : (
                  <h1 className="font-serif text-2xl text-admin-text flex items-center gap-2">{req.title}{mayEdit && req.status === 'draft' && <button onClick={() => setEditTitle(true)} className="text-admin-muted/40 hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button>}</h1>
                )}
                {req.message && <p className="text-admin-muted/55 text-sm mt-1">{req.message}</p>}
                <p className="text-admin-muted/40 text-xs mt-1">{req.file_name || 'Documento'} · origem: {req.source}</p>
              </div>
            </div>
            {fileUrl && (
              <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                {(req.file_ext || '').toLowerCase() === 'pdf'
                  ? <iframe title="doc" src={fileUrl} className="w-full h-[420px] bg-white" />
                  : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes((req.file_ext || '').toLowerCase())
                    ? <img alt="doc" src={fileUrl} className="w-full block" />
                    : <a href={fileUrl} target="_blank" rel="noreferrer" className="block p-4 text-admin-champ text-sm">Abrir documento</a>}
              </div>
            )}
            {req.source === 'proposal' && req.document_id && <p className="text-admin-muted/40 text-xs mt-3">Proposta viva do Document Studio.</p>}
          </div>

          {/* signatários */}
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Signatários</p>
            <div className="space-y-2">
              {signers.map((sg) => (
                <div key={sg.id} className="glass-soft rounded-xl p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-admin-text text-sm font-medium truncate">{sg.name || sg.email || 'Signatário'}</p>
                      <p className="text-admin-muted/40 text-xs">{sg.email}{sg.signed_ip ? ` · IP ${sg.signed_ip}` : ''}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg ${sg.status === 'signed' ? 'bg-admin-sage/15 text-admin-sage' : sg.status === 'viewed' ? 'bg-admin-champ/10 text-admin-champ' : 'bg-white/[0.05] text-admin-muted/60'}`}>{SIGNER_ST[sg.status]}</span>
                    {req.status !== 'cancelled' && sg.status !== 'signed' && <button onClick={() => copyLink(sg.token)} className="text-[11px] px-2.5 py-1 rounded-lg bg-admin-champ/15 text-admin-champ flex items-center gap-1"><Icon name="link" className="w-3 h-3" />Copiar link</button>}
                  </div>
                  {sg.status === 'signed' && (
                    <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-3">
                      {sg.signature_data && <img alt="assinatura" src={sg.signature_data} className="h-12 bg-white/90 rounded-md px-2" />}
                      <div className="text-[11px] text-admin-muted/50">Assinado por <span className="text-admin-text/80">{sg.signed_name}</span><br />{fmtDT(sg.signed_at)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {allSigned && <div className="mt-3 glass-soft rounded-xl px-4 py-2.5 text-admin-sage text-sm flex items-center gap-2"><Icon name="check" className="w-4 h-4" />Todos assinaram — documento concluído.</div>}
          </div>
        </div>

        {/* trilha de eventos */}
        <div className="glass rounded-2xl p-5 h-fit">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Trilha de auditoria</p>
          {events.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem eventos ainda.</p> : (
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-admin-champ/50 mt-1.5 shrink-0" />
                  <div><p className="text-admin-text text-sm">{EV[e.event] || e.event}</p><p className="text-admin-muted/40 text-[11px]">{fmtDT(e.created_at)}{e.ip && e.ip !== 'desconhecido' ? ` · IP ${e.ip}` : ''}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir solicitação</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover “{req.title}” e toda a trilha de assinaturas? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3"><button onClick={remove} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm">Excluir</button><button onClick={() => setConfirmDel(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
