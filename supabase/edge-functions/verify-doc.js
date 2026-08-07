// verify-doc — validação pública de um documento assinado (manifesto).
// GET/POST { code } → retorna o comprovante: documento, signatários, IPs, datas.
// Público (sem login): acesso apenas pelo código de verificação (não enumerável).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const url = new URL(req.url)
  let code = url.searchParams.get('code') || ''
  if (req.method === 'POST') { try { const b = await req.json(); code = b.code || code } catch { /* vazio */ } }
  if (!code) return json({ error: 'missing_code' }, 400)

  const { data: reqRow } = await admin.from('signature_requests').select('*').eq('verification_code', code).maybeSingle()
  if (!reqRow) return json({ error: 'not_found' }, 404)

  const { data: signers } = await admin.from('signature_signers').select('name,email,role,status,signed_name,signed_ip,signed_at,viewed_at').eq('request_id', reqRow.id).order('order_index')
  const { data: events } = await admin.from('signature_events').select('event,ip,created_at').eq('request_id', reqRow.id).order('created_at')
  const { data: brand } = await admin.from('document_branding').select('enabled,company_name,logo_url,brand_color,website,show_seravie_credit').eq('tenant_id', reqRow.tenant_id).maybeSingle()

  return json({
    ok: true,
    document: {
      title: reqRow.title, file_name: reqRow.file_name, source: reqRow.source,
      status: reqRow.status, created_at: reqRow.created_at, completed_at: reqRow.completed_at,
      verification_code: reqRow.verification_code,
    },
    branding: (brand && brand.enabled) ? brand : null,
    signers: signers || [],
    events: events || [],
  })
})
