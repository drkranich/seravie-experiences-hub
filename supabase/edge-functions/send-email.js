// send-email — disparo de e-mail multi-provedor, POR TENANT.
// Cada cliente conecta o próprio provedor no canal 'email_send' (messaging_channels.credentials):
//   provider: 'resend' | 'sendgrid' | 'ses' | 'smtp'
//   from_email, from_name, api_key, e (para smtp) smtp_host/port/user/pass
// Modos de uso:
//   { action:'test', to } → envia um e-mail de teste
//   { action:'send', to, subject, html, text } → envio genérico
// Auth: JWT do usuário (tenant vem do membership). Segredos ficam no banco, nunca no front.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

// ---- provedores ----
async function viaResend(c, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${c.from_name || 'Seravie'} <${c.from_email}>`, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return { error: d?.message || d?.error || 'Falha no Resend' }
  return { id: d.id }
}
async function viaSendgrid(c, msg) {
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: c.from_email, name: c.from_name || 'Seravie' },
      subject: msg.subject,
      content: [{ type: 'text/plain', value: msg.text || ' ' }, { type: 'text/html', value: msg.html }],
    }),
  })
  if (r.status >= 200 && r.status < 300) return { id: r.headers.get('x-message-id') || 'sent' }
  const d = await r.text().catch(() => '')
  return { error: 'SendGrid: ' + (d || r.status) }
}
async function viaSES(c, msg) {
  // AWS SES via API SMTP não; usamos endpoint REST simples com SigV4 seria longo.
  // Aqui aceitamos SES por SMTP (host email-smtp.<region>.amazonaws.com) — cai no viaSMTP.
  return viaSMTP({ ...c, smtp_host: c.smtp_host || `email-smtp.${c.region || 'us-east-1'}.amazonaws.com`, smtp_port: c.smtp_port || '587', smtp_user: c.smtp_user || c.access_key, smtp_pass: c.smtp_pass || c.secret_key }, msg)
}
async function viaSMTP(c, msg) {
  const port = Number(c.smtp_port || 587)
  const client = new SMTPClient({
    connection: {
      hostname: c.smtp_host,
      port,
      tls: port === 465,
      auth: { username: c.smtp_user, password: c.smtp_pass },
    },
  })
  try {
    await client.send({
      from: `${c.from_name || 'Seravie'} <${c.from_email}>`,
      to: msg.to, subject: msg.subject,
      content: msg.text || ' ', html: msg.html,
    })
    await client.close()
    return { id: 'smtp-sent' }
  } catch (e) {
    try { await client.close() } catch { /* noop */ }
    return { error: 'SMTP: ' + (e?.message || String(e)) }
  }
}

async function dispatch(c, msg) {
  const provider = (c.provider || (c.smtp_host ? 'smtp' : 'resend')).toLowerCase()
  if (!c.from_email) return { error: 'Configure o remetente (from_email).' }
  if (provider === 'resend') return c.api_key ? viaResend(c, msg) : { error: 'Falta a API key do Resend.' }
  if (provider === 'sendgrid') return c.api_key ? viaSendgrid(c, msg) : { error: 'Falta a API key do SendGrid.' }
  if (provider === 'ses') return viaSES(c, msg)
  if (provider === 'smtp') return c.smtp_host ? viaSMTP(c, msg) : { error: 'Configure o host SMTP.' }
  return { error: 'Provedor não suportado: ' + provider }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const action = p.action || 'send'

  const { data: ch } = await admin.from('messaging_channels').select('credentials, is_enabled, status').eq('tenant_id', tenantId).eq('channel', 'email_send').maybeSingle()
  const c = ch?.credentials || {}
  if (!ch || (!c.api_key && !c.smtp_host)) return json({ error: 'not_configured', detail: 'Nenhum provedor de e-mail conectado neste espaço.' }, 200)

  if (action === 'test') {
    const to = p.to || c.from_email
    const html = `<div style="font-family:system-ui,Arial;max-width:520px;margin:auto;padding:24px"><h2 style="color:#1F3A5F">Teste de e-mail ✓</h2><p>Se você recebeu esta mensagem, seu provedor de disparo está funcionando.</p><p style="color:#888;font-size:13px">Enviado pela Seravie Experiences.</p></div>`
    const r = await dispatch(c, { to, subject: 'Teste de disparo — Seravie', html, text: 'Teste de disparo funcionando.' })
    if (r.error) return json({ error: 'send_failed', detail: r.error }, 400)
    return json({ ok: true, id: r.id })
  }

  // envio genérico
  if (!p.to || !p.subject) return json({ error: 'missing_fields' }, 400)
  const r = await dispatch(c, { to: p.to, subject: p.subject, html: p.html || esc(p.text || ''), text: p.text || '' })
  if (r.error) return json({ error: 'send_failed', detail: r.error }, 400)
  return json({ ok: true, id: r.id })
})
