// stamp-doc — gera o PDF final carimbado: documento original + página de manifesto.
//   POST { request_id } → monta o PDF (pdf-lib), sobe no bucket 'vault' e grava
//   signed_storage_path na signature_request. Chamado automaticamente ao concluir
//   (por sign-doc, com service role) e sob demanda pelo painel (JWT do usuário).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const fmtDT = (d) => { try { return new Date(d).toLocaleString('pt-BR') } catch { return String(d || '') } }

const NAVY = rgb(0.12, 0.23, 0.37)
const GOLD = rgb(0.72, 0.61, 0.38)
const GREY = rgb(0.42, 0.45, 0.5)
const DARK = rgb(0.17, 0.17, 0.17)

export async function buildStampedPdf(admin, reqRow, signers) {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const fontB = await out.embedFont(StandardFonts.HelveticaBold)

  // 1) documento original (se PDF) ou imagem → páginas
  let mergedOriginal = false
  if (reqRow.storage_path) {
    try {
      const { data: file } = await admin.storage.from('vault').download(reqRow.storage_path)
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const ext = (reqRow.file_ext || '').toLowerCase()
        if (ext === 'pdf') {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const pages = await out.copyPages(src, src.getPageIndices())
          pages.forEach((p) => out.addPage(p))
          mergedOriginal = true
        } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
          const img = ext === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes)
          const page = out.addPage([595, 842]) // A4
          const scale = Math.min((595 - 60) / img.width, (842 - 60) / img.height, 1)
          const w = img.width * scale, h = img.height * scale
          page.drawImage(img, { x: (595 - w) / 2, y: (842 - h) / 2, width: w, height: h })
          mergedOriginal = true
        }
      }
    } catch (_) { /* segue só com manifesto */ }
  }

  // 2) página de manifesto
  const page = out.addPage([595, 842])
  const M = 50
  let y = 800
  const line = (text, { size = 10, color = DARK, bold = false, gap = 16, x = M } = {}) => {
    page.drawText(String(text ?? ''), { x, y, size, font: bold ? fontB : font, color })
    y -= gap
  }
  const rule = (color = rgb(0.85, 0.82, 0.74)) => { page.drawLine({ start: { x: M, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.6, color }); y -= 10 }

  // cabeçalho
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: NAVY })
  page.drawText('SERAVIE EXPERIENCES  ·  Manifesto de Assinaturas', { x: M, y: 821, size: 11, font: fontB, color: rgb(1, 1, 1) })
  y = 780
  line('Comprovante de assinatura eletrônica', { size: 16, bold: true, color: NAVY, gap: 10 })
  line(reqRow.title || 'Documento', { size: 13, color: GOLD, gap: 22 })

  line('DOCUMENTO', { size: 9, bold: true, color: GREY, gap: 14 })
  line(`Arquivo: ${reqRow.file_name || reqRow.title || '—'}`, { gap: 14 })
  line(`Origem: ${reqRow.source || 'upload'}    Status: ${reqRow.status || 'completed'}`, { gap: 14 })
  line(`Criado em: ${fmtDT(reqRow.created_at)}    Concluído em: ${fmtDT(reqRow.completed_at)}`, { gap: 18 })
  rule()

  line('SIGNATÁRIOS', { size: 9, bold: true, color: GREY, gap: 16 })
  for (const s of signers) {
    line(`${s.signed_name || s.name || s.email || 'Signatário'}`, { size: 11, bold: true, color: NAVY, gap: 13 })
    if (s.email) line(`E-mail: ${s.email}`, { size: 9, color: GREY, gap: 12 })
    line(`Status: ${s.status === 'signed' ? 'Assinou' : s.status}   ${s.signed_at ? '· ' + fmtDT(s.signed_at) : ''}`, { size: 9, color: GREY, gap: 12 })
    if (s.signed_ip && s.signed_ip !== 'desconhecido') line(`IP: ${s.signed_ip}`, { size: 9, color: GREY, gap: 12 })
    // assinatura desenhada
    if (s.signature_data && s.signature_data.startsWith('data:image')) {
      try {
        const b64 = s.signature_data.split(',')[1]
        const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const sig = s.signature_data.includes('image/png') ? await out.embedPng(raw) : await out.embedJpg(raw)
        const sw = 140, sh = sig.height * (sw / sig.width)
        page.drawRectangle({ x: M, y: y - sh - 2, width: sw + 8, height: sh + 6, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.82, 0.74), borderWidth: 0.5 })
        page.drawImage(sig, { x: M + 4, y: y - sh, width: sw, height: sh })
        y -= sh + 14
      } catch (_) { y -= 4 }
    }
    y -= 6
    if (y < 120) { break } // segurança de página única
  }
  rule()

  // rodapé de verificação
  y = Math.max(y, 70)
  page.drawText('Código de verificação:', { x: M, y: 60, size: 9, font: fontB, color: GREY })
  page.drawText(String(reqRow.verification_code || ''), { x: M + 118, y: 60, size: 9, font, color: DARK })
  const origin = reqRow.app_origin || 'https://seravieexperiences.com'
  page.drawText(`Valide em: ${origin}/validar/${reqRow.verification_code}`, { x: M, y: 46, size: 8, font, color: GREY })
  page.drawText('Assinatura eletrônica conforme MP 2.200-2/2001 (art. 10, §2º). Documento e prova preservados pela Seravie.', { x: M, y: 33, size: 7.5, font, color: GREY })

  const pdfBytes = await out.save()
  const path = `signed/${reqRow.id}-${reqRow.verification_code}.pdf`
  await admin.storage.from('vault').upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })
  await admin.from('signature_requests').update({ signed_storage_path: path }).eq('id', reqRow.id)
  return { path, mergedOriginal }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  if (!p.request_id) return json({ error: 'missing_request_id' }, 400)

  // autorização: internal_secret (chamada por sign-doc) OU usuário do mesmo tenant
  const internal = req.headers.get('x-internal-secret') || ''
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  let authorized = internal && internal === svc
  const { data: reqRow } = await admin.from('signature_requests').select('*').eq('id', p.request_id).maybeSingle()
  if (!reqRow) return json({ error: 'not_found' }, 404)
  if (!authorized) {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(jwt)
    if (!u?.user) return json({ error: 'unauthorized' }, 401)
    const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', u.user.id).eq('status', 'active').maybeSingle()
    authorized = mem?.tenant_id === reqRow.tenant_id
  }
  if (!authorized) return json({ error: 'forbidden' }, 403)

  const { data: signers } = await admin.from('signature_signers').select('*').eq('request_id', reqRow.id).order('order_index')
  try {
    const r = await buildStampedPdf(admin, reqRow, signers || [])
    return json({ ok: true, ...r })
  } catch (e) {
    return json({ error: 'stamp_failed', detail: String(e?.message || e) }, 500)
  }
})
