// Edge Function: melhor-envio-auth
// Gerencia o OAuth do Melhor Envio (conta única da plataforma). Dois modos:
//   POST { action: 'exchange', code, redirect_uri }  -> troca o authorization
//         code pelos tokens (primeira conexão) e salva em integration_tokens.
//   POST { action: 'refresh' }                        -> renova o access_token
//         usando o refresh_token salvo. Retorna { ok, expires_at }.
//   POST { action: 'status' }                         -> diz se há token válido.
//
// Segredos (Supabase Secrets, NUNCA no Cloudflare):
//   ME_CLIENT_ID, ME_CLIENT_SECRET   (aplicação Melhor Envio)
//   MELHOR_ENVIO_BASE (opcional; default produção)
//
// Chamado por um super admin (verify_jwt) para conectar; o refresh também é
// disparado internamente pela shipping-quote quando o token expira.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const clientId = Deno.env.get("ME_CLIENT_ID")
  const clientSecret = Deno.env.get("ME_CLIENT_SECRET")
  const base = Deno.env.get("MELHOR_ENVIO_BASE") || "https://melhorenvio.com.br"
  if (!clientId || !clientSecret) return json({ error: "oauth_not_configured", detail: "Configure ME_CLIENT_ID e ME_CLIENT_SECRET nos Secrets." }, 200)

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  let payload: Record<string, unknown> = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const action = String(payload.action || "status")

  const saveTokens = async (tok: any) => {
    const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 0) * 1000).toISOString()
    await admin.from("integration_tokens").upsert({
      provider: "melhor_envio", access_token: tok.access_token, refresh_token: tok.refresh_token,
      expires_at: expiresAt, updated_at: new Date().toISOString(),
    }, { onConflict: "provider" })
    return expiresAt
  }

  const tokenRequest = (body: Record<string, string>) => fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
  })

  if (action === "exchange") {
    const code = String(payload.code || "")
    const redirect = String(payload.redirect_uri || "")
    if (!code) return json({ error: "missing_code" }, 400)
    const r = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirect })
    const tok = await r.json()
    if (!r.ok || !tok.access_token) return json({ error: "oauth_error", detail: tok?.error_description || tok?.message || "falha" }, 400)
    const expiresAt = await saveTokens(tok)
    return json({ ok: true, expires_at: expiresAt })
  }

  if (action === "refresh") {
    const { data: row } = await admin.from("integration_tokens").select("refresh_token").eq("provider", "melhor_envio").maybeSingle()
    if (!row?.refresh_token) return json({ error: "no_refresh_token", detail: "Conecte a conta do Melhor Envio primeiro." }, 200)
    const r = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token })
    const tok = await r.json()
    if (!r.ok || !tok.access_token) return json({ error: "oauth_error", detail: tok?.error_description || "falha no refresh" }, 400)
    const expiresAt = await saveTokens(tok)
    return json({ ok: true, expires_at: expiresAt })
  }

  // status
  const { data: row } = await admin.from("integration_tokens").select("expires_at, access_token").eq("provider", "melhor_envio").maybeSingle()
  const connected = !!row?.access_token
  const valid = connected && row?.expires_at && new Date(row.expires_at).getTime() > Date.now()
  return json({ connected, valid, expires_at: row?.expires_at || null })
})
