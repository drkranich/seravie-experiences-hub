// stripe-subscription — cria a sessão de checkout de ASSINATURA do SaaS.
// Pronto para plugar: sem STRIPE_SECRET_KEY responde stripe_not_configured.
// O plano traz o Price ID (plans.stripe_price_monthly/yearly).
// Deploy: verify_jwt=false (valida o usuário internamente).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
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

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const cycle = p.cycle === 'yearly' ? 'yearly' : 'monthly'
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY e os Price IDs do plano para ativar a cobrança recorrente.' }, 200)

  const { data: plan } = await admin.from('plans').select('*').eq('id', p.plan_id).maybeSingle()
  if (!plan) return json({ error: 'plan_not_found' }, 404)
  const price = cycle === 'yearly' ? plan.stripe_price_yearly : plan.stripe_price_monthly
  if (!price) return json({ error: 'price_not_set', detail: 'O plano não tem Price ID do Stripe configurado.' }, 400)

  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  body.set('line_items[0][price]', price)
  body.set('line_items[0][quantity]', '1')
  body.set('success_url', `${p.origin || ''}/#admin?sub=ok`)
  body.set('cancel_url', `${p.origin || ''}/#admin?sub=cancel`)
  body.set('client_reference_id', tenantId)
  body.set('metadata[tenant_id]', tenantId)
  body.set('metadata[plan_id]', String(p.plan_id))
  body.set('metadata[cycle]', cycle)
  // Propaga o metadata para a subscription criada (o webhook lê de subscription.metadata)
  body.set('subscription_data[metadata][tenant_id]', tenantId)
  body.set('subscription_data[metadata][plan_id]', String(p.plan_id))
  body.set('subscription_data[metadata][cycle]', cycle)
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const d = await r.json()
  if (!r.ok) return json({ error: 'stripe_error', detail: d?.error?.message }, 400)
  return json({ ok: true, checkout_url: d.url })
})
