// Edge Function: flow-order
// Cria um pedido do Seravie Flow a partir de um QR (cliente anônimo).
// Valida o ponto pelo code, recalcula preços no servidor, baixa estoque e,
// se o pagamento for cartão e o Stripe estiver ativo, retorna a URL de checkout.
//
// Deploy com verify_jwt = false (o cliente do QR é anônimo). A escrita usa a
// service role, então a RLS de flow_orders é respeitada só no painel do tenant.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const money = (n) => Math.round((Number(n) || 0) * 100) / 100

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(url, service)

  let p = {}
  try { p = await req.json() } catch { /* vazio */ }
  const code = String(p.code || '')
  const items = Array.isArray(p.items) ? p.items : []
  if (!code) return json({ error: 'missing_code' }, 400)
  if (!items.length) return json({ error: 'empty_cart' }, 400)

  const { data: point } = await admin.from('flow_points').select('*').eq('code', code).eq('active', true).single()
  if (!point) return json({ error: 'point_not_found' }, 404)

  // produtos válidos para este ponto (do tenant, ativos, do ponto ou globais)
  const ids = items.map((i) => i.product_id).filter(Boolean)
  const { data: prods } = await admin.from('flow_products').select('*').in('id', ids).eq('tenant_id', point.tenant_id).eq('active', true)
  const byId = Object.fromEntries((prods || []).map((x) => [x.id, x]))

  const lineItems = []
  let subtotal = 0
  for (const it of items) {
    const prod = byId[it.product_id]
    if (!prod) continue
    if (prod.point_id && prod.point_id !== point.id) continue // produto de outro ponto
    const qty = Math.max(1, parseInt(it.qty) || 1)
    const unit = money(prod.promo_price != null && prod.promo_price > 0 ? prod.promo_price : prod.price)
    subtotal += unit * qty
    lineItems.push({ product_id: prod.id, name: prod.name, qty, unit_price: unit, line_total: money(unit * qty), stock: prod.stock })
  }
  if (!lineItems.length) return json({ error: 'no_valid_items' }, 400)

  const tip = money(p.tip)
  const discount = money(p.discount)
  const total = money(subtotal - discount + tip)
  const method = ['pix', 'card', 'manual'].includes(p.payment_method) ? p.payment_method : 'manual'

  const { data: order, error } = await admin.from('flow_orders').insert({
    tenant_id: point.tenant_id,
    point_id: point.id,
    point_name: point.name,
    reference: p.reference || null,
    customer_name: p.customer_name || null,
    items: lineItems,
    subtotal: money(subtotal),
    discount, tip, total,
    coupon: p.coupon || null,
    notes: p.notes || null,
    status: 'pending',
    payment_method: method,
    payment_status: 'pending',
  }).select('id').single()
  if (error) return json({ error: error.message }, 400)

  // baixa de estoque (best-effort; ignora ilimitados)
  for (const li of lineItems) {
    if (li.stock != null) {
      const next = Math.max(0, li.stock - li.qty)
      await admin.from('flow_products').update({ stock: next }).eq('id', li.product_id)
    }
  }

  // auditoria
  try { await admin.from('audit_logs').insert({ tenant_id: point.tenant_id, action: 'create', resource_type: 'flow_orders', resource_id: order.id, new_data: { total, point: point.name } }) } catch { /* noop */ }

  // pagamento por cartão via Stripe (se ativo)
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (method === 'card' && stripeKey && total > 0) {
    const body = new URLSearchParams()
    body.set('mode', 'payment')
    body.set('success_url', `${p.origin || ''}/#flow/${code}?paid=1`)
    body.set('cancel_url', `${p.origin || ''}/#flow/${code}?canceled=1`)
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', 'brl')
    body.set('line_items[0][price_data][product_data][name]', `Pedido ${point.name}`)
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(total * 100)))
    body.set('metadata[flow_order_id]', order.id)
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    const d = await r.json()
    if (r.ok) return json({ order_id: order.id, total, checkout_url: d.url })
  }

  return json({ order_id: order.id, total, payment: method, pending: true })
})
