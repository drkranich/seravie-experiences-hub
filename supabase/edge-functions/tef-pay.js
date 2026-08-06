// Edge Function: tef-pay
// Inicia uma transação TEF (maquininha integrada: SiTef, PayGo, Stone, Cielo).
// "Pronto para plugar": sem o secret TEF_API_KEY / provedor configurado,
// registra a transação como 'pending' e responde tef_not_configured.
//
// Secrets esperados (Supabase → Edge Functions → Secrets):
//   TEF_API_KEY   — token/credencial do provedor TEF
//   TEF_BASE_URL  — endpoint do provedor (varia por integrador)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  let p = {}
  try { p = await req.json() } catch { /* vazio */ }
  const amount = Number(p.amount) || 0
  const method = ['credito', 'debito', 'pix', 'voucher'].includes(p.method) ? p.method : 'credito'
  const installments = Math.max(1, parseInt(p.installments) || 1)
  if (amount <= 0) return json({ error: 'invalid_amount' }, 400)

  const apiKey = Deno.env.get('TEF_API_KEY')
  const base = Deno.env.get('TEF_BASE_URL')

  if (!apiKey || !base) {
    const { data: tx } = await admin.from('tef_transactions').insert({
      tenant_id: tenantId, order_id: p.order_id || null, provider: p.provider || 'sitef',
      method, installments, amount, status: 'pending', message: 'tef_not_configured',
    }).select('id').single()
    return json({ error: 'tef_not_configured', transaction_id: tx?.id, detail: 'Configure o provedor TEF (SiTef/PayGo) e o segredo TEF_API_KEY para capturar pagamentos na maquininha.' }, 200)
  }

  try {
    const r = await fetch(`${base}/transactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, installments, order_id: p.order_id }),
    })
    const d = await r.json().catch(() => ({}))
    const ok = r.ok && (d.status === 'approved' || d.authorization_code)
    const { data: tx } = await admin.from('tef_transactions').insert({
      tenant_id: tenantId, order_id: p.order_id || null, provider: p.provider || 'sitef',
      method, installments, amount, status: ok ? 'approved' : 'declined',
      nsu: d.nsu || null, authorization_code: d.authorization_code || null,
      card_brand: d.card_brand || null, provider_ref: d.id || null, message: d.message || null,
      settled_at: ok ? new Date().toISOString() : null,
    }).select('id, status, authorization_code').single()
    return json({ ok, transaction: tx })
  } catch (e) {
    return json({ error: 'tef_gateway_error', detail: String(e?.message || e) }, 502)
  }
})
