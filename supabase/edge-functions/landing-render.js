// landing-render — serve a landing page pública e recebe submissões de formulário.
// GET  /landing-render?slug=<slug>&tenant=<uuid>   -> HTML renderizado dos blocos
// POST /landing-render?action=submit               -> grava form_submissions + cria contato
// Somente páginas com status 'published' são exibidas. Deploy verify_jwt=false (público).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const html = (b, s = 200) => new Response(b, { status: s, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' } })
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function renderBlock(b, accent, forms) {
  const p = b.props || {}
  if (b.type === 'hero') {
    const bg = p.bg ? `background-image:linear-gradient(160deg,rgba(18,21,18,.55),rgba(18,21,18,.85)),url('${esc(p.bg)}');background-size:cover;background-position:center;` : `background:linear-gradient(160deg,${accent}22,transparent);`
    return `<section style="padding:80px 24px;text-align:center;${bg}"><h1 style="font-family:Georgia,serif;font-size:2.4rem;margin:0 0 12px;color:#EEE">${esc(p.title)}</h1><p style="max-width:520px;margin:0 auto 24px;color:#bbb">${esc(p.subtitle)}</p>${p.cta ? `<a href="#form" style="display:inline-block;padding:12px 28px;border-radius:12px;background:${accent};color:#121512;text-decoration:none;font-weight:600">${esc(p.cta)}</a>` : ''}</section>`
  }
  if (b.type === 'text') return `<section style="padding:32px 24px;max-width:640px;margin:0 auto;color:#ddd;line-height:1.7;white-space:pre-wrap">${esc(p.text)}</section>`
  if (b.type === 'image') return p.url ? `<section style="padding:16px 24px;text-align:center"><img src="${esc(p.url)}" alt="${esc(p.alt)}" style="max-width:100%;max-height:420px;border-radius:14px"/></section>` : ''
  if (b.type === 'cta') return `<section style="padding:32px 24px;text-align:center"><a href="${esc(p.url || '#')}" style="display:inline-block;padding:12px 28px;border-radius:12px;background:${accent};color:#121512;text-decoration:none;font-weight:600">${esc(p.label)}</a></section>`
  if (b.type === 'form') {
    const form = (forms || []).find((f) => f.id === p.formId)
    const fields = form?.fields || []
    const inputs = fields.map((fl) => {
      const req = fl.required ? 'required' : ''
      if (fl.type === 'textarea') return `<label style="display:block;margin:10px 0 4px;color:#bbb;font-size:13px">${esc(fl.label)}</label><textarea name="${esc(fl.id)}" ${req} rows="3" style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#eee"></textarea>`
      if (fl.type === 'select') return `<label style="display:block;margin:10px 0 4px;color:#bbb;font-size:13px">${esc(fl.label)}</label><select name="${esc(fl.id)}" ${req} style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#eee">${(fl.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`
      const t = fl.type === 'email' ? 'email' : fl.type === 'phone' ? 'tel' : fl.type === 'rating' ? 'number' : 'text'
      return `<label style="display:block;margin:10px 0 4px;color:#bbb;font-size:13px">${esc(fl.label)}</label><input type="${t}" name="${esc(fl.id)}" ${req} style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#eee"/>`
    }).join('')
    return `<section id="form" style="padding:40px 24px"><div style="max-width:420px;margin:0 auto;background:#181d19;padding:24px;border-radius:16px;border:1px solid #2a2a2a"><h3 style="color:#eee;margin:0 0 12px">${esc(p.title)}</h3><form id="lpform" data-form="${esc(p.formId || '')}">${inputs}<button type="submit" style="width:100%;margin-top:16px;padding:12px;border:0;border-radius:8px;background:${accent};color:#121512;font-weight:600;cursor:pointer">Enviar</button><p id="lpok" style="display:none;color:#8bd08b;text-align:center;margin-top:12px">${esc(form?.success_message || 'Obrigado!')}</p></form></div></section>`
  }
  return ''
}

function pageHtml(page, forms, fnBase) {
  const accent = page.theme?.accent || '#B89C61'
  const blocks = (page.blocks || []).map((b) => renderBlock(b, accent, forms)).join('')
  const submitUrl = `${fnBase}/landing-render?action=submit`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.name)}</title></head><body style="margin:0;background:#121512;font-family:system-ui,-apple-system,sans-serif">${blocks}
<script>
document.querySelectorAll('#lpform').forEach(function(fm){fm.addEventListener('submit',async function(e){e.preventDefault();var fd={};new FormData(fm).forEach(function(v,k){fd[k]=v});try{await fetch('${submitUrl}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenant:'${page.tenant_id}',form_id:fm.dataset.form,landing_id:'${page.id}',answers:fd})});fm.style.display='none';var ok=document.getElementById('lpok');if(ok)ok.style.display='block';}catch(err){alert('Erro ao enviar.');}});});
</script></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const fnBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

  try {
    // ---- Submissão de formulário (público) ----
    if (action === 'submit' && req.method === 'POST') {
      const p = await req.json().catch(() => ({}))
      if (!p.tenant || !p.form_id) return json({ error: 'missing_params' }, 400)
      const answers = p.answers || {}
      // tenta criar/atualizar contato a partir de campos comuns
      let contactId = null
      const email = Object.values(answers).find((v) => typeof v === 'string' && v.includes('@'))
      const name = answers.name || answers.nome || Object.values(answers)[0]
      try {
        if (email || name) {
          const { data: c } = await admin.from('contacts').insert({ tenant_id: p.tenant, name: name || null, email: email || null, source: 'landing', status: 'active' }).select('id').single()
          contactId = c?.id || null
        }
      } catch { /* contato é best-effort */ }
      await admin.from('form_submissions').insert({ tenant_id: p.tenant, form_id: p.form_id, contact_id: contactId, answers })
      // incrementa contador do formulário
      try { const { data: f } = await admin.from('marketing_forms').select('submissions_count').eq('id', p.form_id).maybeSingle(); await admin.from('marketing_forms').update({ submissions_count: (f?.submissions_count || 0) + 1 }).eq('id', p.form_id) } catch { /* noop */ }
      return json({ ok: true })
    }

    // ---- Render da página (público) ----
    const slug = url.searchParams.get('slug')
    const tenant = url.searchParams.get('tenant')
    if (!slug) return html('<h1 style="color:#fff;font-family:system-ui;text-align:center;padding:60px">Página não encontrada</h1>', 404)
    let q = admin.from('landing_pages').select('*').eq('status', 'published')
    // busca por slug (e tenant, se informado, para desambiguar)
    q = tenant ? q.eq('tenant_id', tenant).eq('slug', slug) : q.eq('slug', slug)
    const { data: page } = await q.maybeSingle()
    if (!page) return html('<h1 style="color:#fff;font-family:system-ui;text-align:center;padding:60px">Página não encontrada ou não publicada</h1>', 404)

    // carrega os formulários referenciados
    const formIds = (page.blocks || []).filter((b) => b.type === 'form' && b.props?.formId).map((b) => b.props.formId)
    let forms = []
    if (formIds.length) { const { data } = await admin.from('marketing_forms').select('id, fields, success_message').in('id', formIds); forms = data || [] }

    // incrementa views (best-effort)
    try { await admin.from('landing_pages').update({ views: (page.views || 0) + 1 }).eq('id', page.id) } catch { /* noop */ }

    return html(pageHtml(page, forms, fnBase))
  } catch (e) {
    return html(`<h1 style="color:#fff;font-family:system-ui;text-align:center;padding:60px">Erro ao carregar</h1>`, 500)
  }
})
