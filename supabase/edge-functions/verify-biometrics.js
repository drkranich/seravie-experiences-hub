// verify-biometrics — verificação orofacial (face match) plugável.
// Recebe { verification_id }. Se o provedor AWS Rekognition estiver configurado
// (chaves nos Secrets), compara a selfie com a foto do documento e grava o
// score/decisão. Sem provedor, deixa 'em_analise' para revisão manual.
//
// BYO (Secrets do Supabase):
//   BIO_PROVIDER = 'rekognition' | 'manual'
//   BIO_AWS_KEY, BIO_AWS_SECRET, BIO_AWS_REGION (ex.: us-east-1)
//   BIO_THRESHOLD (opcional; default 90 — similaridade mínima para aprovar)
//
// Segurança: SERVICE ROLE (lê identity_verifications e o bucket privado).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

// ---- SigV4 mínimo para AWS Rekognition ----
const enc = new TextEncoder()
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)))
}
async function sha256Hex(data: string | Uint8Array) {
  const buf = typeof data === "string" ? enc.encode(data) : data
  const h = await crypto.subtle.digest("SHA-256", buf)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
async function rekognitionCompare(region: string, akid: string, secret: string, sourceBytes: Uint8Array, targetBytes: Uint8Array, threshold: number) {
  const host = `rekognition.${region}.amazonaws.com`
  const target = "RekognitionService.CompareFaces"
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
  const payload = JSON.stringify({ SourceImage: { Bytes: b64(sourceBytes) }, TargetImage: { Bytes: b64(targetBytes) }, SimilarityThreshold: threshold })
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = await sha256Hex(payload)
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target"
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const scope = `${dateStamp}/${region}/rekognition/aws4_request`
  const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`
  const kDate = await hmac(enc.encode("AWS4" + secret), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, "rekognition")
  const kSigning = await hmac(kService, "aws4_request")
  const sig = [...await hmac(kSigning, toSign)].map((b) => b.toString(16).padStart(2, "0")).join("")
  const auth = `AWS4-HMAC-SHA256 Credential=${akid}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`
  const r = await fetch(`https://${host}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Date": amzDate, "X-Amz-Target": target, Authorization: auth },
    body: payload,
  })
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  let p: Record<string, unknown> = {}
  try { p = await req.json() } catch { /* vazio */ }
  const id = String(p.verification_id || "")
  if (!id) return json({ error: "missing_id" }, 400)

  const { data: rec } = await admin.from("identity_verifications").select("*").eq("id", id).maybeSingle()
  if (!rec) return json({ error: "not_found" }, 404)

  const provider = Deno.env.get("BIO_PROVIDER") || "manual"
  const region = Deno.env.get("BIO_AWS_REGION")
  const akid = Deno.env.get("BIO_AWS_KEY")
  const secret = Deno.env.get("BIO_AWS_SECRET")

  if (provider !== "rekognition" || !region || !akid || !secret) {
    await admin.from("identity_verifications").update({ status: "em_analise", provider: "manual" }).eq("id", id)
    return json({ configured: false, status: "em_analise", detail: "Provedor de biometria não conectado — verificação encaminhada para análise manual." })
  }

  try {
    // baixa selfie + frente do documento do bucket privado
    const dl = async (path: string) => { const { data } = await admin.storage.from("identity-docs").download(path); return data ? new Uint8Array(await data.arrayBuffer()) : null }
    const selfie = rec.selfie_path ? await dl(rec.selfie_path) : null
    const doc = rec.doc_front_path ? await dl(rec.doc_front_path) : null
    if (!selfie || !doc) return json({ error: "missing_images" }, 400)

    const threshold = Number(Deno.env.get("BIO_THRESHOLD") || 90)
    const out = await rekognitionCompare(region, akid, secret, selfie, doc, threshold)
    const match = (out.FaceMatches || [])[0]
    const similarity = match?.Similarity ?? 0
    const score = similarity / 100
    const status = similarity >= threshold ? "aprovado" : "reprovado"

    await admin.from("identity_verifications").update({ status, provider: "rekognition", provider_score: score, reviewed_at: new Date().toISOString(), reviewer_note: `Rekognition: similaridade ${similarity.toFixed(1)}% (limiar ${threshold}%)` }).eq("id", id)
    if (status === "aprovado") {
      await Promise.all([
        admin.from("network_members").update({ identity_verified: true }).eq("tenant_id", rec.tenant_id),
        admin.from("suppliers").update({ identity_verified: true }).eq("tenant_id", rec.tenant_id),
        admin.from("notifications").insert({ tenant_id: rec.tenant_id, domain: "network", kind: "system", title: "Identidade verificada ✓", body: "Seu perfil agora exibe o selo de verificado.", icon: "check", link_route: "people" }),
      ])
    }
    return json({ configured: true, status, similarity, score })
  } catch (e) {
    return json({ error: "bio_error", detail: String((e as Error)?.message || e) }, 502)
  }
})
