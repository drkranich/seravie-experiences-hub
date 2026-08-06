// automation-cron — agendador dos gatilhos de tempo. Rodado DE HORA EM HORA
// pelo pg_cron (job seravie-automation-hourly). Para cada tenant, dispara
// 'daily' só na hora configurada (automation_settings.daily_hour_utc, padrão 12)
// e 'birthday' para aniversariantes do dia. Protegido por CRON_SECRET.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
  const base = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(base, serviceKey)
  const nowHour = new Date().getUTCHours()
  const fire = (event, tenantId, context) => fetch(`${base}/functions/v1/automation-run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` }, body: JSON.stringify({ event, tenant_id: tenantId, context }) }).catch(() => {})
  const { data: settings } = await admin.from('automation_settings').select('tenant_id, daily_hour_utc')
  const hourByTenant = {}
  for (const s of settings || []) hourByTenant[s.tenant_id] = s.daily_hour_utc ?? 12
  const { data: autos } = await admin.from('automations').select('tenant_id, trigger_type').eq('is_active', true).in('trigger_type', ['daily', 'birthday'])
  const dailyTenants = new Set(); const birthdayTenants = new Set()
  for (const a of autos || []) { const h = hourByTenant[a.tenant_id] ?? 12; if (h !== nowHour) continue; if (a.trigger_type === 'daily') dailyTenants.add(a.tenant_id); if (a.trigger_type === 'birthday') birthdayTenants.add(a.tenant_id) }
  let dailyFired = 0, birthdayFired = 0
  for (const t of dailyTenants) { await fire('daily', t, { at: new Date().toISOString() }); dailyFired++ }
  if (birthdayTenants.size) {
    const today = new Date(); const mmdd = `${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
    for (const t of birthdayTenants) {
      const { data: contacts } = await admin.from('contacts').select('id,name,email,birthdate').eq('tenant_id', t).not('birthdate', 'is', null)
      for (const c of contacts || []) { if (String(c.birthdate).slice(5, 10) === mmdd) { await fire('birthday', t, { contact_id: c.id, name: c.name, customer_email: c.email }); birthdayFired++ } }
    }
  }
  return json({ ok: true, hour_utc: nowHour, daily_fired: dailyFired, birthday_fired: birthdayFired })
})
