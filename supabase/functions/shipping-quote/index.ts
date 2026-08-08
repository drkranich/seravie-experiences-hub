// Edge Function: shipping-quote
// Cotação de frete via Melhor Envio (conta da plataforma). Usa o token OAuth
// salvo em integration_tokens e o RENOVA automaticamente quando expira
// (refresh_token). Recebe CEP de origem (fornecedor), CEP de destino
// (comprador) e o pacote (peso/dimensões); devolve as opções de frete.
//
// Segredos (Supabase Secrets, NUNCA no Cloudflare):
//   ME_CLIENT_ID, ME_CLIENT_SECRET   (aplicação Melhor Envio, para o refresh)
//   MELHOR_ENVIO_BASE (opcional; default produção)
//   MELHOR_ENVIO_TOKEN (opcional; fallback estático se não houver OAuth salvo)
//
// Sem token válido -> { error: 'shipping_not_configured' }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })
const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "")

const base = Deno.env.get("MELHOR_ENVIO_BASE") || "https://melhorenvio.com.br"

async function getValidToken(admin: any): Promise<string | null> {
  const { data: row } = await admin.from("integration_tokens").select("*").eq("provider", "melhor_envio").maybeSingle()
  // sem OAuth salvo → tenta token estático dos secrets (compat.)
  if (!row?.access_token) return Deno.env.get("MELHOR_ENVIO_TOKEN") || null

  const notExpired = row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000
  if (notExpired) return row.access_token

  // expirado → refresh
  const clientId = Deno.env.get("ME_CLIENT_ID")
  const clientSecret = Deno.env.get("ME_CLIENT_SECRET")
  if (!clientId || !clientSecret || !row.refresh_token) return row.access_token // sem como renovar; tenta o que tem
  const r = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: row.refresh_token, client_id: clientId, client_secret: clientSecret }),
  })
  const tok = await r.json()
  if (!r.ok || !tok.access_token) return row.access_token
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 0) * 1000).toISOString()
  await admin.from("integration_tokens").upsert({ provider: "melhor_envio", access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "provider" })
  return tok.access_token
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const token = await getValidToken(admin)
  if (!token) return json({ error: "shipping_not_configured" }, 200)

  let payload: Record<string, unknown> = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const from = onlyDigits(payload.from_cep)
  const to = onlyDigits(payload.to_cep)
  if (from.length !== 8 || to.length !== 8) return json({ error: "invalid_cep", detail: "Informe CEP de origem e destino válidos (8 dígitos)." }, 400)

  const pkg = (payload.package || {}) as Record<string, unknown>
  const body = {
    from: { postal_code: from },
    to: { postal_code: to },
    package: {
      weight: Number(pkg.weight) || 1,
      width: Number(pkg.width) || 15,
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
