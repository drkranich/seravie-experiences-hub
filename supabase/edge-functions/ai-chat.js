// ai-chat — Seravie AI real, com contexto do tenant. Chama um LLM (Anthropic
// por padrão; OpenAI se configurado). Fallback gracioso: sem chave, orienta a
// configurar em vez de fingir. Secrets: ANTHROPIC_API_KEY (ou OPENAI_API_KEY).
// Deploy: verify_jwt=false (valida o usuário internamente via getUser).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const question = String(p.message || '').slice(0, 2000)
  if (!question) return json({ error: 'empty' }, 400)

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!anthropicKey && !openaiKey) {
    return json({ reply: 'A Seravie AI ainda não está conectada. Configure o segredo ANTHROPIC_API_KEY (ou OPENAI_API_KEY) nas Edge Functions para ativar respostas reais com base nos seus dados.', configured: false })
  }

  const [{ data: orders }, { data: lowStock }] = await Promise.all([
    admin.from('orders').select('total,created_at,status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    admin.from('products').select('name,stock,min_stock').eq('tenant_id', tenantId).not('min_stock', 'is', null).limit(200),
  ])
  const revenue = (orders || []).filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0)
  const low = (lowStock || []).filter((x) => x.stock != null && x.min_stock != null && x.stock <= x.min_stock).map((x) => x.name)
  const ctx = `Contexto do negócio: faturamento recente (últimos 50 pedidos) R$ ${revenue.toFixed(2)}; ${(orders || []).length} pedidos recentes; itens com estoque baixo: ${low.slice(0, 10).join(', ') || 'nenhum'}.`
  const system = `Você é a Seravie AI, assistente de gestão para negócios de experiência (varejo, food, franquias). Responda em português do Brasil, de forma prática e breve, usando o contexto quando útil. ${ctx}`

  try {
    if (anthropicKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 700, system, messages: [{ role: 'user', content: question }] }) })
      const d = await r.json()
      return json({ reply: d?.content?.[0]?.text || 'Não consegui responder agora.', configured: true })
    }
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 700, messages: [{ role: 'system', content: system }, { role: 'user', content: question }] }) })
    const d = await r.json()
    return json({ reply: d?.choices?.[0]?.message?.content || 'Não consegui responder agora.', configured: true })
  } catch (e) {
    return json({ error: 'ai_error', detail: String(e?.message || e) }, 502)
  }
})
