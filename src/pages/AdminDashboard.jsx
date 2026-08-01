import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../hooks/useTenant'
import { useSettings } from '../hooks/useSettings'
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
import { OperationsPanel } from '../components/admin/OperationsPanel'
import { FranchisePanel } from '../components/admin/FranchisePanel'
import { TeamPanel } from '../components/admin/TeamPanel'
import { KnowledgeHub } from '../components/admin/KnowledgeHub'
import { MarketingPanel } from '../components/admin/MarketingPanel'
import { CatalogPanel } from '../components/admin/CatalogPanel'
import { VerticalsPanel } from '../components/admin/VerticalsPanel'
import { AIPanel } from '../components/admin/AIPanel'
import { AnalyticsPanel } from '../components/admin/AnalyticsPanel'
import { SuperAdminPanel } from '../components/admin/SuperAdminPanel'
import { POSPanel } from '../components/admin/POSPanel'
import { ChocolatePanel } from '../components/admin/ChocolatePanel'
import { EmporioPanel } from '../components/admin/EmporioPanel'
import { CoffeePanel } from '../components/admin/CoffeePanel'
import { WinePanel } from '../components/admin/WinePanel'
import { EventsPanel } from '../components/admin/EventsPanel'
import { GiftPanel } from '../components/admin/GiftPanel'
import { VerticalCatalogPanel } from '../components/admin/VerticalCatalogPanel'
import { SpaPanel } from '../components/admin/SpaPanel'
import { TourismPanel } from '../components/admin/TourismPanel'
import { ArchitecturePanel } from '../components/admin/ArchitecturePanel'
import { CraftPanel } from '../components/admin/CraftPanel'
import { StorePanel } from '../components/admin/StorePanel'
import { FinancePanel } from '../components/admin/FinancePanel'
import { AgendaPanel } from '../components/admin/AgendaPanel'
import { AutomationPanel } from '../components/admin/AutomationPanel'
import { RolesPanel } from '../components/admin/RolesPanel'
import { AuditLogPanel } from '../components/admin/AuditLogPanel'
import { PlansAdmin } from '../components/admin/PlansAdmin'
import { UsersPanel } from '../components/admin/UsersPanel'
import { CoursesPanel, CouponsPanel, SlaPanel, GoalsPanel, EquipmentPanel } from '../components/admin/modulePanels'
import { PayablesPanel, DrePanel } from '../components/admin/FinanceAdvanced'
import { NpsPanel } from '../components/admin/NpsPanel'
import { MessagingChannels } from '../components/admin/MessagingChannels'
import { SalesView, ContactsView, StockView } from '../components/admin/AutoViews'
import { ExpansaoPanel, FranqueadosPanel, ImplantacoesPanel, StandardsPanel, CertificationPanel } from '../components/admin/NetworkPanels'
import { OfficialCatalogPanel } from '../components/admin/OfficialCatalogPanel'
import { SubscriptionPanel } from '../components/admin/SubscriptionPanel'
import { ReceivablesPanel } from '../components/admin/ReceivablesPanel'
import { Onboarding } from '../components/admin/Onboarding'
import { ScaffoldPage } from '../components/admin/ScaffoldPage'
import { CORE_SECTIONS, verticalToNav } from '../components/admin/navigation.config'

const FULLSCREEN = ['conversations', 'helpdesk', 'pos']
const ROUTE_LABELS = { catalog: 'Catálogo', messages: 'Formulários', franchise: 'Franquias' }

