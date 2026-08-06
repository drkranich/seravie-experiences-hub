// flow-submit — recebe a resposta de um Flow Studio (cliente anônimo).
// Valida o formulário publicado pelo slug, grava em flow_responses (service role),
// incrementa o contador e dispara automação new_form_response. verify_jwt=false.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const slug = String(p.slug || '')
  const answers = (p.answers && typeof p.answers === 'object') ? p.answers : {}
  if (!slug) return json({ error: 'missing_slug' }, 400)
  if (!Object.keys(answers).length) return json({ error: 'empty_answers' }, 400)
  const { data: form } = await admin.from('flow_forms').select('id, tenant_id, status').eq('slug', slug).eq('status', 'published').maybeSingle()
  if (!form) return json({ error: 'form_not_found' }, 404)
  const { data: blocks } = await admin.from('flow_form_blocks').select('id, required, type').eq('form_id', form.id)
  const missing = (blocks || []).filter((b) => b.required && !['title','text','image','button'].includes(b.type) && (answers[b.id] === undefined || answers[b.id] === '' || answers[b.id] === null))
  if (missing.length) return json({ error: 'missing_required', fields: missing.map((m) => m.id) }, 400)
  const { data: resp, error } = await admin.from('flow_responses').insert({ tenant_id: form.tenant_id, form_id: form.id, answers, meta: p.meta || {}, completed: p.completed !== false }).select('id').single()
  if (error) return json({ error: error.message }, 400)
  try { await admin.rpc('increment_flow_response', { p_form: form.id }) } catch {
    try { const { data: f } = await admin.from('flow_forms').select('response_count').eq('id', form.id).single(); await admin.from('flow_forms').update({ response_count: (f?.response_count || 0) + 1 }).eq('id', form.id) } catch { /* noop */ }
  }
  try {
    const base = Deno.env.get('SUPABASE_URL')
    await fetch(`${base}/functions/v1/automation-run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }, body: JSON.stringify({ event: 'new_form_response', tenant_id: form.tenant_id, context: { form_id: form.id, response_id: resp.id } }) })
  } catch { /* best-effort */ }
  return json({ ok: true, response_id: resp.id })
})
