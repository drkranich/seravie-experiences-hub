// Edge Function: stripe-connect-onboard
// Onboarding do Stripe Connect por tenant (modelo marketplace).
// Cria (ou reutiliza) a conta conectada do tenant e devolve um link de
// onboarding do Stripe. Ao concluir, o tenant recebe pagamentos direto na
// conta dele e a plataforma retém uma comissão (application_fee) por transação.
//
// Segurança: usa STRIPE_SECRET_KEY (plataforma) dos Secrets do Supabase.
// Requer SERVICE ROLE para gravar tenants.stripe_account_id.
//
// POST { tenant_id, return_url, refresh_url }  -> { url }  (link de onboarding)
//   ou { status: true }  quando já concluído (charges_enabled)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const key = Deno.env.get("STRIPE_SECRET_KEY")
  if (!key) return json({ error: "stripe_not_configured" }, 200)

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  let payload: Record<string, unknown> = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const tenantId = String(payload.tenant_id || "")
  if (!tenantId) return json({ error: "missing_tenant" }, 400)

  const stripe = (path: string, body?: URLSearchParams, method = "POST") => fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  // carrega o tenant
  const { data: tenant } = await admin.from("tenants").select("id, stripe_account_id, name").eq("id", tenantId).maybeSingle()
  if (!tenant) return json({ error: "tenant_not_found" }, 404)

  let acctId = tenant.stripe_account_id as string | null

  // cria a conta conectada (Express) se ainda não existir
  if (!acctId) {
    const b = new URLSearchParams()
    b.set("type", "express")
    b.set("country", "BR")
    b.set("capabilities[card_payments][requested]", "true")
    b.set("capabilities[transfers][requested]", "true")
    b.set("business_profile[name]", String(tenant.name || "Seravie"))
    const r = await stripe("accounts", b)
    const acct = await r.json()
    if (!r.ok) return json({ error: "stripe_error", detail: acct?.error?.message }, 400)
    acctId = acct.id
    await admin.from("tenants").update({ stripe_account_id: acctId }).eq("id", tenantId)
  }

  // verifica status atual da conta
  const ar = await stripe(`accounts/${acctId}`, undefined, "GET")
  const acct = await ar.json()
  const chargesEnabled = !!acct.charges_enabled
  const detailsSubmitted = !!acct.details_submitted
  await admin.from("tenants").update({ stripe_charges_enabled: chargesEnabled, stripe_details_submitted: detailsSubmitted }).eq("id", tenantId)

  if (chargesEnabled) return json({ status: true, charges_enabled: true, account_id: acctId })

  // gera o link de onboarding
  const lb = new URLSearchParams()
  lb.set("account", acctId!)
  lb.set("type", "account_onboarding")
  lb.set("return_url", String(payload.return_url || "https://seravieexperiences.com"))
  lb.set("refresh_url", String(payload.refresh_url || payload.return_url || "https://seravieexperiences.com"))
  const lr = await stripe("account_links", lb)
  const link = await lr.json()
  if (!lr.ok) return json({ error: "stripe_error", detail: link?.error?.message }, 400)
  return json({ url: link.url, account_id: acctId, charges_enabled: false })
})
