// combo-subscribe — cliente monta o próprio combo (lista de módulos). Calcula o
// preço no servidor (fonte de verdade = modules), registra em custom_combos e,
// se o Stripe tiver Price ID por módulo, abre o checkout. Sem Stripe, registra
// o combo como pendente. (Deploy: verify_jwt=false; valida usuário internamente.)
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
  const slugs = Array.isArray(p.module_slugs) ? p.module_slugs : []
  const cycle = p.cycle === 'yearly' ? 'yearly' : 'monthly'
  if (!slugs.length) return json({ error: 'empty_combo' }, 400)
  const { data: mods } = await admin.from('modules').select('slug,name,price_monthly,price_yearly,sellable,stripe_price_monthly,stripe_price_yearly').in('slug', slugs).eq('sellable', true)
  const chosen = mods || []
  if (!chosen.length) return json({ error: 'no_valid_modules' }, 400)
  const total = chosen.reduce((s, m) => s + (Number(cycle === 'yearly' ? m.price_yearly : m.price_monthly) || 0), 0)
  const { data: combo } = await admin.from('custom_combos').insert({ tenant_id: tenantId, name: 'Combo personalizado', module_slugs: chosen.map((m) => m.slug), billing_cycle: cycle, computed_price: total, status: 'draft' }).select('id').single()
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  const priceField = cycle === 'yearly' ? 'stripe_price_yearly' : 'stripe_price_monthly'
  const withPrice = chosen.filter((m) => m[priceField])
  if (!key || withPrice.length !== chosen.length) {
    return json({ ok: true, combo_id: combo?.id, total, error: 'stripe_not_configured', detail: 'Combo registrado. Configure STRIPE_SECRET_KEY e o Price ID de cada módulo para cobrar automaticamente.' })
  }
  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  chosen.forEach((m, i) => { body.set(`line_items[${i}][price]`, m[priceField]); body.set(`line_items[${i}][quantity]`, '1') })
  body.set('success_url', `${p.origin || ''}/#admin?combo=ok`)
  body.set('cancel_url', `${p.origin || ''}/#admin?combo=cancel`)
  body.set('client_reference_id', tenantId)
  body.set('metadata[tenant_id]', tenantId); body.set('metadata[combo_id]', String(combo?.id || ''))
  body.set('subscription_data[metadata][tenant_id]', tenantId); body.set('subscription_data[metadata][combo_id]', String(combo?.id || ''))
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const d = await r.json()
  if (!r.ok) return json({ error: 'stripe_error', detail: d?.error?.message }, 400)
  return json({ ok: true, combo_id: combo?.id, total, checkout_url: d.url })
})
