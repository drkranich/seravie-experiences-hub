// quote-ai — inteligência comercial do Quote Studio.
// Combina dados REAIS do tenant (itens frequentes, co-ocorrência, ticket de aprovados)
// com IA generativa opcional para cross-sell contextual. Sempre retorna sugestões.
// Retorna { ok, cross_sell:[{name, reason, suggested_price?}], margin, insight }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: u } = await admin.auth.getUser(jwt)
  if (!u?.user) return json({ error: 'unauthorized' }, 401)
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', u.user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const currentItems = (p.items || []).map((i) => (i.name || '').toLowerCase().trim()).filter(Boolean)
  const total = Number(p.total) || 0
  const margin = Number(p.margin) || 0
  const targetMargin = Number(p.target_margin) || 25

  // ---- DADOS REAIS DO TENANT ----
  const { data: wonQuotes } = await admin.from('quotes').select('id, total').eq('tenant_id', tenantId).eq('status', 'accepted').limit(500)
  const avgTicket = wonQuotes && wonQuotes.length ? wonQuotes.reduce((a, q) => a + Number(q.total || 0), 0) / wonQuotes.length : 0

  const { data: allItems } = await admin.from('quote_items').select('quote_id, name, unit_price').eq('tenant_id', tenantId).limit(4000)
  const freq = {}, price = {}, byQuote = {}
  ;(allItems || []).forEach((it) => {
    const key = (it.name || '').toLowerCase().trim(); if (!key) return
    freq[key] = (freq[key] || 0) + 1
    price[key] = it.unit_price || price[key] || 0
    ;(byQuote[it.quote_id] = byQuote[it.quote_id] || []).push(key)
  })
  const co = {}
  Object.values(byQuote).forEach((names) => {
    if (!names.some((n) => currentItems.includes(n))) return
    names.forEach((n) => { if (!currentItems.includes(n)) co[n] = (co[n] || 0) + 1 })
  })
  let crossFromData = Object.entries(co).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([name, c]) => ({ name: cap(name), reason: `Costuma ser fechado junto (${c}×)`, suggested_price: Math.round(price[name] || 0) || undefined }))
  if (crossFromData.length === 0) {
    crossFromData = Object.entries(freq).filter(([n]) => !currentItems.includes(n)).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, c]) => ({ name: cap(name), reason: `Um dos seus itens mais usados (${c}×)`, suggested_price: Math.round(price[name] || 0) || undefined }))
  }

  // ---- IA GENERATIVA (opcional) ----
  const openai = Deno.env.get('OPENAI_API_KEY')
  const anthropic = Deno.env.get('ANTHROPIC_API_KEY')
  let crossFromAI = []
  const sys = `Você é consultor de vendas. Dado o título do orçamento e os itens atuais, sugira até 4 itens de cross-sell/upsell coerentes. Responda SOMENTE JSON: [{"name":"","reason":""}]. Em português do Brasil.`
  const userMsg = JSON.stringify({ titulo: p.title, itens: p.items?.map((i) => i.name) })
  try {
    if (openai) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.6, messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }] }) })
      const d = await r.json(); crossFromAI = parseArr(d.choices?.[0]?.message?.content)
    } else if (anthropic) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': anthropic, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 500, system: sys, messages: [{ role: 'user', content: userMsg }] }) })
      const d = await r.json(); crossFromAI = parseArr(d.content?.[0]?.text)
    }
  } catch (_) { crossFromAI = [] }
  crossFromAI = (crossFromAI || []).filter((x) => x && x.name && !currentItems.includes((x.name || '').toLowerCase().trim())).slice(0, 4).map((x) => ({ name: x.name, reason: x.reason || 'Sugestão da IA' }))

  const seen = new Set(); const cross = []
  for (const it of [...crossFromData, ...crossFromAI]) {
    const k = (it.name || '').toLowerCase().trim(); if (!k || seen.has(k)) continue
    seen.add(k); cross.push(it); if (cross.length >= 5) break
  }

  // ---- MARGEM ----
  let marginInfo = null
  if (total > 0 && margin < targetMargin) {
    const cost = total * (1 - margin / 100)
    const suggested = cost / (1 - targetMargin / 100)
    marginInfo = { level: margin < 0 ? 'critical' : 'low', current: margin, target: targetMargin, suggested_total: Math.round(suggested), delta: Math.round(suggested - total),
      message: margin < 0 ? 'Prejuízo: o preço está abaixo do custo.' : `Margem ${margin.toFixed(1)}% abaixo do alvo (${targetMargin}%). Para atingir, o total ideal é ${brl(suggested)}.` }
  }

  // ---- INSIGHT ----
  let insight = null
  if (avgTicket > 0) {
    if (total > 0 && total < avgTicket * 0.7) insight = `Propostas aprovadas parecidas fecharam em média ${brl(avgTicket)} — há espaço para ampliar o escopo.`
    else if (total > avgTicket * 1.4) insight = `Este orçamento está acima do seu ticket médio de aprovados (${brl(avgTicket)}). Considere um cenário mais enxuto como alternativa.`
    else insight = `Alinhado ao seu ticket médio de aprovados (${brl(avgTicket)}).`
  }

  return json({ ok: true, cross_sell: cross, margin: marginInfo, insight, avg_ticket: Math.round(avgTicket) })
})

function cap(s) { return (s || '').replace(/\b\w/g, (c) => c.toUpperCase()) }
function parseArr(txt) {
  if (!txt) return []
  let s = String(txt).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const a = s.indexOf('['); const b = s.lastIndexOf(']'); if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : [] } catch { return [] }
}
