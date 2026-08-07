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
  await admin.from('signature_requests').update({ status: newStatus, updated_at: nowIso }).eq('id', reqRow.id)
  if (done) await admin.from('signature_events').insert({ request_id: reqRow.id, tenant_id: reqRow.tenant_id, event: 'completed', ip })

  return json({ ok: true, status: newStatus })
})
