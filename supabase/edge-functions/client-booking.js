// client-booking — agendamentos, reservas e assinaturas do CLIENTE final (anônimo).
// Usa service role. Valida o tenant pelo slug e o recurso pelo id.
// (Deploy: verify_jwt=false — cliente anônimo.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  let p = {}
  try { p = await req.json() } catch { /* vazio */ }
  const slug = String(p.slug || '')
  const kind = String(p.kind || '')
  if (!slug) return json({ error: 'missing_slug' }, 400)
  const { data: tenant } = await admin.from('tenants').select('id,name').eq('slug', slug).maybeSingle()
  if (!tenant) return json({ error: 'tenant_not_found' }, 404)
  const tenantId = tenant.id

  if (kind === 'appointment') {
    const { data: svc } = await admin.from('spa_services').select('*').eq('id', p.service_id).eq('tenant_id', tenantId).eq('is_active', true).maybeSingle()
    if (!svc) return json({ error: 'service_not_found' }, 404)
    if (!p.date || !p.time) return json({ error: 'missing_slot' }, 400)
    if (p.professional) {
      const { data: clash } = await admin.from('appointments').select('id').eq('tenant_id', tenantId).eq('date', p.date).eq('time', p.time).eq('professional', p.professional).neq('status', 'cancelled').maybeSingle()
      if (clash) return json({ error: 'slot_taken' }, 409)
    }
    const { data: appt, error } = await admin.from('appointments').insert({ tenant_id: tenantId, customer_name: p.customer_name || 'Cliente', service: svc.name, professional: p.professional || null, date: p.date, time: p.time, status: 'scheduled', notes: p.notes || null }).select('id').single()
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, appointment_id: appt.id })
  }
  if (kind === 'tour') {
    const { data: tour } = await admin.from('tours').select('*').eq('id', p.tour_id).eq('tenant_id', tenantId).eq('status', 'active').maybeSingle()
    if (!tour) return json({ error: 'tour_not_found' }, 404)
    const people = Math.max(1, parseInt(p.people) || 1)
    const total = (Number(tour.price) || 0) * people
    const { data: order, error } = await admin.from('orders').insert({ tenant_id: tenantId, status: 'confirmed', payment_status: 'pending', total, customer_name: p.customer_name || 'Cliente', channel: 'reserva', items: [{ name: tour.name, qty: people, unit_price: tour.price, date: p.date }], notes: `Reserva: ${tour.name} · ${p.date} · ${people} pessoa(s)` }).select('id').single()
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, order_id: order.id, total })
  }
  if (kind === 'club') {
    const { data: plan } = await admin.from('club_plans').select('*').eq('id', p.plan_id).eq('tenant_id', tenantId).eq('active', true).maybeSingle()
    if (!plan) return json({ error: 'plan_not_found' }, 404)
    const { data: sub, error } = await admin.from('club_subscriptions').insert({ tenant_id: tenantId, plan_id: plan.id, customer_name: p.customer_name || 'Cliente', customer_email: p.customer_email || null, status: 'active' }).select('id').single()
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, subscription_id: sub.id, plan: plan.name, price: plan.price })
  }
  return json({ error: 'invalid_kind' }, 400)
})
