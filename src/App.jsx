import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { AdminDashboard } from './pages/AdminDashboard'
import { Home } from './pages/Home'
import { ADMIN_EMAIL } from './config'

export default function App() {
  const [page, setPage] = useState('home') // home, admin
  const { user, loading: authLoading, logout } = useAuth()

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/60 font-serif text-2xl tracking-widest">
        Carregando…
      </div>
    )
  }

  // Admin Panel
  if (page === 'admin') {
    if (!user) {
      return <Login onLoginSuccess={() => setPage('admin')} />
    }
    // Apenas o super admin autorizado acessa o painel
    if (user.email !== ADMIN_EMAIL) {
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
              onClick={() => setPage('home')}
              className="border border-gold/50 text-champagne px-5 py-2.5 text-[11px] tracking-widerx uppercase hover:bg-gold/10 transition-colors"
            >
              Voltar ao site
            </button>
          </div>
        </div>
      )
    }
    return <AdminDashboard onExit={() => setPage('home')} />
  }

  // Home (landing)
  return <Home onAdmin={() => setPage('admin')} />
}
