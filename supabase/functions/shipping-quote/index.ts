// Edge Function: shipping-quote
// Cotação de frete via Melhor Envio (conta da plataforma). Recebe CEP de origem
// (fornecedor), CEP de destino (comprador) e o pacote (peso/dimensões), e
// devolve as opções de frete disponíveis (transportadora, serviço, preço, prazo).
//
// Segurança: token nos Supabase Secrets (NUNCA no Cloudflare):
//   MELHOR_ENVIO_TOKEN   (Bearer de API do Melhor Envio)
//   MELHOR_ENVIO_BASE    (opcional; default produção. Sandbox:
//                         https://sandbox.melhorenvio.com.br)
// Sem o token, responde { error: 'shipping_not_configured' } e o checkout usa
// os modos manuais (combinado / retirada / grátis).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })
const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "")

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const token = Deno.env.get("MELHOR_ENVIO_TOKEN")
  if (!token) return json({ error: "shipping_not_configured" }, 200)
  const base = Deno.env.get("MELHOR_ENVIO_BASE") || "https://melhorenvio.com.br"

  let payload: Record<string, unknown> = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const from = onlyDigits(payload.from_cep)
  const to = onlyDigits(payload.to_cep)
  if (from.length !== 8 || to.length !== 8) return json({ error: "invalid_cep", detail: "Informe CEP de origem e destino válidos (8 dígitos)." }, 400)

  const pkg = payload.package || {}
  const body = {
    from: { postal_code: from },
    to: { postal_code: to },
    package: {
      weight: Number(pkg.weight) || 1,     // kg
      width: Number(pkg.width) || 15,       // cm
      height: Number(pkg.height) || 15,
      length: Number(pkg.length) || 20,
    },
    options: { receipt: false, own_hand: false, insurance_value: Number(payload.insurance_value) || 0 },
  }

  const r = await fetch(`${base}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Seravie Experiences (contato@seravieexperiences.com)",
    },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) return json({ error: "shipping_error", detail: data?.message || "falha na cotação" }, 400)

  // normaliza a resposta: só opções válidas (sem erro), com preço e prazo
  const options = (Array.isArray(data) ? data : [])
    .filter((o) => o && !o.error && o.price)
    .map((o) => ({
      id: o.id,
      company: o.company?.name || "",
      company_picture: o.company?.picture || null,
      service: o.name,
      price: Number(o.price),
      delivery_days: o.delivery_time ?? o.delivery_range?.max ?? null,
    }))
    .sort((a, b) => a.price - b.price)

  return json({ options })
})
