// omni-send — worker de envio real do omnichannel (WhatsApp / Instagram / E-mail).
//
// Envia uma mensagem de saída (do agente) pelo canal da conversa, usando as
// credenciais DO PRÓPRIO TENANT. Nenhum segredo volta ao front — tokens ficam em
// social_credentials (protegida) ou messaging_channels.credentials, no banco.
//
// Chamada (a partir da aba Conversas, com o JWT do usuário logado):
//   { message_id }                         -> envia uma mensagem já gravada
//   { conversation_id, content, attachments } -> (alternativa) envia direto
//   { action:'test', channel, to }         -> teste rápido de um canal
//
// Resolução de canal: usa conversations.channel (whatsapp|instagram|email|...).
// Destinatário: conversations.channel_id (id externo, ex. telefone/PSID) ou o
// contato vinculado (phone/email). O status de entrega é gravado em
// messages.delivery = { status, external_id, error, at, channel }.
//
// Deploy com verify_jwt=true (exige usuário logado do tenant).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const digits = (s) => String(s || '').replace(/\D/g, '')
const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const nowISO = () => new Date().toISOString()

// ───────────────────────── WhatsApp Cloud API (Meta) ─────────────────────────
// Credenciais esperadas (social_credentials.network='whatsapp' OU
// messaging_channels.channel='whatsapp'.credentials):
//   access_token           -> token permanente do WhatsApp Business
//   phone_number_id         -> ID do número (Graph). Em social_credentials pode vir
//                              em external_account_id ou meta.phone_number_id.
async function sendWhatsApp(cred, msg) {
  const token = cred.access_token
  const phoneId = cred.phone_number_id || cred.external_account_id || cred.meta?.phone_number_id
  if (!token || !phoneId) return { status: 'error', error: 'WhatsApp não configurado (falta token ou phone_number_id).' }
  const to = digits(msg.to)
  if (!to) return { status: 'error', error: 'Conversa sem telefone de destino.' }

  const results = []
  // texto
  if (msg.text) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: msg.text } }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) return { status: 'error', error: j.error?.message || `http_${r.status}` }
    results.push(j.messages?.[0]?.id)
  }
  // anexos (imagem/documento por URL pública)
  for (const att of (msg.attachments || [])) {
    const isImg = att.type === 'image'
    const payload = isImg
      ? { messaging_product: 'whatsapp', to, type: 'image', image: { link: att.url } }
      : { messaging_product: 'whatsapp', to, type: 'document', document: { link: att.url, filename: att.name || 'arquivo' } }
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) return { status: 'error', error: j.error?.message || `http_${r.status}` }
    results.push(j.messages?.[0]?.id)
  }
  return { status: 'sent', external_id: results.filter(Boolean)[0] || null }
}

// ───────────────────────── Instagram Messaging (Meta) ────────────────────────
// Responde no Direct dentro da janela de 24h. Credenciais:
//   access_token           -> token da página vinculada ao IG Business
//   ig_id / external_account_id -> IGSID/ID da conta usada no endpoint /me/messages
// Destinatário: PSID/IGSID do usuário (conversations.channel_id).
async function sendInstagram(cred, msg) {
  const token = cred.access_token
  const igId = cred.ig_id || cred.external_account_id || cred.meta?.ig_id || 'me'
  if (!token) return { status: 'error', error: 'Instagram não conectado (falta token).' }
  const to = msg.to
  if (!to) return { status: 'error', error: 'Conversa sem ID de destino do Instagram (channel_id).' }

  const attach = (msg.attachments || [])[0]
  const message = attach
    ? { attachment: { type: attach.type === 'image' ? 'image' : 'file', payload: { url: attach.url, is_reusable: false } } }
    : { text: msg.text || '' }

  const r = await fetch(`https://graph.facebook.com/v19.0/${igId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: to }, message, messaging_type: 'RESPONSE' }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) return { status: 'error', error: j.error?.message || `http_${r.status}` }
  return { status: 'sent', external_id: j.message_id || null }
}

// ───────────────────────── E-mail (fallback multi-provedor) ──────────────────
// Reaproveita a convenção de send-email: messaging_channels.channel='email_send'
async function viaResend(c, m) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${c.from_name || 'Seravie'} <${c.from_email}>`, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  })
  const d = await r.json().catch(() => ({}))
  return r.ok ? { id: d.id } : { error: d?.message || d?.error || 'Falha no Resend' }
}
async function viaSendgrid(c, m) {
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ personalizations: [{ to: [{ email: m.to }] }], from: { email: c.from_email, name: c.from_name || 'Seravie' }, subject: m.subject, content: [{ type: 'text/plain', value: m.text || ' ' }, { type: 'text/html', value: m.html }] }),
  })
  if (r.status >= 200 && r.status < 300) return { id: r.headers.get('x-message-id') || 'sent' }
  return { error: 'SendGrid: ' + (await r.text().catch(() => r.status)) }
}
async function viaSMTP(c, m) {
  const port = Number(c.smtp_port || 587)
  const client = new SMTPClient({ connection: { hostname: c.smtp_host, port, tls: port === 465, auth: { username: c.smtp_user, password: c.smtp_pass } } })
  try {
    await client.send({ from: `${c.from_name || 'Seravie'} <${c.from_email}>`, to: m.to, subject: m.subject, content: m.text || ' ', html: m.html })
    await client.close(); return { id: 'smtp-sent' }
  } catch (e) { try { await client.close() } catch { /* noop */ } return { error: 'SMTP: ' + (e?.message || String(e)) } }
}
async function sendEmail(c, msg) {
  if (!c.from_email) return { status: 'error', error: 'Configure o remetente (from_email).' }
  if (!msg.to) return { status: 'error', error: 'Conversa sem e-mail de destino.' }
  const provider = (c.provider || (c.smtp_host ? 'smtp' : 'resend')).toLowerCase()
  const attHtml = (msg.attachments || []).map((a) => `<p><a href="${esc(a.url)}">${esc(a.name || 'anexo')}</a></p>`).join('')
  const html = `<div style="font-family:system-ui,Arial;max-width:560px">${esc(msg.text || '').replace(/\n/g, '<br>')}${attHtml}</div>`
  const m = { to: msg.to, subject: msg.subject || 'Mensagem da Seravie', html, text: msg.text || ' ' }
  let r
  if (provider === 'resend') r = c.api_key ? await viaResend(c, m) : { error: 'Falta a API key do Resend.' }
  else if (provider === 'sendgrid') r = c.api_key ? await viaSendgrid(c, m) : { error: 'Falta a API key do SendGrid.' }
  else if (provider === 'smtp' || provider === 'ses') r = c.smtp_host ? await viaSMTP(c, m) : { error: 'Configure o host SMTP.' }
  else r = { error: 'Provedor de e-mail não suportado: ' + provider }
  return r.error ? { status: 'error', error: r.error } : { status: 'sent', external_id: r.id || null }
}

