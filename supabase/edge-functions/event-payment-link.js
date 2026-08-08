// Edge Function: event-payment-link  (modelo MARKETPLACE via Stripe Connect)
// Gera um LINK DE PAGAMENTO para um evento pago. O valor cai DIRETO na conta
// Stripe conectada do tenant que criou o evento; a plataforma retém uma comissão
// (application_fee) definida em platform_settings.event_fee_percent (ex.: 5%).
//
// Pré-requisito: o tenant precisa ter concluído o onboarding do Stripe Connect
// (tenants.stripe_account_id + charges_enabled). Sem isso, devolve
// { error: 'connect_required' } para a UI orientar o onboarding.
//
// Segurança: STRIPE_SECRET_KEY (plataforma) nos Secrets do Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY nos Secrets do Supabase.' }, 200)

  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  let payload = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const amount = Number(payload.amount)
  if (!amount || amount <= 0) return json({ error: 'invalid_amount' }, 400)
  const tenantId = String(payload.tenant_id || '')
  if (!tenantId) return json({ error: 'missing_tenant' }, 400)
  const cents = Math.round(amount * 100)
  const currency = String(payload.currency || 'brl').toLowerCase()
  const name = String(payload.title || 'Ingresso de evento')

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    admin.from('tenants').select('stripe_account_id, stripe_charges_enabled').eq('id', tenantId).maybeSingle(),
    admin.from('platform_settings').select('event_fee_percent').eq('id', 1).maybeSingle(),
  ])
  const acctId = tenant?.stripe_account_id
  if (!acctId || !tenant?.stripe_charges_enabled) {
    return json({ error: 'connect_required', detail: 'Conclua o onboarding do Stripe Connect para receber pagamentos direto na sua conta.' }, 200)
  }
  const feePct = Number(settings?.event_fee_percent ?? 5)
  const feeCents = Math.round(cents * (feePct / 100))

  const stripe = (path, body) => fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const priceBody = new URLSearchParams()
  priceBody.set('currency', currency)
  priceBody.set('unit_amount', String(cents))
  priceBody.set('product_data[name]', name)
  const pr = await stripe('prices', priceBody)
  const price = await pr.json()
  if (!pr.ok) return json({ error: 'stripe_error', detail: price?.error?.message }, 400)

  const linkBody = new URLSearchParams()
  linkBody.set('line_items[0][price]', price.id)
  linkBody.set('line_items[0][quantity]', '1')
  if (payload.quantity_adjustable) linkBody.set('line_items[0][adjustable_quantity][enabled]', 'true')
  linkBody.set('application_fee_percent', String(feePct))
  linkBody.set('transfer_data[destination]', acctId)
  if (payload.event_id) linkBody.set('metadata[event_id]', String(payload.event_id))
  linkBody.set('metadata[tenant_id]', tenantId)
  if (payload.success_url) {
    linkBody.set('after_completion[type]', 'redirect')
    linkBody.set('after_completion[redirect][url]', String(payload.success_url))
  }
  const lr = await stripe('payment_links', linkBody)
  const link = await lr.json()
  if (!lr.ok) return json({ error: 'stripe_error', detail: link?.error?.message }, 400)

  return json({ url: link.url, id: link.id, fee_percent: feePct, fee_amount: feeCents / 100 })
})
