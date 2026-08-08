// sync-stripe-all — sincroniza EM MASSA todos os planos e módulos pagos com o Stripe.
// Feita para rodar UMA vez no terminal após uma mudança de preços em lote.
//
// Para cada item pago (price_monthly > 0):
//   1) reaproveita (ou cria) o Produto no Stripe (busca por metadata slug);
//   2) se o valor mudou (ou está sem price no banco), cria um NOVO Price
//      (mensal e/ou anual — Prices do Stripe são imutáveis);
//   3) arquiva (active=false) o Price antigo;
//   4) grava stripe_price_monthly/yearly no banco.
// Devolve um relatório com o que foi criado/pulado por item.
//
// Auth: JWT do usuário; só executa se super_admin (roles.slug='super_admin').
// Deploy: verify_jwt=false (valida o usuário internamente).
// Segredo: STRIPE_SECRET_KEY nos Secrets do Supabase (nunca no front/Cloudflare).
//
// Parâmetros opcionais no corpo (JSON):
//   { "dry_run": true }  -> não altera nada; só mostra o que faria.
//   { "force": true }    -> recria os prices mesmo que o valor não tenha mudado.
//   { "only": "plans" | "modules" }  -> limita o escopo.
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
  if (!userData?.user) return json({ error: 'unauthorized', detail: 'Envie o token de acesso de um super admin no header Authorization.' }, 401)
  const { data: mem } = await admin.from('memberships').select('status, roles!inner(slug)').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  if (mem?.roles?.slug !== 'super_admin') return json({ error: 'forbidden', detail: 'Apenas o super admin pode sincronizar preços.' }, 403)

  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY nos Secrets do Supabase.' }, 200)
  const sh = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }

  let p = {}; try { p = await req.json() } catch { /* corpo vazio: usa padrões */ }
  const dryRun = !!p.dry_run
  const force = !!p.force
  const only = p.only === 'plans' || p.only === 'modules' ? p.only : null

  // --- coleta os itens pagos ---
  const targets = []  // { table, kind, metaKey, row }
  if (only !== 'modules') {
    const { data } = await admin.from('plans').select('*').gt('price_monthly', 0)
    ;(data || []).forEach((row) => targets.push({ table: 'plans', kind: 'plan', metaKey: 'plan_slug', row }))
  }
  if (only !== 'plans') {
    const { data } = await admin.from('modules').select('*').gt('price_monthly', 0)
    ;(data || []).forEach((row) => targets.push({ table: 'modules', kind: 'module', metaKey: 'module_slug', row }))
  }

  const results = []
  let created = 0, skipped = 0, errors = 0

  for (const t of targets) {
    const { row, metaKey, kind, table } = t
    const slug = row.slug
    const name = row.name || slug
    const monthly = Number(row.price_monthly) || 0
    const yearly = Number(row.price_yearly) || 0
    const item = { kind, slug, name, monthly, yearly, actions: [] }

    try {
      // 1) produto: reaproveita por metadata, senão cria
      let productId = null
      try {
        const sr = await fetch(`https://api.stripe.com/v1/products/search?query=${encodeURIComponent(`metadata['${metaKey}']:'${slug}'`)}`, { headers: sh })
        const sd = await sr.json()
        if (sr.ok && sd.data?.length) productId = sd.data[0].id
      } catch { /* cria abaixo */ }
      if (!productId) {
        if (dryRun) { item.actions.push('criaria produto'); item.product = '(dry-run)' }
        else {
          const pr = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: sh, body: form({ name, [`metadata[${metaKey}]`]: slug, 'metadata[seravie_kind]': kind }) })
          const pd = await pr.json()
          if (!pr.ok) throw new Error(pd?.error?.message || 'erro ao criar produto')
          productId = pd.id; item.actions.push('produto criado')
        }
      } else { item.product = productId }
      item.product = item.product || productId

      // helper: cria novo price e arquiva o antigo
      const rotate = async (interval, amount, oldPriceId, label) => {
        if (!amount || amount <= 0) return { skipped: true }
        if (dryRun) { item.actions.push(`criaria price ${label} R$${amount}`); return { price_id: '(dry-run)' } }
        const r = await fetch('https://api.stripe.com/v1/prices', {
          method: 'POST', headers: sh,
          body: form({ product: productId, currency: 'brl', unit_amount: Math.round(amount * 100), 'recurring[interval]': interval, nickname: `${slug} ${label}`, [`metadata[${metaKey}]`]: slug }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error?.message || `erro ao criar price ${label}`)
        if (oldPriceId && oldPriceId !== d.id) {
          try { await fetch(`https://api.stripe.com/v1/prices/${oldPriceId}`, { method: 'POST', headers: sh, body: form({ active: 'false' }) }) } catch { /* best-effort */ }
        }
        item.actions.push(`price ${label} criado`)
        return { price_id: d.id }
      }

      const patch = {}
      const monthlyChanged = force || !row.stripe_price_monthly
      const yearlyChanged = force || !row.stripe_price_yearly

      if (monthlyChanged && monthly > 0) {
        const rm = await rotate('month', monthly, row.stripe_price_monthly, 'mensal')
        if (rm.price_id && !dryRun) patch.stripe_price_monthly = rm.price_id
      } else if (monthly > 0) { item.actions.push('mensal já sincronizado') }

      if (yearlyChanged && yearly > 0) {
        const ry = await rotate('year', yearly, row.stripe_price_yearly, 'anual')
        if (ry.price_id && !dryRun) patch.stripe_price_yearly = ry.price_id
      } else if (yearly > 0) { item.actions.push('anual já sincronizado') }

      if (!dryRun && Object.keys(patch).length) {
        await admin.from(table).update(patch).eq('id', row.id)
      }

      if (item.actions.some((a) => a.includes('criado') || a.includes('criaria'))) created++
      else skipped++
      item.ok = true
    } catch (e) {
      item.ok = false; item.error = String(e?.message || e); errors++
    }
    results.push(item)
  }

  return json({
    ok: errors === 0,
    dry_run: dryRun,
    summary: { total: targets.length, created, skipped, errors },
    results,
  })
})
