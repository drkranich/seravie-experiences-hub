// doc-ai — gera os blocos de um documento a partir de empresa + segmento + objetivo.
// Tenta OpenAI → Anthropic → Gemini; se nenhum configurado, usa um fallback estruturado.
// Retorna { ok, blocks: [...] } no formato de blocos do Document Studio.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYS = `Você é um redator de propostas comerciais premium. Gere o conteúdo de uma proposta em português do Brasil, elegante e persuasiva.
Responda SOMENTE com um array JSON de blocos, sem texto fora do JSON. Tipos de bloco permitidos e campos:
- {"type":"cover","eyebrow":"","title":"","subtitle":""}
- {"type":"heading","text":""}
- {"type":"text","text":""}
- {"type":"callout","title":"","text":""}
- {"type":"quote_table","title":"Investimento"}
- {"type":"terms","title":"Termos","text":""}
Estruture: capa, quem somos, entendimento do desafio, escopo/solução (com headings e parágrafos), um callout de diferencial, tabela de investimento e termos. 8 a 12 blocos.`

function fallback(p) {
  const empresa = p.company || 'nossa empresa'
  const seg = p.segment || 'seu segmento'
  const obj = p.objective || 'alcançar seus objetivos'
  return [
    { type: 'cover', eyebrow: 'Proposta Comercial', title: `Proposta para ${p.client || '{{client}}'}`, subtitle: `Preparado por ${empresa}` },
    { type: 'heading', text: 'Quem somos' },
    { type: 'text', text: `${empresa} atua em ${seg}, combinando excelência e uma experiência de alto padrão para entregar resultados consistentes aos nossos clientes.` },
    { type: 'heading', text: 'O desafio' },
    { type: 'text', text: `Entendemos que o objetivo é ${obj}. Estruturamos uma solução sob medida para chegar lá com segurança e sofisticação.` },
    { type: 'heading', text: 'Nossa solução' },
    { type: 'text', text: 'Apresentamos um plano dividido em etapas claras, com marcos bem definidos e acompanhamento próximo em cada fase do projeto.' },
    { type: 'callout', title: 'Por que nós', text: `Experiência comprovada em ${seg}, atendimento dedicado e um padrão de qualidade que faz a diferença percebida pelo seu cliente final.` },
    { type: 'quote_table', title: 'Investimento' },
    { type: 'terms', title: 'Termos & condições', text: 'Validade da proposta: 15 dias. Formas de pagamento a combinar. Prazos e escopo conforme detalhado acima.' },
  ]
}

async function viaOpenAI(key, p) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, messages: [{ role: 'system', content: SYS }, { role: 'user', content: JSON.stringify(p) }] }),
  })
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || 'openai')
  return d.choices?.[0]?.message?.content || ''
}
async function viaAnthropic(key, p) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 2000, system: SYS, messages: [{ role: 'user', content: JSON.stringify(p) }] }),
  })
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || 'anthropic')
  return d.content?.[0]?.text || ''
}
async function viaGemini(key, p) {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest']
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ parts: [{ text: JSON.stringify(p) }] }] }),
    })
    const d = await r.json()
    if (r.ok) return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  throw new Error('gemini')
}

function parseBlocks(txt) {
  if (!txt) return null
  let s = txt.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const a = s.indexOf('['); const b = s.lastIndexOf(']')
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : null } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: u } = await admin.auth.getUser(jwt)
  if (!u?.user) return json({ error: 'unauthorized' }, 401)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }

  const openai = Deno.env.get('OPENAI_API_KEY')
  const anthropic = Deno.env.get('ANTHROPIC_API_KEY')
  const gemini = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')

  let blocks = null, source = 'fallback'
  try {
    if (openai) { blocks = parseBlocks(await viaOpenAI(openai, p)); source = 'openai' }
    else if (anthropic) { blocks = parseBlocks(await viaAnthropic(anthropic, p)); source = 'anthropic' }
    else if (gemini) { blocks = parseBlocks(await viaGemini(gemini, p)); source = 'gemini' }
  } catch (_) { blocks = null }

  const allowed = new Set(['cover', 'heading', 'text', 'callout', 'quote_table', 'terms', 'divider', 'signature_line'])
  if (blocks) blocks = blocks.filter((b) => b && allowed.has(b.type))
  if (!blocks || blocks.length < 3) { blocks = fallback(p); source = 'fallback' }

  return json({ ok: true, source, blocks })
})
