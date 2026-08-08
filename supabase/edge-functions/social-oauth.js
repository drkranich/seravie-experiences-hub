// social-oauth — fluxo OAuth de redes sociais, MULTI-TENANT.
// Cada empresa (tenant) conecta a PRÓPRIA conta. Nenhum token passa pelo painel:
// o usuário clica "Conectar", faz login na rede, e esta function troca o code
// pelo access_token e grava em public.social_credentials (tabela protegida,
// legível apenas por service_role). O front nunca vê o token.
//
// Rotas (via querystring ?action=):
//   ?action=start&network=<rede>&tenant=<uuid>&redirect=<url>   -> 302 p/ a rede
//   (callback configurado no app da plataforma) ?action=callback&code=..&state=..
//
// Segredos por plataforma (Supabase Secrets) — configure os que for usar:
//   META_APP_ID / META_APP_SECRET            (Instagram + Facebook)
//   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
//   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
//   PINTEREST_APP_ID / PINTEREST_APP_SECRET
//   OAUTH_REDIRECT_BASE   (ex: https://<ref>.functions.supabase.co/social-oauth)
// Deploy com verify_jwt=false (o callback vem da rede, sem JWT).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const redirect = (url) => new Response(null, { status: 302, headers: { ...cors, Location: url } })
const htmlClose = (msg) => new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#121512;color:#DCCBA7;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h2>${msg}</h2><p style="color:#888">Você já pode fechar esta janela.</p><script>try{window.opener&&window.opener.postMessage({seravieSocial:true},'*')}catch(e){}setTimeout(()=>window.close(),1200)</script></div></body>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

const REDIRECT_BASE = () => Deno.env.get('OAUTH_REDIRECT_BASE') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth`
const callbackUri = () => `${REDIRECT_BASE()}?action=callback`

// ---- Config por rede: URL de autorização, endpoint de token e escopos ----
const NETWORKS = {
  facebook: {
    provider: 'meta', idEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'pages_show_list,pages_manage_posts,pages_read_engagement',
  },
  instagram: {
    provider: 'meta', idEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list',
  },
  tiktok: {
    provider: 'tiktok', idEnv: 'TIKTOK_CLIENT_KEY', secretEnv: 'TIKTOK_CLIENT_SECRET',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,video.publish',
  },
  linkedin: {
    provider: 'linkedin', idEnv: 'LINKEDIN_CLIENT_ID', secretEnv: 'LINKEDIN_CLIENT_SECRET',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'w_member_social r_liteprofile',
  },
  pinterest: {
    provider: 'pinterest', idEnv: 'PINTEREST_APP_ID', secretEnv: 'PINTEREST_APP_SECRET',
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scope: 'boards:read,pins:read,pins:write',
  },
}

function randomState() {
  const a = new Uint8Array(24); crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const url = new URL(req.url)
  // aceita action pela querystring (GET/redirect) ou pelo corpo (POST via invoke)
  let bodyJson = null
  if (req.method === 'POST') { try { bodyJson = await req.clone().json() } catch { /* vazio */ } }
  const action = url.searchParams.get('action') || bodyJson?.action || 'start'

  try {
    // ---------- START: cria state e redireciona à rede ----------
    if (action === 'start') {
      const network = url.searchParams.get('network')
      const tenant = url.searchParams.get('tenant')
      const redirectTo = url.searchParams.get('redirect') || ''
      const cfg = NETWORKS[network]
      if (!cfg) return json({ error: 'unknown_network' }, 400)
      if (!tenant) return json({ error: 'missing_tenant' }, 400)
      const clientId = Deno.env.get(cfg.idEnv)
      if (!clientId) return json({ error: `missing_secret:${cfg.idEnv}`, hint: 'Configure o app desta rede nos Secrets do Supabase.' }, 400)

      const state = randomState()
      await admin.from('social_oauth_states').insert({ state, tenant_id: tenant, network, redirect_to: redirectTo })

      const p = new URLSearchParams()
      // parâmetros comuns; algumas redes usam nomes diferentes de client_id
      if (cfg.provider === 'tiktok') p.set('client_key', clientId); else p.set('client_id', clientId)
      p.set('redirect_uri', callbackUri())
      p.set('response_type', 'code')
      p.set('scope', cfg.scope)
      p.set('state', state)
      return redirect(`${cfg.authUrl}?${p.toString()}`)
    }

    // ---------- CALLBACK: troca code por token e salva ----------
    if (action === 'callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (!code || !state) return htmlClose('Autorização incompleta')
      const { data: st } = await admin.from('social_oauth_states').select('*').eq('state', state).maybeSingle()
      if (!st) return htmlClose('Sessão de conexão expirada')
      const cfg = NETWORKS[st.network]
      const clientId = Deno.env.get(cfg.idEnv)
      const clientSecret = Deno.env.get(cfg.secretEnv)

      // troca do code pelo token (form-urlencoded na maioria das redes)
      const body = new URLSearchParams()
      if (cfg.provider === 'tiktok') { body.set('client_key', clientId); body.set('client_secret', clientSecret) }
      else { body.set('client_id', clientId); body.set('client_secret', clientSecret) }
      body.set('code', code)
      body.set('grant_type', 'authorization_code')
      body.set('redirect_uri', callbackUri())

      let tokenRes, tok
      try {
        tokenRes = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
        tok = await tokenRes.json()
      } catch (e) { return htmlClose('Falha ao obter token') }
      const accessToken = tok.access_token || tok.data?.access_token
      if (!accessToken) return htmlClose('A rede não retornou um token')

      // upsert das credenciais do tenant (tabela protegida)
      await admin.from('social_credentials').upsert({
        tenant_id: st.tenant_id, network: st.network,
        access_token: accessToken,
        refresh_token: tok.refresh_token || tok.data?.refresh_token || null,
        token_expires_at: tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString() : null,
        scope: cfg.scope, meta: { provider: cfg.provider }, updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,network' })

      // marca a conexão pública (sem segredo) como conectada
      await admin.from('social_connections').upsert({
        tenant_id: st.tenant_id, network: st.network, status: 'connected', provider: cfg.provider,
        connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,network' })

      // limpa o state usado
      await admin.from('social_oauth_states').delete().eq('id', st.id)
      return htmlClose('Conta conectada com sucesso ✓')
    }

    // ---------- DISCONNECT: apaga token do tenant ----------
    if (action === 'disconnect') {
      const p = bodyJson || {}
      if (!p.tenant || !p.network) return json({ error: 'missing_params' }, 400)
      await admin.from('social_credentials').delete().eq('tenant_id', p.tenant).eq('network', p.network)
      await admin.from('social_connections').update({ status: 'disconnected', connected_at: null, updated_at: new Date().toISOString() }).eq('tenant_id', p.tenant).eq('network', p.network)
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
