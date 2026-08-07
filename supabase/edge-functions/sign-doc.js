// sign-doc — página pública de assinatura por token (sem login).
//   GET  ?token=..  → carrega documento + signatário, registra 'visto' + IP, retorna URL assinada do arquivo.
//   POST { token, signed_name, signature_data } → grava assinatura, IP, evento 'assinado'.
// Service role: acesso controlado exclusivamente pelo token do signatário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for') || ''
  return (xf.split(',')[0] || '').trim() || req.headers.get('x-real-ip') || 'desconhecido'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const url = new URL(req.url)

  let token = url.searchParams.get('token') || ''
  let body = {}
  if (req.method === 'POST') { try { body = await req.json() } catch { /* vazio */ } token = body.token || token }
  if (!token) return json({ error: 'missing_token' }, 400)
  // ação: 'load' (carregar+marcar visto) ou 'sign'. GET equivale a load.
  const action = req.method === 'GET' ? 'load' : (body.action || 'sign')

  const { data: signer } = await admin.from('signature_signers').select('*').eq('token', token).maybeSingle()
  if (!signer) return json({ error: 'invalid_token' }, 404)
  const { data: reqRow } = await admin.from('signature_requests').select('*').eq('id', signer.request_id).maybeSingle()
  if (!reqRow) return json({ error: 'not_found' }, 404)
  if (reqRow.status === 'cancelled') return json({ error: 'cancelled' }, 410)

  const ip = clientIp(req)

  if (action === 'load') {
    if (signer.status === 'pending') {
      await admin.from('signature_signers').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', signer.id)
      await admin.from('signature_requests').update({ status: reqRow.status === 'sent' ? 'viewed' : reqRow.status }).eq('id', reqRow.id)
      await admin.from('signature_events').insert({ request_id: reqRow.id, signer_id: signer.id, tenant_id: reqRow.tenant_id, event: 'viewed', ip })
    }
    let fileUrl = null
    if (reqRow.storage_path) {
      const { data: su } = await admin.storage.from('vault').createSignedUrl(reqRow.storage_path, 3600)
      fileUrl = su?.signedUrl || null
    }
    return json({
      ok: true,
      request: { title: reqRow.title, message: reqRow.message, file_name: reqRow.file_name, file_ext: reqRow.file_ext, source: reqRow.source, document_id: reqRow.document_id },
      signer: { name: signer.name, email: signer.email, status: signer.status, signed_at: signer.signed_at },
      file_url: fileUrl,
    })
  }

  if (signer.status === 'signed') return json({ error: 'already_signed' }, 409)
  const signedName = (body.signed_name || signer.name || '').toString().trim()
  if (!signedName) return json({ error: 'name_required' }, 400)
  if (!body.signature_data) return json({ error: 'signature_required' }, 400)

  const nowIso = new Date().toISOString()
  await admin.from('signature_signers').update({
    status: 'signed', signature_data: body.signature_data, signed_name: signedName,
    signed_ip: ip, signed_user_agent: req.headers.get('user-agent') || '', signed_at: nowIso,
  }).eq('id', signer.id)
  await admin.from('signature_events').insert({ request_id: reqRow.id, signer_id: signer.id, tenant_id: reqRow.tenant_id, event: 'signed', ip, detail: { name: signedName } })

  const { data: all } = await admin.from('signature_signers').select('status').eq('request_id', reqRow.id)
  const done = (all || []).every((s) => s.status === 'signed')
  const newStatus = done ? 'completed' : 'signed'
  await admin.from('signature_requests').update({ status: newStatus, updated_at: nowIso, completed_at: done ? nowIso : null }).eq('id', reqRow.id)
  if (done) {
    await admin.from('signature_events').insert({ request_id: reqRow.id, tenant_id: reqRow.tenant_id, event: 'completed', ip })
    // Notificação de conclusão ao dono/criador (via provedor de e-mail do tenant).
    try { await notifyCompletion(admin, reqRow) } catch (_) { /* não bloqueia a assinatura */ }
  }

  return json({ ok: true, status: newStatus })
})

// ---- notificação de conclusão + envio via provedor do tenant ----
async function notifyCompletion(admin, reqRow) {
  const to = reqRow.notify_email
  if (!to) return
  const origin = reqRow.app_origin || Deno.env.get('PUBLIC_APP_URL') || ''
  const validateUrl = `${origin}/validar/${reqRow.verification_code}`
  const { data: signers } = await admin.from('signature_signers').select('name,email,signed_name,signed_at').eq('request_id', reqRow.id)
  const rows = (signers || []).map((s) => `<li>${s.signed_name || s.name || s.email || 'Signatário'} — ${s.signed_at ? new Date(s.signed_at).toLocaleString('pt-BR') : ''}</li>`).join('')
  const html = `<div style="font-family:system-ui,Arial;max-width:560px;margin:auto;padding:28px;background:#faf8f2;border-radius:16px">
    <p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#55634D;margin:0 0 6px">Documento concluído</p>
    <h1 style="color:#1F3A5F;font-size:24px;margin:0 0 10px">${reqRow.title}</h1>
    <p style="color:#444;font-size:15px">Todos os signatários assinaram. Segue a lista:</p>
    <ul style="color:#444;font-size:14px">${rows}</ul>
    ${origin ? `<a href="${validateUrl}" style="display:inline-block;margin:14px 0;background:#B89C61;color:#1a1a1a;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Ver comprovante de validação</a>` : ''}
    <p style="color:#888;font-size:12px;margin-top:16px">Código de verificação: ${reqRow.verification_code}</p>
  </div>`
  await sendViaTenant(admin, reqRow.tenant_id, { to, subject: `Assinado: ${reqRow.title}`, html, text: `O documento "${reqRow.title}" foi assinado por todos. Verificação: ${reqRow.verification_code}` })
}

async function sendViaTenant(admin, tenantId, msg) {
  const { data: ch } = await admin.from('messaging_channels').select('credentials').eq('tenant_id', tenantId).eq('channel', 'email_send').maybeSingle()
  const c = ch?.credentials || {}
  if (!c.from_email || (!c.api_key && !c.smtp_host)) return  // sem provedor: silencioso
  const provider = (c.provider || (c.smtp_host ? 'smtp' : 'resend')).toLowerCase()
  const from = `${c.from_name || 'Seravie'} <${c.from_email}>`
  if (provider === 'resend' && c.api_key) {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }) })
  } else if (provider === 'sendgrid' && c.api_key) {
    await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: msg.to }] }], from: { email: c.from_email, name: c.from_name || 'Seravie' }, subject: msg.subject, content: [{ type: 'text/plain', value: msg.text || ' ' }, { type: 'text/html', value: msg.html }] }) })
  } else if (c.smtp_host) {
    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
    const port = Number(c.smtp_port || 587)
    const client = new SMTPClient({ connection: { hostname: c.smtp_host, port, tls: port === 465, auth: { username: c.smtp_user, password: c.smtp_pass } } })
    try { await client.send({ from, to: msg.to, subject: msg.subject, content: msg.text || ' ', html: msg.html }); await client.close() } catch { try { await client.close() } catch { /* noop */ } }
  }
}
