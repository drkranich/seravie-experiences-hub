// stripe-webhook — recebe eventos do Stripe e sincroniza a tabela subscriptions.
// verify_jwt=false: autenticação via assinatura do Stripe (Stripe-Signature).
// Inerte enquanto STRIPE_WEBHOOK_SECRET não estiver definido.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Verifica a assinatura HMAC-SHA256 do Stripe sem depender do SDK.
async function verifySig(payload, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const t = parts['t']; const v1 = parts['v1']
  if (!t || !v1) return false
  const enc = new TextEncoder()
  const keyData = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', keyData, enc.encode(`${t}.${payload}`))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'stripe_not_configured' }, 400)
  const sig = req.headers.get('Stripe-Signature') || ''
  const raw = await req.text()
  if (!(await verifySig(raw, sig, secret))) return json({ error: 'invalid_signature' }, 400)
  let event; try { event = JSON.parse(raw) } catch { return json({ error: 'invalid_payload' }, 400) }
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const upsertSub = async (tenantId, patch) => {
    if (!tenantId) return
    const { data: existing } = await admin.from('subscriptions').select('id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1)
    if (existing && existing.length) await admin.from('subscriptions').update(patch).eq('id', existing[0].id)
    else await admin.from('subscriptions').insert({ tenant_id: tenantId, payment_provider: 'stripe', ...patch })
  }
  try {
    const obj = event.data?.object || {}
    switch (event.type) {
      case 'checkout.session.completed':
        await upsertSub(obj.metadata?.tenant_id, { plan_id: obj.metadata?.plan_id || null, billing_cycle: obj.metadata?.cycle || 'monthly', status: 'active', provider_subscription_id: obj.subscription || null, payment_provider: 'stripe' })
        break
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await upsertSub(obj.metadata?.tenant_id, { status: obj.status === 'trialing' ? 'trialing' : (obj.status === 'active' ? 'active' : (obj.status || 'active')), provider_subscription_id: obj.id, current_period_start: obj.current_period_start ? new Date(obj.current_period_start * 1000).toISOString() : null, current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null, trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null })
        break
      case 'customer.subscription.deleted':
        await upsertSub(obj.metadata?.tenant_id, { status: 'cancelled', cancelled_at: new Date().toISOString() })
        break
      case 'invoice.payment_failed': {
        const tenantId = obj.subscription_details?.metadata?.tenant_id || obj.metadata?.tenant_id
        if (tenantId) await upsertSub(tenantId, { status: 'past_due' })
        break
      }
      default: break
    }
  } catch (e) { return json({ error: 'handler_error', detail: String(e) }, 500) }
  return json({ received: true })
})
