// suppliers-ai — IA de Compras do Seravie Suppliers.
//
// Responde perguntas de compra (o que comprar, melhor fornecedor/preço/prazo,
// risco de ruptura, produto equivalente, tendências) usando os DADOS REAIS do
// marketplace (fornecedores publicados, produtos, RFQs) como contexto.
//
// BYO chave (mesmo padrão do ai-chat): usa ANTHROPIC_API_KEY ou OPENAI_API_KEY
// dos Secrets. Sem chave, devolve um fallback heurístico útil (não "finge" IA).
//
// Corpo: { question, category? }  |  Auth: JWT do usuário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// ranqueia fornecedores por um score simples (avaliação + homologação + prazo)
const LEVEL_RANK = { bronze: 1, prata: 2, ouro: 3, platinum: 4, signature: 5 }
const days = (t) => { const m = String(t || '').match(/\d+/); return m ? Number(m[0]) : 999 }
function scoreSupplier(s) {
  return (Number(s.rating) || 0) * 2 + (LEVEL_RANK[s.verification_level] || 0) - days(s.lead_time) / 60
}

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
  const question = (p.question || '').trim()
  const category = p.category || null
  if (!question) return json({ error: 'missing_question' }, 400)

  // contexto real: fornecedores publicados (+ filtro de categoria), produtos, RFQs do tenant
  let supQ = admin.from('suppliers').select('name,category,city,state,rating,verification_level,lead_time,min_order,specialties,years_market,projects_count').in('status', ['published', 'active', 'open']).limit(60)
  if (category) supQ = supQ.eq('category', category)
  const [{ data: suppliers }, { data: products }, { data: rfqs }] = await Promise.all([
    supQ,
    admin.from('supplier_products').select('name,category,price,unit').eq('status', 'active').limit(80),
    admin.from('rfqs').select('title,category,status,budget').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
  ])

  const ranked = (suppliers || []).map((s) => ({ ...s, _score: scoreSupplier(s) })).sort((a, b) => b._score - a._score)
  const top = ranked.slice(0, 8).map((s) => `- ${s.name} (${s.category}, ${s.city || 's/ cidade'}, ${s.verification_level}, nota ${Number(s.rating || 0).toFixed(1)}, prazo ${s.lead_time || 'n/d'})`).join('\n')
  const prodCtx = (products || []).slice(0, 20).map((p2) => `- ${p2.name}${p2.price ? ` (R$ ${Number(p2.price).toFixed(2)}${p2.unit ? '/' + p2.unit : ''})` : ''}`).join('\n')

  const ctx = `Fornecedores homologados${category ? ` na categoria "${category}"` : ''} (ranqueados por nota, homologação e prazo):\n${top || 'nenhum'}\n\nProdutos disponíveis:\n${prodCtx || 'nenhum'}\n\nCotações recentes do comprador: ${(rfqs || []).length}.`
  const system = `Você é a IA de Compras da Seravie Suppliers, um marketplace B2B de fornecedores homologados. Ajude o comprador a decidir: o que comprar, qual fornecedor, melhor preço/prazo/logística, produto equivalente, risco de ruptura e tendências. Responda em português do Brasil, de forma prática, objetiva e com recomendações concretas baseadas SOMENTE no contexto abaixo. Se faltar dado, diga o que falta. \n\n${ctx}`

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  // Fallback heurístico (sem IA generativa conectada): já entrega recomendação real.
  if (!anthropicKey && !openaiKey) {
    const rec = ranked.slice(0, 3).map((s, i) => `${i + 1}. ${s.name} — ${s.category}, nota ${Number(s.rating || 0).toFixed(1)}, ${s.verification_level}, prazo ${s.lead_time || 'n/d'}`).join('\n')
    return json({
      configured: false,
      reply: `A IA generativa ainda não está conectada (configure ANTHROPIC_API_KEY ou OPENAI_API_KEY nos Secrets). Enquanto isso, com base nos dados do marketplace, os fornecedores mais recomendados${category ? ' nesta categoria' : ''} são:\n\n${rec || 'nenhum fornecedor encontrado'}\n\nCritério: melhor combinação de avaliação, homologação Seravie e prazo de entrega.`,
      ranked: ranked.slice(0, 5).map((s) => ({ name: s.name, category: s.category, rating: s.rating, level: s.verification_level, lead_time: s.lead_time })),
    })
  }

  try {
    if (anthropicKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 900, system, messages: [{ role: 'user', content: question }] }) })
      const d = await r.json()
      return json({ configured: true, reply: d?.content?.[0]?.text || 'Não consegui responder agora.', ranked: ranked.slice(0, 5).map((s) => ({ name: s.name, rating: s.rating, level: s.verification_level })) })
    }
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 900, messages: [{ role: 'system', content: system }, { role: 'user', content: question }] }) })
    const d = await r.json()
    return json({ configured: true, reply: d?.choices?.[0]?.message?.content || 'Não consegui responder agora.', ranked: ranked.slice(0, 5).map((s) => ({ name: s.name, rating: s.rating, level: s.verification_level })) })
  } catch (e) {
    return json({ error: 'ai_error', detail: String(e?.message || e) }, 502)
  }
})
