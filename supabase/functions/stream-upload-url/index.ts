// Edge Function: stream-upload-url
// Prepara o caminho para Cloudflare Stream: solicita uma URL de upload direto
// (one-time) para o navegador enviar o vídeo da aula direto ao Cloudflare,
// sem passar pelo Storage do Supabase. Retorna { uploadURL, uid }.
//
// O front usa uploadURL (POST do arquivo) e guarda uid em
// network_academy_lessons.stream_uid (+ video_provider = 'cloudflare_stream').
// A reprodução usa o player HLS do Stream:
//   https://customer-<hash>.cloudflarestream.com/<uid>/manifest/video.m3u8
//
// Segurança: usa segredos nos Supabase Secrets (NUNCA no Cloudflare front):
//   CF_ACCOUNT_ID, CF_STREAM_TOKEN  (token de API com permissão de Stream:Edit)
// Sem os segredos, responde { error: 'stream_not_configured' } — o front cai
// automaticamente no upload via Supabase Storage (compatível com o que já existe).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const accountId = Deno.env.get("CF_ACCOUNT_ID")
  const token = Deno.env.get("CF_STREAM_TOKEN")
  if (!accountId || !token) return json({ error: "stream_not_configured" }, 200)

  let payload: Record<string, unknown> = {}
  try { payload = await req.json() } catch { /* vazio */ }
  const maxSeconds = Number(payload.max_seconds) || 7200 // até 2h por aula por padrão
  const name = String(payload.name || "Aula Seravie")

  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      maxDurationSeconds: maxSeconds,
      requireSignedURLs: false,
      meta: { name, tenant_id: payload.tenant_id ?? null, course_id: payload.course_id ?? null },
    }),
  })
  const data = await r.json()
  if (!r.ok || !data?.success) return json({ error: "stream_error", detail: data?.errors?.[0]?.message || "falha" }, 400)
  return json({ uploadURL: data.result.uploadURL, uid: data.result.uid })
})
