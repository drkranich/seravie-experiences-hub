// sync-service-price — sincroniza o Stripe quando o super admin muda o preço
// de uma oferta de serviço (service_offerings: franquia / assessoria).
//
// Preços do Stripe são imutáveis → ao mudar o valor:
//   1) reaproveita (ou cria) o Produto no Stripe (busca por metadata offering_slug);
//   2) cria novo Price (recurring para consultoria; one_time para setup/taxa/projeto);
//   3) arquiva o Price antigo;
//   4) grava os novos ids em service_offerings.
//
// Auth: JWT do usuário; só super_admin (roles.slug='super_admin').
// Deploy: verify_jwt=false. STRIPE_SECRET_KEY nos Secrets do Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const form = (o) => { const b = new URLSearchParams(); for (const k in o) if (o[k] !== undefined && o[k] !== null) b.set(k, String(o[k])); return b }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('status, roles!inner(slug)').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  if (mem?.roles?.slug !== 'super_admin') return json({ error: 'forbidden', detail: 'Apenas o super admin.' }, 403)

  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured' }, 200)
  const sh = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  if (!p.id) return json({ error: 'missing_id' }, 400)
  const { data: o, error } = await admin.from('service_offerings').select('*').eq('id', p.id).maybeSingle()
  if (error || !o) return json({ error: 'not_found' }, 404)

  const slug = o.slug
  // produto: reaproveita por metadata offering_slug, senão cria
  let productId = null
  try {
    const sr = await fetch(`https://api.stripe.com/v1/products/search?query=${encodeURIComponent(`metadata['offering_slug']:'${slug}'`)}`, { headers: sh })
    const sd = await sr.json(); if (sr.ok && sd.data?.length) productId = sd.data[0].id
  } catch { /* cria abaixo */ }
  if (!productId) {
    const pr = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: sh, body: form({ name: o.name, 'metadata[offering_slug]': slug, 'metadata[seravie_service]': o.kind }) })
    const pd = await pr.json(); if (!pr.ok) return json({ error: 'stripe_product_error', detail: pd?.error?.message }, 400)
    productId = pd.id
  }

  const archive = async (priceId) => { if (priceId) { try { await fetch(`https://api.stripe.com/v1/prices/${priceId}`, { method: 'POST', headers: sh, body: form({ active: 'false' }) }) } catch { /* best-effort */ } } }
  const newRecurring = async (interval, amount) => {
    if (!amount || amount <= 0) return null
    const r = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: sh, body: form({ product: productId, currency: 'brl', unit_amount: Math.round(amount * 100), 'recurring[interval]': interval, nickname: `${slug} ${interval === 'year' ? 'anual' : 'mensal'}` }) })
    const d = await r.json(); return r.ok ? d.id : { error: d?.error?.message }
  }
  const newOneTime = async (amount) => {
    if (!amount || amount <= 0) return null
    const r = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: sh, body: form({ product: productId, currency: 'brl', unit_amount: Math.round(amount * 100), nickname: `${slug} (único)` }) })
    const d = await r.json(); return r.ok ? d.id : { error: d?.error?.message }
  }

  const patch = {}
  const out = { slug, product: productId }

  if (o.billing_model === 'recurring') {
    const m = await newRecurring('month', Number(o.price_monthly))
    if (m && m.error) return json({ error: 'stripe_price_error', detail: m.error }, 400)
    if (m) { await archive(o.stripe_price_monthly); patch.stripe_price_monthly = m; out.stripe_price_monthly = m }
    const y = await newRecurring('year', Number(o.price_yearly))
    if (y && y.error) return json({ error: 'stripe_price_error', detail: y.error }, 400)
    if (y) { await archive(o.stripe_price_yearly); patch.stripe_price_yearly = y; out.stripe_price_yearly = y }
  } else {
    // one_time / royalty(taxa de entrada) / hourly → price único
    const s = await newOneTime(Number(o.price_setup))
    if (s && s.error) return json({ error: 'stripe_price_error', detail: s.error }, 400)
    if (s) { await archive(o.stripe_price_setup); patch.stripe_price_setup = s; out.stripe_price_setup = s }
  }

  if (Object.keys(patch).length) {
    const { error: upErr } = await admin.from('service_offerings').update(patch).eq('id', o.id)
    if (upErr) return json({ error: 'db_update_failed', detail: upErr.message }, 400)
  }
  return json({ ok: true, ...out, updated: patch })
})
