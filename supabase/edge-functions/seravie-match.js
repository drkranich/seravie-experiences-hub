// seravie-match — o conector: a partir de um PROJETO/segmento, monta o ecossistema
// completo de parceiros compatíveis, cruzando Suppliers (fornecedores) e Network
// (profissionais). Ex.: uma chocolateria → arquiteto + iluminação + mobiliário +
// embalagens + fotógrafo + branding + logística.
//
// Heurístico sempre (mapa segmento→categorias/papéis + ranqueamento por
// nota/homologação). Se ANTHROPIC_API_KEY/OPENAI_API_KEY existir, enriquece com
// uma síntese/justificativa gerada.
//
// Corpo: { segment?, need?, project_name? }  |  Auth: JWT do usuário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// blueprint por segmento: categorias de fornecedor + papéis de profissional
const BLUEPRINT = {
  cafeteria: { cats: ['mobiliario', 'iluminacao', 'louças', 'cafe', 'uniformes', 'comunicacao_visual', 'aromatizacao', 'embalagens', 'logistica'], roles: ['Arquiteto', 'Designer', 'Fotógrafo', 'Consultor'] },
  chocolateria: { cats: ['mobiliario', 'iluminacao', 'embalagens', 'chocolate', 'comunicacao_visual', 'grafica', 'aromatizacao', 'logistica'], roles: ['Arquiteto', 'Designer', 'Fotógrafo', 'Consultor'] },
  hotel: { cats: ['mobiliario', 'iluminacao', 'paisagismo', 'aromatizacao', 'uniformes', 'decoracao', 'tecnologia', 'louças'], roles: ['Arquiteto', 'Designer', 'Consultor'] },
  floricultura: { cats: ['paisagismo', 'embalagens', 'mobiliario', 'comunicacao_visual', 'aromatizacao'], roles: ['Designer', 'Fotógrafo'] },
  vinicola: { cats: ['mobiliario', 'iluminacao', 'vinho', 'decoracao', 'louças', 'logistica'], roles: ['Arquiteto', 'Consultor'] },
  boutique: { cats: ['mobiliario', 'iluminacao', 'uniformes', 'comunicacao_visual', 'aromatizacao', 'embalagens'], roles: ['Arquiteto', 'Designer', 'Fotógrafo'] },
}
const LEVEL_RANK = { bronze: 1, prata: 2, ouro: 3, platinum: 4, signature: 5 }
const score = (s) => (Number(s.rating) || 0) * 2 + (LEVEL_RANK[s.verification_level] || 0)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  if (!mem?.tenant_id) return json({ error: 'no_tenant' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const segment = (p.segment || '').toLowerCase()
  const bp = BLUEPRINT[segment] || { cats: ['mobiliario', 'iluminacao', 'comunicacao_visual'], roles: ['Arquiteto', 'Designer'] }

  // fornecedores por categoria do blueprint (melhores primeiro)
  const { data: sup } = await admin.from('suppliers').select('id,name,category,city,state,rating,verification_level,lead_time,logo_url,cover_url')
    .in('status', ['published', 'active', 'open']).in('category', bp.cats).limit(200)
  const byCat = {}
  for (const cat of bp.cats) {
    const list = (sup || []).filter((s) => s.category === cat).sort((a, b) => score(b) - score(a)).slice(0, 3)
    if (list.length) byCat[cat] = list
  }

  // profissionais por papel do blueprint
  const { data: members } = await admin.from('network_members').select('id,name,role_title,headline,avatar_url,rating,verification_level,city')
    .eq('status', 'active').in('role_title', bp.roles).limit(100)
  const byRole = {}
  for (const role of bp.roles) {
    const list = (members || []).filter((m) => m.role_title === role).sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, 3)
    if (list.length) byRole[role] = list
  }

  const supplierCount = Object.values(byCat).reduce((s, l) => s + l.length, 0)
  const memberCount = Object.values(byRole).reduce((s, l) => s + l.length, 0)

  // síntese textual (IA opcional)
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  let summary = `Ecossistema montado para ${p.project_name || segment || 'seu projeto'}: ${supplierCount} fornecedores em ${Object.keys(byCat).length} categorias e ${memberCount} profissionais. Priorizamos maior avaliação e homologação Seravie.`
  if (anthropicKey || openaiKey) {
    try {
      const ctx = `Projeto: ${p.project_name || segment}. Fornecedores por categoria: ${Object.entries(byCat).map(([c, l]) => `${c}: ${l.map((s) => s.name).join(', ')}`).join(' | ')}. Profissionais: ${Object.entries(byRole).map(([r, l]) => `${r}: ${l.map((m) => m.name).join(', ')}`).join(' | ')}.`
      const system = `Você é o Seravie Match. Escreva 2-3 frases em português do Brasil explicando por que este ecossistema de parceiros faz sentido para o projeto, de forma prática e sofisticada. Baseie-se apenas no contexto.`
      if (anthropicKey) {
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 400, system, messages: [{ role: 'user', content: ctx }] }) })
        const d = await r.json(); if (d?.content?.[0]?.text) summary = d.content[0].text
      } else {
        const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 400, messages: [{ role: 'system', content: system }, { role: 'user', content: ctx }] }) })
        const d = await r.json(); if (d?.choices?.[0]?.message?.content) summary = d.choices[0].message.content
      }
    } catch { /* mantém heurístico */ }
  }

  return json({ ok: true, segment, summary, suppliers_by_category: byCat, members_by_role: byRole, supplier_count: supplierCount, member_count: memberCount })
})
