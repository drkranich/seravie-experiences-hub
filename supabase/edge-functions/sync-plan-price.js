// sync-plan-price — mantém o Stripe em sincronia quando o super admin muda o preço
// de um plano (plans) ou de um módulo (modules) no painel.
//
// Preços do Stripe são IMUTÁVEIS. Então, ao mudar o valor:
//   1) reaproveita (ou cria) o Produto no Stripe (busca por metadata slug);
//   2) cria um NOVO Price para o novo valor (mensal e/ou anual);
//   3) arquiva (active=false) o Price antigo, se existir;
//   4) grava os novos stripe_price_monthly/yearly no banco.
//
// Auth: JWT do usuário; só executa se ele for super_admin (roles.slug='super_admin').
// Deploy: verify_jwt=false (valida o usuário internamente).
// Segredo: STRIPE_SECRET_KEY fica nos Secrets do Supabase (nunca no front/Cloudflare).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const form = (o) => { const b = new URLSearchParams(); for (const k in o) if (o[k] !== undefined && o[k] !== null) b.set(k, String(o[k])); return b }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  // --- autenticação: precisa ser super admin ---
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin
    .from('memberships')
    .select('status, roles!inner(slug)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (mem?.roles?.slug !== 'super_admin') return json({ error: 'forbidden', detail: 'Apenas o super admin pode sincronizar preços.' }, 403)

  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY nos Secrets do Supabase.' }, 200)
  const sh = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const kind = p.kind === 'module' ? 'module' : 'plan'  // 'plan' | 'module'
  const table = kind === 'module' ? 'modules' : 'plans'
  const id = p.id
  if (!id) return json({ error: 'missing_id' }, 400)

  const { data: row, error: rowErr } = await admin.from(table).select('*').eq('id', id).maybeSingle()
  if (rowErr || !row) return json({ error: 'not_found' }, 404)

  const monthly = Number(p.price_monthly ?? row.price_monthly) || 0
  const yearly = Number(p.price_yearly ?? row.price_yearly) || 0
  const slug = row.slug
  const name = row.name || slug

  // --- 1) produto: reaproveita por metadata module_slug/plan_slug, senão cria ---
  const metaKey = kind === 'module' ? 'module_slug' : 'plan_slug'
  let productId = null
  try {
    const sr = await fetch(`https://api.stripe.com/v1/products/search?query=${encodeURIComponent(`metadata['${metaKey}']:'${slug}'`)}`, { headers: sh })
    const sd = await sr.json()
    if (sr.ok && sd.data?.length) productId = sd.data[0].id
  } catch { /* ignora e cria abaixo */ }
  if (!productId) {
    const pr = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: sh, body: form({ name, [`metadata[${metaKey}]`]: slug, 'metadata[seravie_kind]': kind }) })
    const pd = await pr.json()
    if (!pr.ok) return json({ error: 'stripe_product_error', detail: pd?.error?.message }, 400)
    productId = pd.id
  }

  // helper: cria novo price e arquiva o antigo
  const rotate = async (interval, amount, oldPriceId) => {
    if (!amount || amount <= 0) return { price_id: null, skipped: true }
    const r = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST', headers: sh,
      body: form({ product: productId, currency: 'brl', unit_amount: Math.round(amount * 100), 'recurring[interval]': interval, nickname: `${slug} ${interval === 'year' ? 'anual' : 'mensal'}`, [`metadata[${metaKey}]`]: slug }),
    })
    const d = await r.json()
    if (!r.ok) return { error: d?.error?.message }
    // arquiva o price antigo (não deleta — Stripe não permite deletar price com histórico)
    if (oldPriceId && oldPriceId !== d.id) {
      try { await fetch(`https://api.stripe.com/v1/prices/${oldPriceId}`, { method: 'POST', headers: sh, body: form({ active: 'false' }) }) } catch { /* best-effort */ }
    }
    return { price_id: d.id }
  }

  const patch = {}
  const out = { kind, slug, product: productId }

  // só rotaciona o ciclo cujo valor realmente mudou (ou se forçado)
  const monthlyChanged = p.force || Number(row.price_monthly) !== monthly || !row.stripe_price_monthly
  const yearlyChanged = p.force || Number(row.price_yearly) !== yearly || !row.stripe_price_yearly

  if (monthlyChanged) {
    const rm = await rotate('month', monthly, row.stripe_price_monthly)
    if (rm.error) return json({ error: 'stripe_price_error', detail: rm.error }, 400)
    if (rm.price_id) { patch.stripe_price_monthly = rm.price_id; out.stripe_price_monthly = rm.price_id }
  }
  if (yearlyChanged) {
    const ry = await rotate('year', yearly, row.stripe_price_yearly)
    if (ry.error) return json({ error: 'stripe_price_error', detail: ry.error }, 400)
    if (ry.price_id) { patch.stripe_price_yearly = ry.price_id; out.stripe_price_yearly = ry.price_id }
  }

  // grava também os valores em reais (garante consistência banco <-> stripe)
  patch.price_monthly = monthly
  patch.price_yearly = yearly

  const { error: upErr } = await admin.from(table).update(patch).eq('id', id)
  if (upErr) return json({ error: 'db_update_failed', detail: upErr.message }, 400)

  // se for plano com módulos espelhando (module avulso), nada extra; retorna resultado
  return json({ ok: true, ...out, updated: patch })
})
