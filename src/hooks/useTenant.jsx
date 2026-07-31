import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfile(null); setLoading(false); return }
    const { data, error } = await supabase.rpc('get_my_profile')
    if (!error && data) setProfile(data)
    else setProfile(null)
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })
    return () => subscription.unsubscribe()
  }, [])

  const hasModule = (slug) => {
    if (!profile?.modules) return false
    return profile.modules.includes(slug)
  }

  const hasPermission = (perm) => {
    if (!profile?.permissions) return false
    return profile.permissions.includes('*') || profile.permissions.includes(perm)
  }

  const isSuperAdmin = () => profile?.role_slug === 'super_admin'
  const isAdmin = () => ['super_admin', 'admin'].includes(profile?.role_slug)

  // RBAC — permissões no formato array: '*', 'view:<mod>', 'manage:<mod>'.
  const permsList = () => (Array.isArray(profile?.permissions) ? profile.permissions : [])
  const can = (perm) => permsList().includes('*') || permsList().includes(perm)
  const canView = (mod) => isAdmin() || can(`view:${mod}`) || can(`manage:${mod}`)
  const canManage = (mod) => isAdmin() || can(`manage:${mod}`)

  return (
    <TenantContext.Provider value={{
      profile,
      loading,
      hasModule,
      hasPermission,
      isSuperAdmin,
      isAdmin,
      can,
      canView,
      canManage,
      reload: loadProfile
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