export function AdminDashboard({ onExit }) {
  const { user, logout } = useAuth()
  const { profile, isAdmin } = useTenant()
  const { settings } = useSettings()
  const brand = settings?.brand || {}
  const [active, setActive] = useState('overview')
  const [expanded, setExpanded] = useState({})
  const [toasts, setToasts] = useState([])
  const [navOpen, setNavOpen] = useState(false)
  const [verticals, setVerticals] = useState([])
  const [verticalsLoaded, setVerticalsLoaded] = useState(false)

  const loadVerticals = () => supabase.from('vertical_configs').select('vertical')
    .then(({ data }) => { setVerticals((data || []).map((d) => d.vertical)); setVerticalsLoaded(true) })
  useEffect(() => { loadVerticals() }, [])

  const needsOnboarding = verticalsLoaded && verticals.length === 0 && isAdmin && isAdmin()

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  // Painéis reais (rotas com implementação). O que não estiver aqui abre ScaffoldPage.
  const COMPONENTS = {
    overview: <Overview go={go} />,
    analytics: <AnalyticsPanel />,
    ai: <AIPanel notify={notify} />,
    crm: <CRMPanel notify={notify} />,
    conversations: <ConversationsInbox notify={notify} />,
    helpdesk: <TicketsPanel notify={notify} />,
    operations: <OperationsPanel notify={notify} />,
    franchise: <FranchisePanel notify={notify} />,
    team: <TeamPanel notify={notify} />,
    knowledge: <KnowledgeHub notify={notify} />,
    marketing: <MarketingPanel notify={notify} />,
    catalog: <CatalogPanel notify={notify} />,
    finance: <FinancePanel notify={notify} />,
    agenda: <AgendaPanel notify={notify} />,
    automations: <AutomationPanel notify={notify} />,
    pos: <POSPanel notify={notify} />,
    ecommerce: <StorePanel notify={notify} />,
    chocolate: <ChocolatePanel notify={notify} />,
    gourmet: <EmporioPanel notify={notify} />,
    coffee: <CoffeePanel notify={notify} />,
    wine: <WinePanel notify={notify} />,
    events: <EventsPanel notify={notify} />,
    gift: <GiftPanel notify={notify} />,
    brewery: <VerticalCatalogPanel vertical="brewery" notify={notify} />,
    bakery: <VerticalCatalogPanel vertical="bakery" notify={notify} />,
    floriculture: <VerticalCatalogPanel vertical="floriculture" notify={notify} />,
    beauty: <VerticalCatalogPanel vertical="beauty" notify={notify} />,
    spa: <SpaPanel notify={notify} />,
    tourism: <TourismPanel notify={notify} />,
    architecture: <ArchitecturePanel notify={notify} />,
    artesanato: <CraftPanel notify={notify} />,
    verticals: <VerticalsPanel notify={notify} />,
    content: <ContentEditor notify={notify} />,
    services: <ServicesManager notify={notify} />,
    portfolio: <PortfolioManager notify={notify} />,
    process: <CollectionManager {...collectionConfigs.process} notify={notify} />,
    segments: <CollectionManager {...collectionConfigs.segments} notify={notify} />,
    jornal: <CollectionManager {...collectionConfigs.posts} notify={notify} />,
    testimonials: <CollectionManager {...collectionConfigs.testimonials} notify={notify} />,
    faqs: <CollectionManager {...collectionConfigs.faqs} notify={notify} />,
    pages: <CollectionManager {...collectionConfigs.pages} notify={notify} />,
    menus: <CollectionManager {...collectionConfigs.menus} notify={notify} />,
    media: <MediaLibrary notify={notify} />,
    messages: <MessagesPanel notify={notify} />,
    newsletter: <NewsletterInbox notify={notify} />,
    superadmin: <SuperAdminPanel notify={notify} />,
    settings: <SettingsPanel notify={notify} />,
    roles: <RolesPanel notify={notify} />,
    audit: <AuditLogPanel notify={notify} />,
    plans: <PlansAdmin notify={notify} />,
    subscription: <SubscriptionPanel notify={notify} />,
    receivables: <ReceivablesPanel notify={notify} />,
    users: <UsersPanel notify={notify} />,
    courses: <CoursesPanel notify={notify} />,
    coupons: <CouponsPanel notify={notify} />,
    sla: <SlaPanel notify={notify} />,
    goals: <GoalsPanel notify={notify} />,
    equipment: <EquipmentPanel notify={notify} />,
    payables: <PayablesPanel notify={notify} />,
    dre: <DrePanel notify={notify} />,
    nps: <NpsPanel notify={notify} />,
    msgchannels: <MessagingChannels notify={notify} />,
    salesview: <SalesView notify={notify} />,
    stockview: <StockView notify={notify} />,
    crm_leads: <ContactsView segment="leads" notify={notify} />,
    crm_companies: <ContactsView segment="companies" notify={notify} />,
    crm_vip: <ContactsView segment="vip" notify={notify} />,
    crm_customers: <ContactsView segment="customers" notify={notify} />,
    expansao: <ExpansaoPanel notify={notify} />,
    franqueados: <FranqueadosPanel notify={notify} />,
    implantacoes: <ImplantacoesPanel notify={notify} />,
    catalogo_oficial: <OfficialCatalogPanel notify={notify} />,
    standards: <StandardsPanel notify={notify} />,
    certification: <CertificationPanel notify={notify} />,
  }

  // Frentes especializadas ativas para o tenant (por vertical_configs).
  const sections = useMemo(() => {
    const VERTICAL_ROUTES = { franchise: 'franchise', chocolate: 'chocolate', gourmet: 'gourmet', coffee: 'coffee', wine: 'wine', events: 'events', gift: 'gift', brewery: 'brewery', bakery: 'bakery', floriculture: 'floriculture', beauty: 'beauty', spa: 'spa', tourism: 'tourism', architecture: 'architecture', artesanato: 'artesanato' } // frentes com painel real
    const frentes = verticals.map((v) => {
      const nav = verticalToNav(v)
      if (nav && VERTICAL_ROUTES[v]) nav.route = VERTICAL_ROUTES[v]
      return nav
    }).filter(Boolean)
    const base = [...CORE_SECTIONS]
    if (frentes.length) base.splice(1, 0, { group: 'Frentes do seu negócio', items: frentes })
    // Gating por papel (RBAC), no nível de PÁGINA: admin/super_admin veem tudo.
    const permsArr = Array.isArray(profile?.permissions) ? profile.permissions : []
    const full = ['super_admin', 'admin'].includes(profile?.role_slug) || permsArr.includes('*')
    const anyLevel = (key) => permsArr.includes('view:' + key) || permsArr.includes('edit:' + key) || permsArr.includes('manage:' + key)
    const gateItem = (item) => {
      if (full || item.key === 'overview' || String(item.key).startsWith('vertical.')) return item
      const modOK = anyLevel(item.key)
      if (modOK) return item // acesso ao módulo implica todas as páginas
      const pages = (item.pages || []).filter((p) => anyLevel(p.key))
      if (!pages.length) return null
      return { ...item, pages, route: pages[0].route || pages[0].key } // parcial: abre na 1ª página permitida
    }
    return base
      .map((sec) => ({ ...sec, items: sec.items.map(gateItem).filter(Boolean) }))
      .filter((sec) => sec.items.length)
  }, [verticals, profile])

  // Índice de navegação: key -> { item, parentLabel } (para ScaffoldPage/breadcrumb).
  const navIndex = useMemo(() => {
    const idx = {}
    for (const sec of sections) {
      for (const item of sec.items) {
        idx[item.key] = { item, parentLabel: sec.group }
        for (const p of (item.pages || [])) idx[p.key] = { item: p, parentLabel: item.label }
      }
    }
    return idx
  }, [sections])

  function go(key) { setActive(key); setNavOpen(false) }
  const toggle = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  const clickItem = (item) => {
    if (item.pages && item.pages.length) { toggle(item.key); go(item.route || item.key) }
    else go(item.route || item.key)
  }

  const activeLabel =
    navIndex[active]?.item?.label || ROUTE_LABELS[active] || 'Backstage'

  // Conteúdo: painel real ou ScaffoldPage
  const content = COMPONENTS[active] || (
    navIndex[active]
      ? <ScaffoldPage item={navIndex[active].item} parentLabel={navIndex[active].parentLabel} onNavigate={go} />
      : COMPONENTS.overview
  )

  const isItemActive = (item) =>
    active === (item.route || item.key) || (item.pages || []).some((p) => active === (p.route || p.key))

  const NavItem = ({ item }) => {
    const on = isItemActive(item)
    const hasPages = item.pages && item.pages.length > 0
    const isOpen = expanded[item.key]
    return (
      <div>
        <button onClick={() => clickItem(item)}
          className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 ${on ? 'bg-white/[0.06] text-admin-champ' : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.03]'}`}>
          {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-admin-champ" />}
          <Icon name={item.icon || 'spark'} className="w-3.5 h-3.5 shrink-0 opacity-60" />
          <span className="flex-1 text-left">{item.label}</span>
          {hasPages && <Icon name={isOpen ? 'up' : 'down'} className="w-3 h-3 shrink-0 opacity-40" />}
        </button>
        {hasPages && isOpen && (
          <div className="mt-0.5 mb-1 ml-4 pl-3 border-l border-white/[0.06] space-y-0.5">
            {item.pages.map((p) => {
              const pon = active === (p.route || p.key)
              return (
                <button key={p.key} onClick={() => go(p.route || p.key)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-colors ${pon ? 'text-admin-champ bg-white/[0.05]' : 'text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.03]'}`}>
                  {p.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen admin-bg text-admin-text flex" data-no-translate>
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-admin-side/80 backdrop-blur-2xl border-r border-white/[0.06] sticky top-0 h-screen">
        <div className="px-5 pt-7 pb-5 border-b border-white/[0.06]">
          {brand.logo_url
            ? <img src={brand.logo_url} alt="Seravie Experiences" className="max-h-9 w-auto object-contain" />
            : <div className="font-serif text-[22px] text-admin-text leading-tight tracking-wide">Seravie Experiences</div>}
          <div className="text-[8px] tracking-[0.2em] text-admin-champ/60 mt-1 uppercase">{profile?.tenant_name || 'Experience OS'} · Experience OS</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {sections.map((g) => (
            <div key={g.group}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-admin-muted/40 px-3 mb-2">{g.group}</p>
              <div className="space-y-0.5">{g.items.map((item) => <NavItem key={item.key} item={item} />)}</div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-admin-champ/20 flex items-center justify-center"><Icon name="user" className="w-3.5 h-3.5 text-admin-champ" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-admin-text truncate">{profile?.role_name || 'Admin'}</p>
              <p className="text-[9px] text-admin-muted/50 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-admin-side/40 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-admin-muted hover:text-admin-text transition-colors" onClick={() => setNavOpen((o) => !o)}><Icon name="grid" className="w-5 h-5" /></button>
            <div className="flex items-center gap-2 text-[11px] text-admin-muted/60">
              <span className="hidden sm:block">Seravie Experiences</span><span className="hidden sm:block opacity-30">/</span>
              <span className="text-admin-champ/80">{activeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExit} className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-wider uppercase border border-admin-champ/20 text-admin-champ/70 rounded-lg hover:bg-white/[0.04] transition-colors"><Icon name="eye" className="w-3.5 h-3.5" /><span className="hidden sm:block">Ver site</span></button>
            <button onClick={logout} className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-rose transition-colors rounded-lg hover:bg-white/[0.03]"><Icon name="logout" className="w-3.5 h-3.5" /><span className="hidden sm:block">Sair</span></button>
          </div>
        </header>

        {navOpen && (
          <div className="lg:hidden border-b border-white/[0.06] bg-admin-side/90 backdrop-blur-xl px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {sections.map((g) => (
              <div key={g.group}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-admin-muted/40 mb-2">{g.group}</p>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map((item) => (
                    <button key={item.key} onClick={() => clickItem(item)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors ${isItemActive(item) ? 'bg-white/[0.08] text-admin-champ' : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.03]'}`}>
                      <Icon name={item.icon || 'spark'} className="w-4 h-4 shrink-0" />{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <main className={`flex-1 ${FULLSCREEN.includes(active) ? '' : 'p-6 lg:p-10 max-w-6xl w-full'}`}>{needsOnboarding ? <Onboarding onDone={loadVerticals} /> : content}</main>
      </div>

      <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`glass rounded-xl px-5 py-3 text-[13px] flex items-center gap-3 pointer-events-auto shadow-xl ${t.type === 'error' ? 'text-admin-rose' : t.type === 'success' ? 'text-admin-champ' : 'text-admin-text'}`}>
            <Icon name={t.type === 'error' ? 'x' : 'check'} className="w-4 h-4 shrink-0" />{t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
