import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/admin/ui'
import { Overview } from '../components/admin/Overview'
import { ContentEditor } from '../components/admin/ContentEditor'
import { ServicesManager } from '../components/admin/ServicesManager'
import { PortfolioManager } from '../components/admin/PortfolioManager'
import { MediaLibrary } from '../components/admin/MediaLibrary'
import { MessagesPanel } from '../components/admin/MessagesPanel'
import { SettingsPanel } from '../components/admin/SettingsPanel'

const NAV = [
  { key: 'overview', label: 'Visão geral', icon: 'grid' },
  { key: 'content', label: 'Conteúdo', icon: 'layout' },
  { key: 'services', label: 'Serviços', icon: 'spark' },
  { key: 'portfolio', label: 'Portfólio', icon: 'image' },
  { key: 'media', label: 'Mídia', icon: 'folder' },
  { key: 'messages', label: 'Mensagens', icon: 'mail' },
  { key: 'settings', label: 'Configurações', icon: 'gear' },
]

export function AdminDashboard({ onExit }) {
  const { user, logout } = useAuth()
  const [active, setActive] = useState('overview')
  const [toasts, setToasts] = useState([])
  const [navOpen, setNavOpen] = useState(false)

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }
  const go = (k) => {
    setActive(k)
    setNavOpen(false)
  }

  const modules = {
    overview: <Overview go={go} />,
    content: <ContentEditor notify={notify} />,
    services: <ServicesManager notify={notify} />,
    portfolio: <PortfolioManager notify={notify} />,
    media: <MediaLibrary notify={notify} />,
    messages: <MessagesPanel notify={notify} />,
    settings: <SettingsPanel notify={notify} />,
  }

  return (
    <div className="min-h-screen bg-ink text-ivory flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-gold/10 bg-moss/20 sticky top-0 h-screen">
        <div className="p-6 border-b border-gold/10">
          <div className="font-serif text-2xl">Seravie</div>
          <div className="text-[9px] tracking-widestx text-gold/80">EXPERIENCES · CMS</div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => go(n.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                active === n.key ? 'bg-gold/15 text-gold' : 'text-ivory/60 hover:text-ivory hover:bg-ivory/5'
              }`}
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur border-b border-gold/10 px-6 py-4 flex items-center justify-between">
          <button className="lg:hidden text-ivory/70" onClick={() => setNavOpen((o) => !o)}>
            <Icon name="grid" className="w-6 h-6" />
          </button>
          <div className="hidden lg:block text-[11px] tracking-widerx uppercase text-ivory/40">
            Painel administrativo
          </div>
          <div className="flex items-center gap-4">
            <span className="text-ivory/45 text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={onExit}
              className="inline-flex items-center gap-2 px-3 py-2 text-[10px] tracking-widerx uppercase border border-gold/30 text-champagne rounded-md hover:bg-gold/10 transition-colors"
            >
              <Icon name="eye" className="w-4 h-4" />
              Ver site
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 text-[10px] tracking-widerx uppercase text-ivory/50 hover:text-red-300 transition-colors"
            >
              <Icon name="logout" className="w-4 h-4" />
              Sair
            </button>
          </div>
        </header>

        {navOpen && (
          <div className="lg:hidden border-b border-gold/10 bg-moss/30 p-3 grid grid-cols-2 gap-2">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  active === n.key ? 'bg-gold/15 text-gold' : 'text-ivory/60'
                }`}
              >
                <Icon name={n.icon} className="w-4 h-4" />
                {n.label}
              </button>
            ))}
          </div>
        )}

        <main className="p-6 lg:p-10 max-w-6xl">{modules[active]}</main>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-lg text-sm shadow-xl border ${
              t.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                : t.type === 'success'
                ? 'bg-moss/95 border-gold/40 text-champagne'
                : 'bg-moss/95 border-gold/20 text-ivory'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
