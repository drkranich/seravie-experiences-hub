// social-publish — publica um post nas redes conectadas do tenant.
// Recebe { post_id }. Lê o post em social_posts, e para cada rede em `networks`
// busca o token do tenant em social_credentials (protegida) e chama a API da rede.
// Segurança: valida o JWT do chamador e confere que o post é do mesmo tenant do
// usuário (via get_my_tenant_id não está disponível aqui, então checamos pelo
// membership do usuário autenticado). Tokens nunca voltam ao cliente.
// Deploy com verify_jwt=true (precisa do usuário logado).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// --- publicadores por rede (mínimo viável; expanda conforme apps aprovados) ---
async function publishFacebook(cred, post) {
  const pageId = cred.external_account_id
  if (!pageId) return { status: 'error', error: 'sem página vinculada' }
  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`
  const body = new URLSearchParams({ message: post.content || post.title || '', access_token: cred.access_token })
  const r = await fetch(url, { method: 'POST', body })
  const j = await r.json()
  return j.id ? { status: 'success', external_id: j.id } : { status: 'error', error: j.error?.message || 'falha' }
}
async function publishInstagram(cred, post) {
  const igId = cred.external_account_id
  if (!igId || !post.media_url) return { status: 'error', error: 'Instagram exige conta IG e imagem' }
  // 1) cria container 2) publica
  const c = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, { method: 'POST', body: new URLSearchParams({ image_url: post.media_url, caption: post.content || '', access_token: cred.access_token }) })
  const cj = await c.json()
  if (!cj.id) return { status: 'error', error: cj.error?.message || 'falha ao criar mídia' }
  const p = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: cj.id, access_token: cred.access_token }) })
  const pj = await p.json()
  return pj.id ? { status: 'success', external_id: pj.id } : { status: 'error', error: pj.error?.message || 'falha ao publicar' }
}
async function publishLinkedIn(cred, post) {
  // requer URN do autor; guardado em external_account_id como 'urn:li:person:xxx' ou org
  const author = cred.external_account_id
  if (!author) return { status: 'error', error: 'sem autor LinkedIn' }
  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST', headers: { Authorization: `Bearer ${cred.access_token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({ author, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: post.content || post.title || '' }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } }),
  })
  if (r.status >= 200 && r.status < 300) return { status: 'success' }
  const j = await r.json().catch(() => ({}))
  return { status: 'error', error: j.message || `http_${r.status}` }
}
async function publishPinterest(cred, post) {
  if (!post.media_url) return { status: 'error', error: 'Pinterest exige imagem' }
  const board = cred.meta?.board_id
  if (!board) return { status: 'error', error: 'sem board selecionado' }
  const r = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST', headers: { Authorization: `Bearer ${cred.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_id: board, title: post.title || '', description: post.content || '', media_source: { source_type: 'image_url', url: post.media_url } }),
  })
  const j = await r.json()
  return j.id ? { status: 'success', external_id: j.id } : { status: 'error', error: j.message || 'falha' }
}
async function publishTikTok() { return { status: 'skipped', error: 'TikTok requer fluxo de vídeo (Content Posting API)' } }

const PUBLISHERS = { facebook: publishFacebook, instagram: publishInstagram, linkedin: publishLinkedIn, pinterest: publishPinterest, tiktok: publishTikTok }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  // identifica o usuário pelo JWT e descobre o tenant dele
  const authz = req.headers.get('Authorization') || ''
  const jwt = authz.replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  const p = await req.json().catch(() => ({}))
  const postId = p.post_id
  if (!postId) return json({ error: 'missing_post_id' }, 400)

  const { data: post } = await admin.from('social_posts').select('*').eq('id', postId).eq('tenant_id', tenantId).maybeSingle()
  if (!post) return json({ error: 'post_not_found' }, 404)

  const results = {}
  for (const network of (post.networks || [])) {
    const { data: cred } = await admin.from('social_credentials').select('*').eq('tenant_id', tenantId).eq('network', network).maybeSingle()
    if (!cred?.access_token) { results[network] = { status: 'error', error: 'rede não conectada' }; continue }
    const fn = PUBLISHERS[network]
    if (!fn) { results[network] = { status: 'skipped', error: 'rede não suportada' }; continue }
    try { results[network] = await fn(cred, post) } catch (e) { results[network] = { status: 'error', error: String(e?.message || e) } }
  }

  const anyOk = Object.values(results).some((r) => r.status === 'success')
  await admin.from('social_posts').update({ status: anyOk ? 'published' : post.status, updated_at: new Date().toISOString(), meta: { publish: results } }).eq('id', postId)
  return json({ ok: true, results })
})
