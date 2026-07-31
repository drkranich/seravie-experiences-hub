// Edge Function: pos-stripe-link
// Gera uma cobrança online (Stripe Checkout Session) para uma venda do PDV.
// Requer o segredo STRIPE_SECRET_KEY configurado no projeto Supabase.
// Sem o segredo, responde { error: 'stripe_not_configured' } para o PDV
// exibir orientação ao usuário (fallback gracioso).

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
  if (!key) return json({ error: 'stripe_not_configured' }, 400)

  let payload = {}
  try { payload = await req.json() } catch { /* corpo vazio */ }
  const amount = Number(payload.amount)
  if (!amount || amount <= 0) return json({ error: 'invalid_amount' }, 400)
  const cents = Math.round(amount * 100)

  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', payload.success_url || 'https://seravie.example/obrigado')
  body.set('cancel_url', payload.cancel_url || 'https://seravie.example/cancelado')
  body.set('line_items[0][quantity]', '1')
  body.set('line_items[0][price_data][currency]', payload.currency || 'brl')
  body.set('line_items[0][price_data][product_data][name]', payload.description || 'Venda PDV')
  body.set('line_items[0][price_data][unit_amount]', String(cents))

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await r.json()
  if (!r.ok) return json({ error: data.error?.message || 'stripe_error' }, 400)
  return json({ url: data.url, id: data.id })
})
