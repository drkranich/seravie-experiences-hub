// verify-biometrics — gancho para verificação orofacial (liveness + face match).
// Recebe { verification_id }. Se um provedor estiver configurado (chave nos
// Secrets), compara a selfie com o documento e grava o score/decisão. Sem
// provedor, apenas marca 'em_analise' para revisão manual (não finge biometria).
//
// Provedores plugáveis (BYO, um dos):
//   BIO_PROVIDER = 'rekognition' | 'unico' | 'serpro' | 'manual'
//   + credenciais específicas do provedor nos Secrets.
// Este stub deixa o ponto de integração pronto; a chamada real ao provedor é
// adicionada quando você escolher e conectar um.
//
// Segurança: usa SERVICE ROLE (lê identity_verifications e o bucket privado).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

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

  // Sem provedor de biometria conectado → fica para revisão manual.
  if (provider === "manual") {
    await admin.from("identity_verifications").update({ status: "em_analise", provider: "manual" }).eq("id", id)
    return json({ configured: false, status: "em_analise", detail: "Provedor de biometria não conectado — verificação encaminhada para análise manual." })
  }

  // Ponto de integração do provedor (ex.: AWS Rekognition CompareFaces + liveness).
  // Gera URLs assinadas dos arquivos e envia ao provedor; aqui deixamos o esqueleto.
  try {
    // const selfie = await admin.storage.from("identity-docs").createSignedUrl(rec.selfie_path, 300)
    // const doc = await admin.storage.from("identity-docs").createSignedUrl(rec.doc_front_path, 300)
    // const score = await callProvider(provider, selfie.data.signedUrl, doc.data.signedUrl)
    // const status = score >= 0.9 ? "aprovado" : "reprovado"
    // await admin.from("identity_verifications").update({ status, provider, provider_score: score, reviewed_at: new Date().toISOString() }).eq("id", id)
    // return json({ configured: true, status, score })
    return json({ configured: true, status: "em_analise", detail: `Provedor '${provider}' selecionado — implemente a chamada em callProvider().` })
  } catch (e) {
    return json({ error: "bio_error", detail: String((e as Error)?.message || e) }, 502)
  }
})
