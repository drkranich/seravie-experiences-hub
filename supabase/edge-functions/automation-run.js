// automation-run — motor de automações. Recebe um evento (trigger) e um tenant,
// executa as automações ativas correspondentes, registra em automation_runs e
// incrementa run_count. Chamado internamente por PDV/flow/booking após eventos.
// Ações de e-mail/webhook usam segredos opcionais (RESEND_API_KEY); sem eles,
// a ação é registrada como 'skipped'. (Deploy: verify_jwt=false — chamada interna.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

async function runAction(action, ctx) {
  const type = action?.type
  if (type === 'webhook' && action.value) {
    try { await fetch(action.value, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ctx) }); return { type, status: 'success' } }
    catch (e) { return { type, status: 'error', error: String(e?.message || e) } }
  }
  if (type === 'send_email') {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return { type, status: 'skipped', reason: 'no_email_provider' }
    try {
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'no-reply@seravie.app', to: ctx.customer_email || action.to, subject: action.subject || 'Aviso', html: action.value || '' }) })
      return { type, status: 'success' }
    } catch (e) { return { type, status: 'error', error: String(e?.message || e) } }
  }
  return { type, status: 'success', note: 'logged' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const event = String(p.event || ''); const tenantId = p.tenant_id; const context = p.context || {}
  if (!event || !tenantId) return json({ error: 'missing_event_or_tenant' }, 400)
  const { data: autos } = await admin.from('automations').select('*').eq('tenant_id', tenantId).eq('trigger_type', event).eq('is_active', true)
  const results = []
  for (const a of autos || []) {
    const actionResults = []
    for (const act of (a.actions || [])) actionResults.push(await runAction(act, context))
    const ok = actionResults.every((r) => r.status !== 'error')
    await admin.from('automation_runs').insert({ tenant_id: tenantId, automation_id: a.id, trigger_event: event, status: ok ? 'success' : 'error', detail: { actions: actionResults, context } })
    await admin.from('automations').update({ run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString() }).eq('id', a.id)
    results.push({ automation: a.name, ok, actions: actionResults })
  }
  return json({ ok: true, fired: results.length, results })
})
