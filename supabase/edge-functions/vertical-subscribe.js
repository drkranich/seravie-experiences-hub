// vertical-subscribe — cliente contrata uma frente (vertical) pela própria conta.
// Se o módulo da vertical tem preço + Stripe, abre checkout e a ativação ocorre
// no webhook (metadata.activate_vertical). Se preço 0 ou sem Stripe, ativa na
// hora em vertical_configs. Só admin/super_admin do tenant. (verify_jwt=false)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id, roles(slug)').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)
  if (!['admin', 'super_admin'].includes(mem?.roles?.slug)) return json({ error: 'forbidden' }, 403)
  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const vertical = String(p.vertical || '')
  const cycle = p.cycle === 'yearly' ? 'yearly' : 'monthly'
  if (!vertical) return json({ error: 'missing_vertical' }, 400)
  const { data: mod } = await admin.from('modules').select('*').eq('slug', vertical).eq('sellable', true).maybeSingle()
  if (!mod) return json({ error: 'module_not_found' }, 404)
  const { data: existing } = await admin.from('vertical_configs').select('id').eq('tenant_id', tenantId).eq('vertical', vertical).maybeSingle()
  if (existing) return json({ ok: true, already_active: true })
  const price = cycle === 'yearly' ? Number(mod.price_yearly) || 0 : Number(mod.price_monthly) || 0
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const priceId = cycle === 'yearly' ? mod.stripe_price_yearly : mod.stripe_price_monthly
  if (price <= 0 || !stripeKey || !priceId) {
    await admin.from('vertical_configs').insert({ tenant_id: tenantId, vertical, config: { enabled: true, source: price > 0 ? 'pending_payment' : 'free' } })
    return json({ ok: true, activated: true, free: price <= 0, note: (price > 0 && (!stripeKey || !priceId)) ? 'stripe_not_configured' : undefined })
  }
  const body = new URLSearchParams()
  body.set('mode', 'subscription'); body.set('line_items[0][price]', priceId); body.set('line_items[0][quantity]', '1')
  body.set('success_url', `${p.origin || ''}/#admin?frente=ok`); body.set('cancel_url', `${p.origin || ''}/#admin?frente=cancel`)
  body.set('client_reference_id', tenantId)
  body.set('metadata[tenant_id]', tenantId); body.set('metadata[activate_vertical]', vertical)
  body.set('subscription_data[metadata][tenant_id]', tenantId); body.set('subscription_data[metadata][activate_vertical]', vertical)
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const d = await r.json()
  if (!r.ok) return json({ error: 'stripe_error', detail: d?.error?.message }, 400)
  return json({ ok: true, checkout_url: d.url })
})
