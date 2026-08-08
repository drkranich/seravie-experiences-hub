// sync-unit-addon — cria/sincroniza no Stripe o item "Unidade adicional" com
// preço GRADUATED (a escada por quantidade), lendo as faixas de plan_addons.
//
// Resultado: um Produto "Seravie — Unidade adicional" com dois Prices recorrentes
// (mensal e anual), ambos billing_scheme=tiered / tiers_mode=graduated:
//   1 unidade  -> R$0     (a 1ª já vem na base Enterprise)
//   2ª à 5ª    -> R$199 cada
//   6ª à 15ª   -> R$149 cada
//   16ª+       -> R$99 cada
// O Stripe soma sozinho conforme a `quantity` (nº de unidades) do item na assinatura.
//
// Prices do Stripe são imutáveis: se as faixas mudarem, cria um Price novo e arquiva
// o antigo. Grava o price_id resultante em plan_addons.stripe_price_id (na faixa base,
// slug 'unit-2-5', como referência do item de assinatura).
//
// Auth: JWT de super_admin. Segredo: STRIPE_SECRET_KEY nos Secrets do Supabase.
// Corpo opcional: { dry_run:true } | { force:true }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const form = (o) => { const b = new URLSearchParams(); for (const k in o) if (o[k] !== undefined && o[k] !== null) b.set(k, String(o[k])); return b }

// monta os parâmetros graduated[...] a partir das faixas do banco
function tierParams(tiers, key) {
  // ordena por tier_from e gera os até: 1 => R$0; depois cada faixa como up_to
  const sorted = [...tiers].sort((a, b) => a.tier_from - b.tier_from)
  const params = {}
  let idx = 0
  // faixa inicial: a 1ª unidade é grátis (inclusa na base)
  params[`tiers[${idx}][up_to]`] = 1
  params[`tiers[${idx}][unit_amount]`] = 0
  idx++
  for (const t of sorted) {
    const amount = Math.round((Number(t[key]) || 0) * 100)
    if (t.tier_to == null) {
      params[`tiers[${idx}][up_to]`] = 'inf'
    } else {
      params[`tiers[${idx}][up_to]`] = t.tier_to
    }
    params[`tiers[${idx}][unit_amount]`] = amount
    idx++
  }
  return params
}

async function createTieredPrice(sh, productId, interval, tiers, key, label) {
  const body = form({
    product: productId,
    currency: 'brl',
    'recurring[interval]': interval,
    'recurring[usage_type]': 'licensed',
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    nickname: `Unidade adicional ${label}`,
    'metadata[addon_slug]': 'unit',
  })
  const tp = tierParams(tiers, key)
  for (const k in tp) body.set(k, String(tp[k]))
  return body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized', detail: 'Envie o token de um super admin.' }, 401)
  const { data: mem } = await admin.from('memberships').select('status, roles!inner(slug)').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  if (mem?.roles?.slug !== 'super_admin') return json({ error: 'forbidden', detail: 'Apenas o super admin pode sincronizar preços.' }, 403)

  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY nos Secrets do Supabase.' }, 200)
  const sh = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }

  let p = {}; try { p = await req.json() } catch { /* padrões */ }
  const dryRun = !!p.dry_run
  const force = !!p.force

  const { data: tiers } = await admin.from('plan_addons').select('*').eq('kind', 'unit').eq('is_active', true)
  if (!tiers?.length) return json({ error: 'no_tiers', detail: 'Nenhuma faixa de unidade em plan_addons.' }, 200)

  const actions = []
  try {
    // 1) produto (reaproveita por metadata addon_slug='unit')
    let productId = null
    try {
      const sr = await fetch(`https://api.stripe.com/v1/products/search?query=${encodeURIComponent("metadata['addon_slug']:'unit'")}`, { headers: sh })
      const sd = await sr.json()
      if (sr.ok && sd.data?.length) productId = sd.data[0].id
    } catch { /* cria abaixo */ }
    if (!productId) {
      if (dryRun) { actions.push('criaria produto Unidade adicional'); productId = '(dry-run)' }
      else {
        const pr = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: sh, body: form({ name: 'Seravie — Unidade adicional', 'metadata[addon_slug]': 'unit', 'metadata[seravie_kind]': 'unit_addon' }) })
        const pd = await pr.json()
        if (!pr.ok) throw new Error(pd?.error?.message || 'erro ao criar produto')
        productId = pd.id; actions.push('produto criado')
      }
    } else { actions.push('produto reaproveitado: ' + productId) }

    // 2) referência do price atual (guardado na faixa base 'unit-2-5')
    const baseRow = tiers.find((t) => t.slug === 'unit-2-5') || tiers[0]
    const existing = baseRow?.stripe_price_id
    const patch = {}
    const out = { product: productId }

    if (existing && !force) {
      actions.push('price já sincronizado (use force para recriar)')
      out.price_monthly = existing
    } else {
      if (dryRun) {
        actions.push('criaria prices graduated (mensal e anual)')
      } else {
        // mensal
        const mBody = await createTieredPrice(sh, productId, 'month', tiers, 'price_monthly', 'mensal')
        const rm = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: sh, body: mBody })
        const md = await rm.json()
        if (!rm.ok) throw new Error(md?.error?.message || 'erro no price mensal')
        out.price_monthly = md.id; actions.push('price mensal criado: ' + md.id)

        // anual
        const yBody = await createTieredPrice(sh, productId, 'year', tiers, 'price_yearly', 'anual')
        const ry = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: sh, body: yBody })
        const yd = await ry.json()
        if (!ry.ok) throw new Error(yd?.error?.message || 'erro no price anual')
        out.price_yearly = yd.id; actions.push('price anual criado: ' + yd.id)

        // arquiva o antigo (mensal), best-effort
        if (existing && existing !== md.id) {
          try { await fetch(`https://api.stripe.com/v1/prices/${existing}`, { method: 'POST', headers: sh, body: form({ active: 'false' }) }) } catch { /* noop */ }
        }
        // grava a referência do price mensal na faixa base
        patch.stripe_price_id = md.id
        await admin.from('plan_addons').update(patch).eq('id', baseRow.id)
      }
    }

    return json({ ok: true, dry_run: dryRun, actions, ...out })
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e), actions }, 200)
  }
})