// ───────────────────────── resolução de credenciais ──────────────────────────
// WhatsApp/Instagram: tenta social_credentials (fluxo OAuth) e cai para
// messaging_channels.credentials (config manual). E-mail: messaging_channels.
async function loadCred(admin, tenantId, channel) {
  if (channel === 'email') {
    const { data: ch } = await admin.from('messaging_channels').select('credentials, is_enabled').eq('tenant_id', tenantId).eq('channel', 'email_send').maybeSingle()
    return ch?.credentials || null
  }
  const network = channel === 'whatsapp' ? 'whatsapp' : channel === 'instagram' ? 'instagram' : channel
  const { data: sc } = await admin.from('social_credentials').select('*').eq('tenant_id', tenantId).eq('network', network).maybeSingle()
  if (sc?.access_token) return { ...(sc.meta || {}), access_token: sc.access_token, external_account_id: sc.external_account_id }
  const { data: mc } = await admin.from('messaging_channels').select('credentials, is_enabled').eq('tenant_id', tenantId).eq('channel', channel).maybeSingle()
  return mc?.credentials || null
}

function dispatch(channel, cred, msg) {
  if (channel === 'whatsapp') return sendWhatsApp(cred, msg)
  if (channel === 'instagram') return sendInstagram(cred, msg)
  if (channel === 'email') return sendEmail(cred, msg)
  return Promise.resolve({ status: 'skipped', error: `Canal "${channel}" ainda não tem envio automático. Use o link direto.` })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  // identifica usuário + tenant pelo JWT
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }

  // ── teste de canal ──
  if (p.action === 'test') {
    const channel = p.channel
    const cred = await loadCred(admin, tenantId, channel)
    if (!cred) return json({ error: 'not_configured', detail: `Canal ${channel} não conectado neste espaço.` }, 200)
    const r = await dispatch(channel, cred, { to: p.to, text: 'Teste de envio — Seravie ✓', subject: 'Teste de envio — Seravie', attachments: [] })
    return json(r.status === 'sent' ? { ok: true, external_id: r.external_id } : { error: 'send_failed', detail: r.error }, r.status === 'sent' ? 200 : 400)
  }

  // ── resolve a mensagem/conversa ──
  let message = null
  if (p.message_id) {
    const { data } = await admin.from('messages').select('*').eq('id', p.message_id).eq('tenant_id', tenantId).maybeSingle()
    message = data
    if (!message) return json({ error: 'message_not_found' }, 404)
  }
  const convId = message?.conversation_id || p.conversation_id
  if (!convId) return json({ error: 'missing_conversation' }, 400)

  const { data: conv } = await admin.from('conversations').select('*, contact:contacts(name, phone, email)').eq('id', convId).eq('tenant_id', tenantId).maybeSingle()
  if (!conv) return json({ error: 'conversation_not_found' }, 404)

  const channel = conv.channel
  const content = message?.content || p.content || ''
  const attachments = message?.attachments || p.attachments || []

  // destinatário conforme o canal
  const to = channel === 'email' ? (conv.channel_id || conv.contact?.email)
    : channel === 'instagram' ? (conv.channel_id || conv.metadata?.psid)
    : (conv.channel_id || conv.contact?.phone) // whatsapp/telefone

  const cred = await loadCred(admin, tenantId, channel)
  if (!cred) {
    const delivery = { status: 'failed', error: `Canal ${channel} não conectado.`, at: nowISO(), channel }
    if (message) await admin.from('messages').update({ delivery }).eq('id', message.id)
    return json({ ok: false, delivery }, 200)
  }

  let r
  try {
    r = await dispatch(channel, cred, { to, text: content && content !== '📎 Anexo' ? content : '', subject: conv.subject || 'Mensagem', attachments })
  } catch (e) {
    r = { status: 'error', error: String(e?.message || e) }
  }

  const delivery = r.status === 'sent'
    ? { status: 'sent', external_id: r.external_id || null, at: nowISO(), channel }
    : { status: r.status === 'skipped' ? 'skipped' : 'failed', error: r.error || 'falha', at: nowISO(), channel }

  if (message) await admin.from('messages').update({ delivery }).eq('id', message.id)

  return json({ ok: r.status === 'sent', delivery })
})
