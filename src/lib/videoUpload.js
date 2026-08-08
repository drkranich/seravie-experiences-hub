import { supabase } from './supabase'
import { uploadTo } from './storage'

// Upload de vídeo de aula com caminho preparado para Cloudflare Stream.
// Estratégia:
//  1) tenta obter uma URL de upload direto do Cloudflare Stream (Edge Function
//     `stream-upload-url`). Se configurado (CF_ACCOUNT_ID + CF_STREAM_TOKEN nos
//     Secrets do Supabase), envia o arquivo direto ao Cloudflare e devolve
//     { provider:'cloudflare_stream', uid, url } (url = manifesto HLS quando
//     o CF_STREAM_HASH estiver disponível; senão só o uid).
//  2) se o Stream não estiver configurado, cai no Supabase Storage (compat.),
//     devolvendo { provider:'supabase', url }.
//
// Assim a operação já funciona hoje (Supabase) e migra para o Stream apenas
// configurando os segredos — sem mudar o código do editor.

export async function uploadLessonVideo(file, { tenantId, courseId, onProgress } = {}) {
  // 1) Cloudflare Stream (direct upload)
  try {
    const { data, error } = await supabase.functions.invoke('stream-upload-url', {
      body: { name: file.name, tenant_id: tenantId, course_id: courseId },
    })
    if (!error && data?.uploadURL && data?.uid) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(data.uploadURL, { method: 'POST', body: form })
      if (res.ok) {
        // hash da conta de Stream (opcional) para montar o manifesto HLS público
        const hash = (typeof window !== 'undefined' && window.__CF_STREAM_HASH) || null
        const url = hash ? `https://customer-${hash}.cloudflarestream.com/${data.uid}/manifest/video.m3u8` : null
        return { provider: 'cloudflare_stream', uid: data.uid, url }
      }
    }
    // data.error === 'stream_not_configured' cai para o fallback abaixo
  } catch { /* segue para o fallback */ }

  // 2) Fallback: Supabase Storage
  const r = await uploadTo(file, { folder: 'network/academy/videos', accept: 'any', maxMB: 500 })
  if (r.error) return { error: r.error }
  return { provider: 'supabase', url: r.url }
}
