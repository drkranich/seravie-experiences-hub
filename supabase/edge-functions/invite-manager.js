// invite-manager — convida um gerente por e-mail, vinculado a uma UNIDADE da rede.
//
// Fluxo:
//   1) valida o JWT do chamador e confere que ele é admin/super_admin do tenant;
//   2) cria (ou reaproveita) o usuário no Supabase Auth pelo e-mail e dispara o
//      convite para ele definir a senha (inviteUserByEmail);
//   3) garante um papel "manager" (Gestor) no tenant e cria/atualiza a membership
//      vinculada ao tenant + unit_id, status 'active'.
//
// Cada gerente usa o PRÓPRIO e-mail e enxerga (via RLS/unit_id) apenas a sua unidade.
// O dono da rede continua com uma conta única vendo tudo consolidado.
//
// Corpo (JSON): { email, unit_id, name?, role_slug? (default 'manager'), redirect_to? }
// Auth: JWT do usuário. Deploy: verify_jwt=false (valida internamente).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ''))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  // 1) quem chama precisa ser admin/super_admin do tenant
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const caller = userData?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)
  const { data: callerMem } = await admin.from('memberships').select('tenant_id, status, roles!inner(slug)').eq('user_id', caller.id).eq('status', 'active').maybeSingle()
  const tenantId = callerMem?.tenant_id
  const callerRole = callerMem?.roles?.slug
  if (!tenantId) return json({ error: 'no_tenant' }, 403)
  if (!['admin', 'super_admin'].includes(callerRole)) return json({ error: 'forbidden', detail: 'Apenas admin ou super admin pode convidar gerentes.' }, 403)

  let p = {}; try { p = await req.json() } catch { /* vazio */ }
  const email = String(p.email || '').trim().toLowerCase()
  const unitId = p.unit_id || null
  const roleSlug = p.role_slug || 'manager'
  const name = p.name || null
  if (!isEmail(email)) return json({ error: 'invalid_email' }, 400)

  // valida a unidade (se informada) — precisa ser do mesmo tenant
  if (unitId) {
    const { data: unit } = await admin.from('units').select('id').eq('id', unitId).eq('tenant_id', tenantId).maybeSingle()
    if (!unit) return json({ error: 'unit_not_found', detail: 'Unidade não pertence a esta rede.' }, 400)
  }

  // 2) usuário no Auth: reaproveita se já existir; senão convida
  let targetUser = null
  let invited = false
  // procura por e-mail na lista de usuários (paginado; suficiente para a maioria dos casos)
  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    targetUser = (list?.users || []).find((u) => (u.email || '').toLowerCase() === email) || null
  } catch { /* segue para invite */ }

  if (!targetUser) {
    const redirectTo = p.redirect_to || undefined
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name || undefined, invited_to_tenant: tenantId }, redirectTo })
    if (invErr) {
      // fallback: cria o usuário sem senha (ele recebe magic-link no primeiro acesso)
      const { data: cr, error: crErr } = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: name || undefined, invited_to_tenant: tenantId } })
      if (crErr) return json({ error: 'auth_failed', detail: crErr.message || invErr.message }, 400)
      targetUser = cr.user
    } else {
      targetUser = inv.user; invited = true
    }
  }
  if (!targetUser?.id) return json({ error: 'auth_no_user' }, 400)

  // 3) papel "manager" do tenant (cria se não existir)
  let roleId = null
  {
    const { data: role } = await admin.from('roles').select('id').eq('tenant_id', tenantId).eq('slug', roleSlug).maybeSingle()
    if (role?.id) roleId = role.id
    else {
      const { data: sysRole } = await admin.from('roles').select('id').eq('slug', roleSlug).eq('is_system', true).limit(1).maybeSingle()
      if (sysRole?.id) roleId = sysRole.id
      else {
        const { data: nr } = await admin.from('roles').insert({ tenant_id: tenantId, slug: roleSlug, name: roleSlug === 'manager' ? 'Gestor' : roleSlug, is_system: false }).select('id').single()
        roleId = nr?.id || null
      }
    }
  }

  // 3b) membership vinculada ao tenant + unidade
  const { data: existing } = await admin.from('memberships').select('id').eq('user_id', targetUser.id).eq('tenant_id', tenantId).maybeSingle()
  const memPayload = { user_id: targetUser.id, tenant_id: tenantId, role_id: roleId, unit_id: unitId, status: 'active', email, invited_by: caller.id, invited_at: new Date().toISOString() }
  let memErr = null
  if (existing?.id) {
    const r = await admin.from('memberships').update({ role_id: roleId, unit_id: unitId, status: 'active' }).eq('id', existing.id); memErr = r.error
  } else {
    const r = await admin.from('memberships').insert(memPayload); memErr = r.error
  }
  if (memErr) return json({ error: 'membership_failed', detail: memErr.message }, 400)

  return json({ ok: true, invited, user_id: targetUser.id, tenant_id: tenantId, unit_id: unitId, role: roleSlug })
})
