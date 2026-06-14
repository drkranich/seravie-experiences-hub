// Multi-tenant Setup para SaaS
import { supabase } from '../lib/supabase'

export class TenantManager {
  constructor() {
    this.currentTenant = null
  }

  async setTenant(tenantId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error) throw error

    this.currentTenant = data
    localStorage.setItem('current_tenant', tenantId)

    // Setar header para futuras requisições
    this.setupHeaders(tenantId)

    return data
  }

  getTenant() {
    return this.currentTenant
  }

  setupHeaders(tenantId) {
    // Headers para isolamento de dados multi-tenant
    const headers = {
      'X-Tenant-ID': tenantId,
    }
    return headers
  }

  async getUserTenants(userId) {
    const { data, error } = await supabase
      .from('user_organizations')
      .select('organizations(*)')
      .eq('user_id', userId)

    if (error) throw error
    return data
  }

  async createTenant(name, domain) {
    const { data, error } = await supabase
      .from('organizations')
      .insert([
        {
          name,
          domain,
          plan_id: 'free',
          subscription_status: 'active',
        },
      ])
      .select()

    if (error) throw error
    return data[0]
  }

  async addUserToTenant(userId, tenantId, role = 'editor') {
    const { data, error } = await supabase
      .from('user_organizations')
      .insert([
        {
          user_id: userId,
          organization_id: tenantId,
          role,
        },
      ])

    if (error) throw error
    return data
  }
}

export const tenantManager = new TenantManager()
