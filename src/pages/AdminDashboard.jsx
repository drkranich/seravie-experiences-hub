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
import { CollectionManager } from '../components/admin/CollectionManager'
import { collectionConfigs } from '../components/admin/collections.config'
import { NewsletterInbox } from '../components/admin/NewsletterInbox'

const NAV = [
  { key: 'overview', label: 'Visão geral', icon: 'grid' },
  { key: 'content', label: 'Conteúdo', icon: 'layout' },
  { key: 'services', label: 'Serviços', icon: 'spark' },
  { key: 'portfolio', label: 'Portfólio', icon: 'image' },
  { key: 'process', label: 'Processo', icon: 'check' },
  { key: 'segments', label: 'Segmentos', icon: 'leaf' },
  { key: 'jornal', label: 'Jornal', icon: 'book' },
  { key: 'testimonials', label: 'Depoimentos', icon: 'star' },
  { key: 'faqs', label: 'FAQ', icon: 'spark' },
  { key: 'team', label: 'Equipe', icon: 'user' },
  { key: 'pages', label: 'Páginas', icon: 'layout' },
  { key: 'menus', label: 'Menus', icon: 'link' },
  { key: 'media', label: 'Mídia', icon: 'folder' },
  { key: 'messages', label: 'Mensagens', icon: 'mail' },
  { key: 'newsletter', label: 'Newsletter', icon: 'gift' },
  { key: 'translations', label: 'Traduções', icon: 'external' },
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
    process: <CollectionManager {...collectionConfigs.process} notify={notify} />,
    segments: <CollectionManager {...collectionConfigs.segments} notify={notify} />,
    jornal: <CollectionManager {...collectionConfigs.posts} notify={notify} />,
    testimonials: <CollectionManager {...collectionConfigs.testimonials} notify={notify} />,
    faqs: <CollectionManager {...collectionConfigs.faqs} notify={notify} />,
    team: <CollectionManager {...collectionConfigs.team} notify={notify} />,
    pages: <CollectionManager {...collectionConfigs.pages} notify={notify} />,
    menus: <CollectionManager {...collectionConfigs.menus} notify={notify} />,
    media: <MediaLibrary notify={notify} />,
    messages: <MessagesPanel notify={notify} />,
    newsletter: <NewsletterInbox notify={notify} />,
    translations: <CollectionManager {...collectionConfigs.translations} notify={notify} />,
    settings: <SettingsPanel notify={notify} />,
  }

  const NavButton = ({ n, mobile }) => (
    <button
      onClick={() => go(n.key)}
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
        active === n.key
          ? 'bg-admin-champ/12 text-admin-champ'
          : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.03]'
      }`}
    >
      {active === n.key && !mobile && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-admin-champ" />
      )}
      <Icon name={n.icon} className="w-5 h-5" />
      {n.label}
    </button>
  )

  return (
    <div className="min-h-screen admin-bg text-admin-text flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 bg-admin-side/70 backdrop-blur-xl border-r border-admin-champ/10 sticky top-0 h-screen">
        <div className="p-7 border-b border-admin-champ/10">
          <div className="font-serif text-3xl text-admin-text leading-none">Seravie</div>
          <div className="text-[9px] tracking-widestx text-admin-champ/80 mt-1.5">EXPERIENCES · CMS</div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavButton key={n.key} n={n} />
          ))}
        </nav>
        <div className="p-4 border-t border-admin-champ/10 text-[10px] tracking-widerx uppercase text-admin-muted/50">
          Backstage Seravie
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-admin-side/40 backdrop-blur-xl border-b border-admin-champ/10 px-6 py-4 flex items-center justify-between">
          <button className="lg:hidden text-admin-muted" onClick={() => setNavOpen((o) => !o)}>
            <Icon name="grid" className="w-6 h-6" />
          </button>
          <div className="hidden lg:block text-[11px] tracking-widerx uppercase text-admin-muted/50">
            Painel administrativo
          </div>
          <div className="flex items-center gap-4">
            <span className="text-admin-muted text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={onExit}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] tracking-widerx uppercase border border-admin-champ/25 text-admin-champ rounded-xl hover:bg-white/5 transition-colors"
            >
              <Icon name="eye" className="w-4 h-4" />
              Ver site
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 text-[10px] tracking-widerx uppercase text-admin-muted hover:text-admin-rose transition-colors"
            >
              <Icon name="logout" className="w-4 h-4" />
              Sair
            </button>
          </div>
        </header>

        {navOpen && (
          <div className="lg:hidden border-b border-admin-champ/10 bg-admin-side/80 backdrop-blur-xl p-3 grid grid-cols-2 gap-2">
            {NAV.map((n) => (
              <NavButton key={n.key} n={n} mobile />
            ))}
          </div>
        )}

        <main className="p-6 lg:p-12 max-w-6xl">{modules[active]}</main>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass rounded-2xl px-5 py-3.5 text-sm flex items-center gap-3 ${
              t.type === 'error' ? 'text-admin-rose' : t.type === 'success' ? 'text-admin-champ' : 'text-admin-text'
            }`}
          >
            <Icon name={t.type === 'error' ? 'x' : 'check'} className="w-4 h-4 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
