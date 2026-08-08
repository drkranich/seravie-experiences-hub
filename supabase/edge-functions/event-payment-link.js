// Edge Function: event-payment-link
// Gera um LINK DE PAGAMENTO (Stripe Payment Link) para um evento pago do Network.
// O criador do evento gera o link e compartilha com os inscritos.
// Segurança: usa STRIPE_SECRET_KEY dos Supabase Secrets (nunca no Cloudflare).
// Sem o segredo, responde { error: 'stripe_not_configured' } (fallback gracioso).
//
// POST { event_id, amount, title, currency?, quantity_adjustable?, success_url? }
// -> { url, id }  (url = link de pagamento reutilizável)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'stripe_not_configured', detail: 'Configure STRIPE_SECRET_KEY nos Secrets do Supabase para gerar links de pagamento.' }, 200)

  let payload = {}
  try { payload = await req.json() } catch { /* corpo vazio */ }
  const amount = Number(payload.amount)
  if (!amount || amount <= 0) return json({ error: 'invalid_amount' }, 400)
  const cents = Math.round(amount * 100)
  const currency = (payload.currency || 'brl').toLowerCase()
  const name = payload.title || 'Ingresso de evento'

  const stripe = (path, body) => fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  // 1) cria (ou reutiliza) um Price efêmero para o valor do ingresso
  const priceBody = new URLSearchParams()
  priceBody.set('currency', currency)
  priceBody.set('unit_amount', String(cents))
  priceBody.set('product_data[name]', name)
  const pr = await stripe('prices', priceBody)
  const price = await pr.json()
  if (!pr.ok) return json({ error: 'stripe_error', detail: price?.error?.message }, 400)

  // 2) cria o Payment Link reutilizável
  const linkBody = new URLSearchParams()
  linkBody.set('line_items[0][price]', price.id)
  linkBody.set('line_items[0][quantity]', '1')
  if (payload.quantity_adjustable) linkBody.set('line_items[0][adjustable_quantity][enabled]', 'true')
  if (payload.event_id) linkBody.set('metadata[event_id]', String(payload.event_id))
  if (payload.tenant_id) linkBody.set('metadata[tenant_id]', String(payload.tenant_id))
  if (payload.success_url) {
    linkBody.set('after_completion[type]', 'redirect')
    linkBody.set('after_completion[redirect][url]', payload.success_url)
  }
  const lr = await stripe('payment_links', linkBody)
  const link = await lr.json()
  if (!lr.ok) return json({ error: 'stripe_error', detail: link?.error?.message }, 400)

  return json({ url: link.url, id: link.id })
})
