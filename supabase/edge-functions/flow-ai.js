// flow-ai — IA do Flow Studio. Ações: improve/rewrite/persuasive/formal/friendly/
// shorter/fix/translate_en (refinam texto de pergunta) e generate_form (cria um
// formulário inteiro a partir de um objetivo). Anthropic/OpenAI; fallback sem chave.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
async function llm(system, user) {
  const ak = Deno.env.get('ANTHROPIC_API_KEY'); const ok = Deno.env.get('OPENAI_API_KEY')
  if (ak) { const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': ak, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 1500, system, messages: [{ role: 'user', content: user }] }) }); const d = await r.json(); return d?.content?.[0]?.text || null }
  if (ok) { const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${ok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1500, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) }); const d = await r.json(); return d?.choices?.[0]?.message?.content || null }
  return null
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle()
  if (!mem?.tenant_id) return json({ error: 'no_tenant' }, 403)
  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const action = String(p.action || ''); const text = String(p.text || '')
  const configured = !!(Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('OPENAI_API_KEY'))
  if (!configured) return json({ error: 'ai_not_configured', detail: 'Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY para ativar a IA.' }, 200)
  if (action === 'generate_form') {
    const goal = String(p.goal || text)
    const sys = 'Você cria formulários de captação/diagnóstico premium. Responda APENAS com JSON válido, sem markdown. Formato: {"title":"...","submit_message":"...","blocks":[{"type":"title|text|short_text|long_text|email|phone|number|choice|nps|rating","label":"...","help":"...","required":true,"options":[{"label":"..."}]}]}. Máximo 8 blocos, comece com title de boas-vindas, inclua email ou phone, português do Brasil.'
    const out = await llm(sys, `Crie um formulário para: ${goal}`)
    if (!out) return json({ error: 'ai_error' }, 502)
    try { return json({ ok: true, form: JSON.parse(out.replace(/```json|```/g, '').trim()) }) } catch { return json({ error: 'parse_error', raw: out }, 502) }
  }
  const prompts = {
    improve: 'Melhore esta pergunta de formulário, mantendo o sentido, clara e envolvente. Responda só com o texto final.',
    rewrite: 'Reescreva de outra forma, mantendo o sentido. Responda só com o texto final.',
    persuasive: 'Reescreva de forma mais persuasiva. Responda só com o texto final.',
    formal: 'Reescreva de forma mais formal. Responda só com o texto final.',
    friendly: 'Reescreva de forma mais amigável e calorosa. Responda só com o texto final.',
    shorter: 'Resuma/encurte, mantendo o essencial. Responda só com o texto final.',
    fix: 'Corrija ortografia e gramática. Responda só com o texto final.',
    translate_en: 'Traduza para inglês. Responda só com o texto final.',
  }
  const instr = prompts[action]
  if (!instr) return json({ error: 'invalid_action' }, 400)
  if (!text) return json({ error: 'empty_text' }, 400)
  const out = await llm('Você é um editor de textos de formulários premium em português do Brasil.', `${instr}\n\nTexto: "${text}"`)
  if (!out) return json({ error: 'ai_error' }, 502)
  return json({ ok: true, text: out.trim().replace(/^["']|["']$/g, '') })
})
