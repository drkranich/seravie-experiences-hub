import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTenant } from './hooks/useTenant'
import { useSettings } from './hooks/useSettings'
import { Login } from './pages/Login'
import { AdminDashboard } from './pages/AdminDashboard'
import { Home } from './pages/Home'
import { Storefront } from './pages/Storefront'
import { FlowStore } from './pages/FlowStore'
import { AcceptInvite } from './pages/AcceptInvite'
import { RecoverPassword } from './pages/RecoverPassword'

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const { profile, loading: tenantLoading, isAdmin } = useTenant()
  const { settings } = useSettings()

  // Favicon e título dinâmicos (Configurações → Logo & Favicon)
  useEffect(() => {
    const fav = settings?.brand?.favicon_url
    if (fav) {
      let link = document.querySelector("link[rel~='icon']")
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = fav
    }
    if (settings?.seo?.title) document.title = settings.seo.title
  }, [settings])

  // Aguardar auth carregar
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/60 font-serif text-2xl tracking-widest">
        Carregando…
      </div>
    )
  }

  // Rota da loja pública (tem precedência: funciona logado ou não)
  const isStoreRoute = window.location.hash.startsWith('#loja') || /[?&](store|loja)=/.test(window.location.search)
  if (isStoreRoute) return <Storefront />

  // Seravie Flow — página pública de venda por QR Code (#flow/<code>)
  if (window.location.hash.startsWith('#flow')) return <FlowStore />

  // Aceite de convite de equipe (precedência: funciona logado ou não)
  if (window.location.hash.startsWith('#convite')) return <AcceptInvite />

  // Redefinição de senha (chega pelo link do e-mail de recuperação)
  if (window.location.hash.startsWith('#recuperar')) return <RecoverPassword />

  // Rota do site público (precedência sobre o admin, mesmo logado — "Ver site").
  // #topo é reconhecido pela Home como 'home' (página completa).
  const isSiteRoute = window.location.hash === '#topo' || window.location.hash === '#site'
  if (isSiteRoute) return <Home onAdmin={() => { window.location.hash = '#admin'; window.location.reload() }} />

  // Rota admin
  const isAdminRoute = window.location.hash === '#admin' || window.location.search.includes('admin')

  if (isAdminRoute || (user && profile)) {
    // Sem usuário: mostrar login
    if (!user) return <Login onLoginSuccess={() => {}} />

    // Aguardar perfil do tenant carregar
    if (tenantLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/60 font-serif text-xl tracking-widest">
          Verificando acesso…
        </div>
      )
    }

    // Sem perfil ou sem permissão admin
    if (!profile || !isAdmin()) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-ivory p-4 text-center">
          <h1 className="font-serif text-3xl mb-2">Acesso não autorizado</h1>
          <p className="text-ivory/60 mb-6">
            A conta <strong>{user.email}</strong> não tem permissão de administrador.
          </p>
          <div className="flex gap-3">
            <button
              onClick={async () => { await logout() }}
              className="bg-gold text-ink px-5 py-2.5 text-[11px] tracking-widerx uppercase hover:bg-champagne transition-colors"
            >
              Sair
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="border border-gold/50 text-champagne px-5 py-2.5 text-[11px] tracking-widerx uppercase hover:bg-gold/10 transition-colors"
            >
              Voltar ao site
            </button>
          </div>
        </div>
      )
    }

    return <AdminDashboard onExit={() => { window.location.hash = '#topo'; window.location.reload() }} />
  }

  // Home (landing pública)
  return <Home onAdmin={() => { window.location.hash = '#admin'; window.location.reload() }} />
}
