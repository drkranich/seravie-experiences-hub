import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../hooks/useTenant'
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
import { CRMPanel } from '../components/admin/CRMPanel'
import { ConversationsInbox } from '../components/admin/ConversationsInbox'
import { TicketsPanel } from '../components/admin/TicketsPanel'

const NAV_GROUPS = [
  {
    group: 'Core',
    items: [
      { key: 'overview', label: 'Backstage', icon: 'grid' },
    ],
  },
  {
    group: 'Atendimento',
    items: [
      { key: 'crm', label: 'CRM', icon: 'user' },
      { key: 'conversations', label: 'Conversas', icon: 'mail' },
      { key: 'helpdesk', label: 'Help Desk', icon: 'check' },
      { key: 'messages', label: 'Formulários', icon: 'mail' },
      { key: 'newsletter', label: 'Newsletter', icon: 'gift' },
    ],
  },
  {
    group: 'Conteúdo',
    items: [
      { key: 'content', label: 'Seções', icon: 'layout' },
      { key: 'services', label: 'Serviços', icon: 'spark' },
      { key: 'portfolio', label: 'Portfólio', icon: 'image' },
      { key: 'process', label: 'Processo', icon: 'check' },
      { key: 'segments', label: 'Segmentos', icon: 'leaf' },
      { key: 'jornal', label: 'Jornal', icon: 'book' },
      { key: 'testimonials', label: 'Depoimentos', icon: 'star' },
      { key: 'faqs', label: 'FAQ', icon: 'spark' },
    ],
  },
  {
    group: 'Estrutura',
    items: [
      { key: 'team', label: 'Equipe', icon: 'user' },
      { key: 'pages', label: 'Páginas', icon: 'layout' },
      { key: 'menus', label: 'Menus', icon: 'link' },
      { key: 'media', label: 'Biblioteca', icon: 'folder' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { key: 'settings', label: 'Configurações', icon: 'gear' },
    ],
  },
]

export function AdminDashboard({ onExit }) {
  const { user, logout } = useAuth()
  const { profile } = useTenant()
  const [active, setActive] = useState('overview')
  const [toasts, setToasts] = useState([])
  const [navOpen, setNavOpen] = useState(false)

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  const go = (k) => { setActive(k); setNavOpen(false) }

  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === active)?.label || ''

  const modules = {
    overview: <Overview go={go} />,
    crm: <CRMPanel notify={notify} />,
    conversations: <ConversationsInbox notify={notify} />,
    helpdesk: <TicketsPanel notify={notify} />,
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
    settings: <SettingsPanel notify={notify} />,
  }

  const NavItem = ({ n }) => (
    <button onClick={() => go(n.key)}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 ${
        active === n.key ? 'bg-white/[0.06] text-admin-champ' : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.03]'
      }`}>
      {active === n.key && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-admin-champ" />}
      <Icon name={n.icon} className="w-4 h-4 shrink-0 opacity-70" />
      <span className="truncate">{n.label}</span>
    </button>
  )

  return (
    <div className="min-h-screen admin-bg text-admin-text flex" data-no-translate>
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-admin-side/80 backdrop-blur-2xl border-r border-white/[0.06] sticky top-0 h-screen">
        <div className="px-5 pt-7 pb-5 border-b border-white/[0.06]">
          <div className="font-serif text-2xl text-admin-text leading-none tracking-wide">Seravie</div>
          <div className="text-[8px] tracking-[0.2em] text-admin-champ/60 mt-1 uppercase">{profile?.tenant_name || 'Experiences'} · CMS</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_GROUPS.map((g) => (
            <div key={g.group}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-admin-muted/40 px-3 mb-2">{g.group}</p>
              <div className="space-y-0.5">{g.items.map((n) => <NavItem key={n.key} n={n} />)}</div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-admin-champ/20 flex items-center justify-center">
              <Icon name="user" className="w-3.5 h-3.5 text-admin-champ" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-admin-text truncate">{profile?.role_name || 'Admin'}</p>
              <p className="text-[9px] text-admin-muted/50 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-admin-side/40 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-admin-muted hover:text-admin-text transition-colors" onClick={() => setNavOpen((o) => !o)}>
              <Icon name="grid" className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-[11px] text-admin-muted/60">
              <span className="hidden sm:block">Seravie</span>
              <span className="hidden sm:block opacity-30">/</span>
              <span className="text-admin-champ/80">{activeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExit} className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-wider uppercase border border-admin-champ/20 text-admin-champ/70 rounded-lg hover:bg-white/[0.04] transition-colors">
              <Icon name="eye" className="w-3.5 h-3.5" /><span className="hidden sm:block">Ver site</span>
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-rose transition-colors rounded-lg hover:bg-white/[0.03]">
              <Icon name="logout" className="w-3.5 h-3.5" /><span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </header>

        {navOpen && (
          <div className="lg:hidden border-b border-white/[0.06] bg-admin-side/90 backdrop-blur-xl px-4 py-4 space-y-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-admin-muted/40 mb-2">{g.group}</p>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map((n) => (
                    <button key={n.key} onClick={() => go(n.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors ${active === n.key ? 'bg-white/[0.08] text-admin-champ' : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.03]'}`}>
                      <Icon name={n.icon} className="w-4 h-4 shrink-0" />{n.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <main className={`flex-1 ${['conversations','helpdesk'].includes(active) ? '' : 'p-6 lg:p-10 max-w-6xl w-full'}`}>
          {modules[active]}
        </main>
      </div>

      {/* TOASTS */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`glass rounded-xl px-5 py-3 text-[13px] flex items-center gap-3 pointer-events-auto shadow-xl ${
            t.type === 'error' ? 'text-admin-rose' : t.type === 'success' ? 'text-admin-champ' : 'text-admin-text'
          }`}>
            <Icon name={t.type === 'error' ? 'x' : 'check'} className="w-4 h-4 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
