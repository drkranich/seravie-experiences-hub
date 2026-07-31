import { supabase } from './supabase'

// Registra um evento de autenticação (login, logout, troca de senha) na trilha.
// Descobre o tenant do usuário (get_my_profile) para respeitar a RLS de audit_logs.
export async function logAuthEvent(action, extra = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.rpc('get_my_profile')
    const tenantId = prof?.tenant_id
    if (!tenantId) return
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, user_id: user.id, action, resource_type: 'auth', resource_id: user.id,
      new_data: { email: user.email, ...extra },
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    /* auditoria é best-effort */
  }
}

// Registra uma ação no log de auditoria (best-effort: nunca quebra o fluxo).
// Preenche tenant_id (passado) e user_id (sessão atual) automaticamente.
export async function logAudit({ action, resource_type, resource_id, old_data = null, new_data = null }, tenantId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId || null,
      user_id: user?.id || null,
      action,
      resource_type,
      resource_id: resource_id != null ? String(resource_id) : null,
      old_data,
      new_data,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    /* auditoria é best-effort */
  }
}
