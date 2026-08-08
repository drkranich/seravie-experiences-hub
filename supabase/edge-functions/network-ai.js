// network-ai — IA Consultora do Seravie Network.
// Aconselha sobre o ecossistema profissional: quem conectar, como montar equipe
// para um projeto, quais comunidades/eventos, como escrever um briefing, quais
// talentos buscar. Usa DADOS REAIS do Network (membros, comunidades, eventos,
// briefings) como contexto.
//
// BYO chave (mesmo padrão do suppliers-ai): ANTHROPIC_API_KEY ou OPENAI_API_KEY
// dos Secrets. Sem chave, devolve fallback heurístico útil (não finge IA).
//
// Corpo: { question }  |  Auth: JWT do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "")
  const { data: userData } = await admin.auth.getUser(jwt)
  if (!userData?.user) return json({ error: "unauthorized" }, 401)
  const { data: mem } = await admin.from("memberships").select("tenant_id").eq("user_id", userData.user.id).eq("status", "active").maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: "no_tenant" }, 403)

  let p: Record<string, unknown> = {}
  try { p = await req.json() } catch { /* vazio */ }
  const question = String(p.question || "").trim()
  if (!question) return json({ error: "missing_question" }, 400)

  // contexto real do ecossistema
  const [{ data: members }, { data: communities }, { data: events }, { data: reqs }, { data: talents }] = await Promise.all([
    admin.from("network_members").select("name,role_title,headline,city,state,specialties,skills,rating").eq("status", "active").limit(60),
    admin.from("network_communities").select("name,members_count").order("members_count", { ascending: false }).limit(20),
    admin.from("network_events").select("title,kind,starts_at,city").gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
    admin.from("service_requests").select("title,role,status").eq("status", "open").limit(15),
    admin.from("network_members").select("name,role_title,skills,rating").eq("open_to_work", true).limit(20),
  ])

  const memCtx = (members || []).slice(0, 20).map((m) => `- ${m.name} (${m.role_title || "profissional"}, ${m.city || "s/ cidade"}${Array.isArray(m.specialties) && m.specialties.length ? ", " + m.specialties.slice(0, 3).join("/") : ""}${m.rating ? `, nota ${m.rating}` : ""})`).join("\n")
  const comCtx = (communities || []).map((c) => `${c.name} (${c.members_count || 0})`).join(", ")
  const evCtx = (events || []).map((e) => `${e.title} (${e.kind}${e.city ? ", " + e.city : ""})`).join("; ")
  const talCtx = (talents || []).slice(0, 12).map((t) => `- ${t.name} (${t.role_title || "profissional"}${Array.isArray(t.skills) && t.skills.length ? ", " + t.skills.slice(0, 3).join("/") : ""})`).join("\n")

  const ctx = `Membros do ecossistema (amostra):\n${memCtx || "nenhum"}\n\nComunidades: ${comCtx || "nenhuma"}\n\nPróximos eventos: ${evCtx || "nenhum"}\n\nBriefings abertos no Marketplace: ${(reqs || []).length}\n\nTalentos abertos a oportunidades:\n${talCtx || "nenhum"}`
  const system = `Você é a IA Consultora do Seravie Network, uma plataforma social profissional do ecossistema de experiências (arquitetos, designers, fornecedores, fotógrafos, consultores…). Ajude o membro a: montar equipe para um projeto, decidir quem conectar, quais comunidades/eventos participar, como estruturar um briefing e quais talentos buscar. Responda em português do Brasil, prático e objetivo, com recomendações concretas baseadas SOMENTE no contexto abaixo. Se faltar dado, diga o que falta.\n\n${ctx}`

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
  const openaiKey = Deno.env.get("OPENAI_API_KEY")

  if (!anthropicKey && !openaiKey) {
    const sample = (members || []).slice(0, 3).map((m, i) => `${i + 1}. ${m.name} — ${m.role_title || "profissional"}${m.city ? `, ${m.city}` : ""}`).join("\n")
    return json({
      configured: false,
      reply: `A IA generativa ainda não está conectada (configure ANTHROPIC_API_KEY ou OPENAI_API_KEY nos Secrets). Com base nos dados do ecossistema, alguns profissionais em destaque:\n\n${sample || "nenhum membro encontrado"}\n\nExplore também as comunidades ativas (${comCtx || "—"}) e os briefings abertos no Marketplace de Serviços.`,
    })
  }

  try {
    if (anthropicKey) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 900, system, messages: [{ role: "user", content: question }] }) })
      const d = await r.json()
      return json({ configured: true, reply: d?.content?.[0]?.text || "Não consegui responder agora." })
    }
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 900, messages: [{ role: "system", content: system }, { role: "user", content: question }] }) })
    const d = await r.json()
    return json({ configured: true, reply: d?.choices?.[0]?.message?.content || "Não consegui responder agora." })
  } catch (e) {
    return json({ error: "ai_error", detail: String((e as Error)?.message || e) }, 502)
  }
})
