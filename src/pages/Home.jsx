import { useEffect } from 'react'
import { useSpecialties } from '../hooks/useSpecialties'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSectionsMap } from '../hooks/useSectionsMap'
import { useCollection } from '../hooks/useCollection'
import { useSettings } from '../hooks/useSettings'
import { ExperienceForm } from '../components/ExperienceForm'
import { NewsletterForm } from '../components/NewsletterForm'
import { useI18n } from '../i18n/LanguageContext'
import { useHashRoute } from '../hooks/useHashRoute'
import { LegalPage } from '../components/LegalPage'
import { ProjectPage } from '../components/ProjectPage'

/* ----------------------------------------------------------------------------
   Atmospheric gradient backdrops (no photos yet — cinematic amber-lit interiors
   evoked purely with layered gradients, grain and vignette).
---------------------------------------------------------------------------- */
const heroBg = {
  backgroundImage:
    'radial-gradient(80% 70% at 72% 18%, rgba(214,196,154,0.28), rgba(182,155,93,0.10) 38%, transparent 62%),' +
    'radial-gradient(60% 80% at 18% 85%, rgba(62,70,52,0.55), transparent 60%),' +
    'linear-gradient(150deg, #1a211b 0%, #11130f 45%, #0b0a08 100%)',
}
const specialtiesBg = {
  backgroundImage:
    'radial-gradient(120% 140% at 50% -20%, rgba(62,70,52,0.5), transparent 55%),' +
    'linear-gradient(180deg, #0e110d 0%, #0b0a08 100%)',
}
const aboutImgBg = {
  backgroundImage:
    'radial-gradient(70% 60% at 60% 30%, rgba(214,196,154,0.45), transparent 60%),' +
    'radial-gradient(80% 90% at 30% 80%, rgba(62,70,52,0.7), transparent 65%),' +
    'linear-gradient(160deg, #2a2c20 0%, #14160f 100%)',
}
const portfolioBg = {
  backgroundImage:
    'radial-gradient(90% 70% at 80% 10%, rgba(182,155,93,0.16), transparent 55%),' +
    'linear-gradient(180deg, #0b0a08 0%, #100f0b 50%, #0b0a08 100%)',
}
const processBg = {
  backgroundImage:
    'radial-gradient(100% 120% at 50% 0%, rgba(62,70,52,0.55), transparent 60%),' +
    'linear-gradient(180deg, #1a211b 0%, #0e100c 50%, #20251a 100%)',
}
const manifestoBg = {
  backgroundImage:
    'radial-gradient(70% 80% at 25% 70%, rgba(182,155,93,0.18), transparent 60%),' +
    'linear-gradient(160deg, #14160f 0%, #0b0a08 100%)',
}
const formBg = {
  backgroundImage:
    'radial-gradient(90% 90% at 80% 30%, rgba(214,196,154,0.16), transparent 60%),' +
    'linear-gradient(180deg, #10130d 0%, #0b0a08 100%)',
}
const tilePalette = [
  'linear-gradient(160deg, rgba(182,155,93,0.30), rgba(20,22,15,0.95)), linear-gradient(#1a211b,#0b0a08)',
  'linear-gradient(160deg, rgba(62,70,52,0.55), rgba(11,10,8,0.95)), linear-gradient(#14160f,#0b0a08)',
  'linear-gradient(160deg, rgba(214,196,154,0.22), rgba(20,22,15,0.95)), linear-gradient(#20251a,#0b0a08)',
  'linear-gradient(160deg, rgba(182,155,93,0.20), rgba(11,10,8,0.95)), linear-gradient(#1a211b,#0b0a08)',
]

/* ---------------------------------------------------------------- line icons */
function Icon({ name, className = 'w-6 h-6' }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const shapes = {
    spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
    palette: (
      <>
        <path d="M12 4a8 8 0 100 16c1.5 0 2-1 2-2 0-1.5 1-2 2-2h1a3 3 0 003-3 8 8 0 00-10-9z" />
        <circle cx="8.5" cy="11" r="0.6" />
        <circle cx="12" cy="8.5" r="0.6" />
        <circle cx="15.5" cy="11" r="0.6" />
      </>
    ),
    tag: (
      <>
        <path d="M4 4h7l9 9-7 7-9-9z" />
        <circle cx="8" cy="8" r="0.8" />
      </>
    ),
    book: <path d="M5 5a2 2 0 012-2h11v16H7a2 2 0 00-2 2zM18 3v16" />,
    leaf: <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19c4-4 7-6 10-7" />,
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </>
    ),
    cup: (
      <>
        <path d="M5 8h11v4a5 5 0 01-5 5H10a5 5 0 01-5-5z" />
        <path d="M16 9h2a2 2 0 010 4h-2M5 21h11" />
      </>
    ),
    building: (
      <>
        <path d="M5 21V6l7-3 7 3v15" />
        <path d="M9 21v-4h6v4M9 9h0M12 9h0M15 9h0M9 13h0M12 13h0M15 13h0" />
      </>
    ),
    wine: <path d="M8 3h8l-1 6a3 3 0 01-6 0zM12 12v6M9 21h6" />,
    heart: <path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5C19 15.5 12 20 12 20z" />,
    home: <path d="M4 11l8-7 8 7M6 10v10h12V10" />,
    map: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />,
    user: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20a7 7 0 0114 0" />
      </>
    ),
    chart: <path d="M4 20V4M4 20h16M8 17v-5M12 17V8M16 17v-8" />,
    gift: (
      <>
        <path d="M4 11h16v9H4zM4 7h16v4H4zM12 7v13" />
        <path d="M12 7s-1-4-3.5-4S6 6 12 7zM12 7s1-4 3.5-4S18 6 12 7z" />
      </>
    ),
    shield: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />,
    pen: <path d="M4 20l3-1 11-11-2-2L5 17zM14 6l2 2" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    check: <path d="M5 12l4 4 10-11" />,
    arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowD: <path d="M12 5v14M6 13l6 6 6-6" />,
    instagram: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.4" />
        <circle cx="17" cy="7" r="0.6" />
      </>
    ),
    pinterest: <path d="M9 21c-1-3 1-7 1-7s-.5-1-.5-2.4C9.5 9 11 8 12.2 8c1.6 0 2.6 1.2 2.6 3 0 2.1-1.2 4-2.7 4-.8 0-1.4-.7-1.2-1.5M12 3a9 9 0 100 18" />,
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...p}>
      {shapes[name] || shapes.spark}
    </svg>
  )
}

/* Organic wave divider between sections (fill = colour of section below) */
function Wave({ fill, flip = false, className = '' }) {
  return (
    <svg
      viewBox="0 0 1440 130"
      preserveAspectRatio="none"
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: 'clamp(48px, 8vw, 120px)',
        transform: flip ? 'scaleX(-1)' : 'none',
      }}
    >
      <path
        fill={fill}
        d="M0,52 C220,118 430,8 720,40 C1010,72 1230,128 1440,58 L1440,131 L0,131 Z"
      />
    </svg>
  )
}

function Particles({ count = 16 }) {
  const dots = Array.from({ length: count }, (_, i) => {
    const left = (i * 61) % 100
    const size = 1 + ((i * 7) % 3)
    const dur = 14 + ((i * 5) % 12)
    const delay = (i * 3) % 14
    const bottom = (i * 13) % 40
    return (
      <span
        key={i}
        className="absolute rounded-full"
        style={{
          left: left + '%',
          bottom: bottom + '%',
          width: size,
          height: size,
          background: 'rgba(214,196,154,0.8)',
          boxShadow: '0 0 8px rgba(182,155,93,0.7)',
          animation: `floatUp ${dur}s linear ${delay}s infinite`,
        }}
      />
    )
  })
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{dots}</div>
}

/* small reusable button */
function Btn({ children, variant = 'primary', href = '#', onClick }) {
  const base =
    'inline-flex items-center gap-3 px-8 py-4 text-[11px] tracking-widerx uppercase transition-all duration-500'
  const styles =
    variant === 'primary'
      ? 'bg-gold text-ink hover:bg-champagne'
      : 'border border-gold/60 text-champagne hover:border-gold hover:bg-gold/10'
  return (
    <a href={href} onClick={onClick} className={`${base} ${styles}`}>
      {children}
      <Icon name="arrowR" className="w-4 h-4" />
    </a>
  )
}

const SPECIALTY_BAR = [
  { icon: 'building', label: 'Retail Design' },
  { icon: 'home', label: 'Hospitality Design' },
  { icon: 'tag', label: 'Visual Merchandising' },
  { icon: 'book', label: 'Storytelling Espacial' },
  { icon: 'leaf', label: 'Curadoria de Materiais' },
  { icon: 'user', label: 'Experiência do Cliente' },
]

const DELIVERABLES_FALLBACK = [
  { icon: 'spark', title: 'Projeto Conceitual', description: 'Conceitos autorais que traduzem a essência do seu negócio.' },
  { icon: 'palette', title: 'Design de Interiores Comercial', description: 'Ambientes funcionais, bonitos e alinhados à sua estratégia.' },
  { icon: 'tag', title: 'Visual Merchandising', description: 'Experiências que aumentam vendas e conectam produtos às pessoas.' },
  { icon: 'book', title: 'Storytelling do Espaço', description: 'Narrativas visuais que dão alma, identidade e propósito ao lugar.' },
  { icon: 'leaf', title: 'Curadoria de Materiais', description: 'Seleção precisa de materiais, texturas e acabamentos.' },
  { icon: 'map', title: 'Ambientação Turística', description: 'Transformamos espaços em destinos turísticos memoráveis.' },
  { icon: 'compass', title: 'Jornada do Cliente', description: 'Mapeamento e design de experiências do início ao fim.' },
  { icon: 'heart', title: 'Posicionamento de Marca', description: 'Seu posicionamento traduzido em cada detalhe do espaço.' },
]

const PROCESS = [
  { n: '01', icon: 'search', title: 'Diagnóstico', description: 'Entendemos seu negócio, público e objetivos.' },
  { n: '02', icon: 'spark', title: 'Conceito', description: 'Criamos um conceito autoral alinhado à sua marca.' },
  { n: '03', icon: 'book', title: 'Storytelling', description: 'Construímos a narrativa visual que dará alma ao espaço.' },
  { n: '04', icon: 'pen', title: 'Projeto', description: 'Desenvolvemos o projeto com cada detalhe planejado.' },
  { n: '05', icon: 'leaf', title: 'Curadoria', description: 'Selecionamos materiais, fornecedores e acabamentos.' },
  { n: '06', icon: 'check', title: 'Implementação', description: 'Acompanhamos cada etapa até a entrega da experiência.' },
]

const SEGMENTS = [
  { icon: 'building', label: 'Cidades Históricas' },
  { icon: 'map', label: 'Destinos Turísticos' },
  { icon: 'cup', label: 'Empórios Gourmet' },
  { icon: 'book', label: 'Cafeterias & Bistrôs' },
  { icon: 'home', label: 'Pousadas & Hotéis' },
  { icon: 'wine', label: 'Vinícolas' },
  { icon: 'leaf', label: 'Fazendas Históricas' },
  { icon: 'heart', label: 'Marcas Artesanais' },
]

const PORTFOLIO_FALLBACK = [
  { id: 'f1', title: 'Empórios Gourmet', category: 'Retail' },
  { id: 'f2', title: 'Cafeterias Artesanais', category: 'Hospitality' },
  { id: 'f3', title: 'Pousadas & Hotéis Boutique', category: 'Hospitality' },
  { id: 'f4', title: 'Lojas Turísticas', category: 'Retail' },
]

const NAV = [
  { key: 'nav.home', label: 'Home', href: '#topo' },
  { key: 'nav.about', label: 'Sobre', href: '#sobre' },
  { key: 'nav.services', label: 'Serviços', href: '#servicos' },
  { key: 'nav.portfolio', label: 'Portfólio', href: '#portfolio' },
  { key: 'nav.process', label: 'Processo', href: '#processo' },
  { key: 'nav.audience', label: 'Para quem', href: '#para-quem' },
  { key: 'nav.journal', label: 'Jornal', href: '#jornal' },
  { key: 'nav.contact', label: 'Contato', href: '#contato' },
]

export function Home({ onAdmin }) {
  const { specialties } = useSpecialties()
  const { portfolio } = usePortfolio()
  const sections = useSectionsMap()
  const sx = (k) => sections[k] || {}
  const hero = { content: sx('hero') }
  const route = useHashRoute()
  const isHome = route === 'home'
  const isPage = route.startsWith('pagina/')
  const isProject = route.startsWith('projeto/')
  const vis = (list) => (isHome || list.includes(route) ? undefined : 'none')
  const legalSlugs = {
    'Política de Privacidade': 'politica-de-privacidade',
    'Termos de Uso': 'termos-de-uso',
    Cookies: 'cookies',
  }
  const { items: processDb } = useCollection('process_steps')
  const { items: segmentsDb } = useCollection('segments')
  const { settings } = useSettings()
  const { items: testimonials } = useCollection('testimonials')
  const { items: faqs } = useCollection('faqs')
  const { items: team } = useCollection('team_members')
  const { items: posts } = useCollection('posts', 'created_at')
  const { items: menuItems } = useCollection('menu_items')
  const { locale, setLocale } = useI18n()

  const headerMenu = menuItems.filter((m) => m.location === 'header')
  const footerMenu = menuItems.filter((m) => m.location === 'footer')
  const navItems =
    headerMenu.length > 0
      ? headerMenu.map((m) => ({ label: m.label, href: m.url }))
      : NAV.map((n) => ({ label: n.label, href: n.href }))

  const heroBgUrl = hero?.content?.background_url
  const brand = settings?.brand || {}
  const social = settings?.social || {}
  const footerLinks =
    settings?.footer_links && settings.footer_links.length
      ? settings.footer_links
      : ['Política de Privacidade', 'Termos de Uso', 'Cookies', 'Mapa do Site']

  useEffect(() => {
    const seo = settings?.seo || {}
    if (seo.title) document.title = seo.title
    if (seo.description) {
      let m = document.querySelector('meta[name="description"]')
      if (!m) {
        m = document.createElement('meta')
        m.setAttribute('name', 'description')
        document.head.appendChild(m)
      }
      m.setAttribute('content', seo.description)
    }
  }, [settings])

  const process =
    processDb && processDb.length > 0
      ? processDb.map((p) => ({ n: p.step_number, icon: p.icon, title: p.title, description: p.description }))
      : PROCESS

  const segments =
    segmentsDb && segmentsDb.length > 0
      ? segmentsDb.map((s) => ({ icon: s.icon, label: s.title }))
      : SEGMENTS

  const deliverables =
    specialties && specialties.length > 0
      ? specialties.map((s, i) => ({
          icon: s.icon_name || DELIVERABLES_FALLBACK[i % DELIVERABLES_FALLBACK.length].icon,
          title: s.title,
          description: s.description,
        }))
      : DELIVERABLES_FALLBACK

  const projects =
    portfolio && portfolio.length > 0
      ? route === 'portfolio'
        ? portfolio
        : portfolio.slice(0, 4)
      : PORTFOLIO_FALLBACK

  return (
    <div id="topo" className="bg-ink text-ivory" style={{ paddingTop: isHome || isPage || isProject ? 0 : '5.5rem' }}>
      {/* ============================== NAV ============================== */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
          <a href="#topo" className="leading-none" data-no-translate>
            <div className="font-serif text-2xl text-ivory tracking-wide">Seravie</div>
            <div className="text-[9px] tracking-widestx text-gold/80 mt-0.5">EXPERIENCES</div>
          </a>
          <nav className="hidden lg:flex items-center gap-8 text-[11px] tracking-widerx uppercase text-ivory/75">
            {navItems.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-gold transition-colors duration-300">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-[11px] tracking-widerx" data-no-translate>
            {['pt', 'en', 'es'].map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`px-2 py-1 rounded-sm uppercase transition-colors ${
                  locale === l ? 'bg-gold/90 text-ink' : 'text-ivory/50 hover:text-gold'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      {isPage && <LegalPage slug={route.slice(7)} />}
      {isProject && <ProjectPage id={route.slice(8)} />}

      {/* ============================== HERO ============================== */}
      <section
        className="relative min-h-screen flex items-center grain vignette overflow-hidden"
        style={{ ...heroBg, display: isHome ? undefined : 'none' }}
      >
        {heroBgUrl && (
          <div className="absolute inset-0">
            <img src={heroBgUrl} alt="" className="w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(150deg, rgba(26,33,27,0.82), rgba(11,10,8,0.9))' }}
            />
          </div>
        )}
        <Particles count={18} />
        {/* vertical words */}
        <div className="hidden md:flex flex-col items-end gap-2 absolute right-8 top-1/2 -translate-y-1/2 text-[10px] tracking-widestx text-gold/70">
          <span>SPACES</span>
          <span>STORIES</span>
          <span>DESTINATIONS</span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 w-full">
          <div className="max-w-2xl">
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-ivory text-shadow-soft">
              {hero?.content?.title ? (
                hero.content.title
              ) : (
                <>
                  Transformamos espaços em{' '}
                  <span className="italic text-champagne">destinos memoráveis.</span>
                </>
              )}
            </h1>
            <p className="mt-8 text-ivory/75 text-lg leading-relaxed max-w-md font-light">
              {hero?.content?.subtitle ||
                'Design de experiências que despertam emoções, fortalecem marcas e permanecem na memória.'}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Btn variant="secondary" href="#processo">
                Conhecer nosso processo
              </Btn>
              <Btn variant="primary" href="#contato">
                Solicitar avaliação
              </Btn>
            </div>
          </div>
        </div>

        <a
          href="#sobre"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-11 h-11 rounded-full border border-gold/50 flex items-center justify-center text-gold animate-bob"
        >
          <Icon name="arrowD" className="w-4 h-4" />
        </a>
      </section>

      {/* ===================== SPECIALTIES BAR ===================== */}
      <section style={{ ...specialtiesBg, display: vis(['servicos']) }} className="relative">
        <Wave fill="#0e110d" className="-mt-px" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-16 -mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {SPECIALTY_BAR.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col items-center text-center gap-3 py-8 px-4 ${
                  i !== 0 ? 'lg:border-l border-gold/15' : ''
                }`}
              >
                <span className="text-gold">
                  <Icon name={s.icon} className="w-7 h-7" />
                </span>
                <span className="text-[10px] tracking-widerx uppercase text-ivory/65 leading-relaxed">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== SOBRE ============================== */}
      <section id="sobre" className="relative bg-ivory text-ink grain" style={{ display: vis(['sobre', 'servicos']) }}>
        <Wave fill="#f4f0e6" className="-mt-px" />
        {/* botanical accents */}
        <Icon name="leaf" className="hidden md:block w-40 h-40 text-olive/10 absolute left-0 top-24 -rotate-12" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-20 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-6">
              {sx('about').eyebrow || 'Sobre nós'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight text-ink">
              {sx('about').title || 'Especialistas em criar experiências que conectam lugares, marcas e pessoas.'}
            </h2>
            <p className="mt-7 text-ink/65 leading-relaxed max-w-md">
              {sx('about').text ||
                'Unimos design, estratégia e sensibilidade para transformar espaços comuns em destinos que encantam, acolhem e geram valor para o seu negócio.'}
            </p>
            <a
              href="#contato"
              className="mt-8 inline-flex items-center gap-3 text-[11px] tracking-widerx uppercase text-ink hover:text-gold transition-colors"
            >
              {sx('about').cta_text || 'Conhecer nossa história'}
              <Icon name="arrowR" className="w-4 h-4" />
            </a>
          </div>
          <div className="relative">
            <div className="organic-mask aspect-[4/5] w-full max-w-md mx-auto grain" style={aboutImgBg}>
              {(sx('about').image_url || sx('about').background_url) && (
                <img
                  src={sx('about').image_url || sx('about').background_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <Icon name="leaf" className="w-24 h-24 text-olive/20 absolute -right-2 -bottom-4 rotate-12" />
          </div>
        </div>

        {/* ===================== ENTREGÁVEIS ===================== */}
        <div id="servicos" className="max-w-7xl mx-auto px-6 lg:px-10 pb-24 text-center">
          <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
            {sx('services').eyebrow || 'O que entregamos'}
          </p>
          <h2 className="font-serif text-4xl lg:text-5xl text-ink mb-16">
            {sx('services').title || 'Cada projeto, uma experiência completa.'}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-14 text-left">
            {deliverables.map((d, i) => (
              <div key={i} className="flex flex-col items-start">
                <span className="w-14 h-14 rounded-full border border-gold/40 flex items-center justify-center text-gold mb-5">
                  <Icon name={d.icon} className="w-6 h-6" />
                </span>
                <h3 className="font-serif text-2xl text-ink mb-2 leading-snug">{d.title}</h3>
                <p className="text-ink/55 text-sm leading-relaxed">{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== PORTFÓLIO ============================== */}
      <section id="portfolio" className="relative grain vignette" style={{ ...portfolioBg, display: vis(['portfolio']) }}>
        {sx('portfolio').background_url && (
          <div className="absolute inset-0">
            <img src={sx('portfolio').background_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-ink/75" />
          </div>
        )}
        <Wave fill="#0b0a08" className="-mt-px" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
                {sx('portfolio').eyebrow || 'Experiências que criamos'}
              </p>
              <h2 className="font-serif text-4xl lg:text-5xl leading-tight text-ivory">
                {sx('portfolio').title || 'Projetos que inspiram. Experiências que ficam.'}
              </h2>
            </div>
            <a
              href="#contato"
              className="inline-flex items-center gap-3 text-[11px] tracking-widerx uppercase text-champagne hover:text-gold transition-colors"
            >
              {sx('portfolio').cta_text || 'Ver todos os projetos'}
              <Icon name="arrowR" className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {projects.map((item, i) => (
              <a
                key={item.id || i}
                href={item.id && String(item.id).includes('-') ? `#/projeto/${item.id}` : '#'}
                className="group relative organic-pill aspect-[3/4] grain overflow-hidden block"
                style={{ background: tilePalette[i % tilePalette.length] }}
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  {item.category && (
                    <p className="text-[10px] tracking-widerx uppercase text-gold/90 mb-1">{item.category}</p>
                  )}
                  <h3 className="font-serif text-2xl text-ivory leading-tight">{item.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== PROCESSO ============================== */}
      <section id="processo" className="relative grain" style={{ ...processBg, display: vis(['processo']) }}>
        {sx('process').background_url && (
          <div className="absolute inset-0">
            <img src={sx('process').background_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-ink/75" />
          </div>
        )}
        <Wave fill="#1a211b" className="-mt-px" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
          <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
            {sx('process').eyebrow || 'Nosso processo'}
          </p>
          <h2 className="font-serif text-4xl lg:text-5xl text-ivory mb-20">
            {sx('process').title || 'Do diagnóstico à experiência final.'}
          </h2>
          <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-12">
            <div className="hidden lg:block absolute top-7 left-[8%] right-[8%] h-px bg-gold/25" />
            {process.map((step) => (
              <div key={step.n} className="relative flex flex-col items-center px-3">
                <span className="w-14 h-14 rounded-full bg-ink/60 border border-gold/40 flex items-center justify-center text-gold backdrop-blur-sm">
                  <Icon name={step.icon} className="w-6 h-6" />
                </span>
                <div className="font-serif text-2xl text-champagne mt-5">{step.n}</div>
                <h3 className="text-sm tracking-widerx uppercase text-ivory mt-1 mb-2">{step.title}</h3>
                <p className="text-ivory/50 text-xs leading-relaxed max-w-[10rem]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== PARA QUEM ============================== */}
      <section id="para-quem" className="relative bg-ink grain" style={{ ...manifestoBg, display: vis(['para-quem']) }}>
        <Wave fill="#14160f" className="-mt-px" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24 text-center">
          <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
            {sx('audience').eyebrow || 'Para quem criamos'}
          </p>
          <h2 className="font-serif text-4xl lg:text-5xl text-ivory mb-16">
            {sx('audience').title || 'Marcas e destinos que querem ser lembrados.'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-y-10">
            {segments.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-3 px-2">
                <span className="text-gold">
                  <Icon name={s.icon} className="w-8 h-8" />
                </span>
                <span className="text-[10px] tracking-widerx uppercase text-ivory/60 leading-relaxed">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* manifesto */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl lg:text-5xl leading-tight text-ivory">
              {sx('manifesto').line1 || 'Alguns lugares recebem visitantes.'}
              <br />
              {sx('manifesto').line2 || 'Outros permanecem na memória.'}
              <br />
              <span className="text-gold italic">{sx('manifesto').line3 || 'Nós projetamos a diferença.'}</span>
            </h2>
            <div className="mt-10">
              <Btn variant="secondary" href="#contato">
                {sx('manifesto').cta_text || 'Conheça nossa história'}
              </Btn>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== DEPOIMENTOS ============================== */}
      {testimonials.length > 0 && (
        <section className="relative grain" style={{ ...portfolioBg, display: vis([]) }}>
          <Wave fill="#0b0a08" className="-mt-px" />
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-5 text-center">
              {sx('testimonials').eyebrow || 'Depoimentos'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl text-ivory mb-16 text-center">
              {sx('testimonials').title || 'Histórias que ficaram na memória.'}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.id} className="border border-gold/15 rounded-2xl p-8 bg-ink/30">
                  <p className="font-serif italic text-xl text-ivory/85 leading-relaxed mb-6">“{t.quote}”</p>
                  <div className="flex items-center gap-4">
                    {t.avatar_url && (
                      <img src={t.avatar_url} alt={t.author_name} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <div className="text-ivory text-sm">{t.author_name}</div>
                      {t.author_role && <div className="text-gold/70 text-xs">{t.author_role}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================== JORNAL ============================== */}
      {posts.length > 0 && (
        <section id="jornal" className="relative grain" style={{ ...manifestoBg, display: vis(['jornal']) }}>
          <Wave fill="#14160f" className="-mt-px" />
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
              {sx('journal').eyebrow || 'Jornal'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl text-ivory mb-14">
              {sx('journal').title || 'Histórias e inspirações.'}
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {posts.slice(0, 3).map((p) => (
                <article key={p.id} className="group">
                  <div
                    className="organic-pill aspect-[4/3] overflow-hidden mb-5"
                    style={{ background: tilePalette[0] }}
                  >
                    {p.cover_image && (
                      <img
                        src={p.cover_image}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                  </div>
                  {p.category && <p className="text-[10px] tracking-widerx uppercase text-gold/90 mb-2">{p.category}</p>}
                  <h3 className="font-serif text-2xl text-ivory mb-2 leading-tight">{p.title}</h3>
                  <p className="text-ivory/55 text-sm leading-relaxed">{p.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================== FAQ ============================== */}
      {faqs.length > 0 && (
        <section className="relative grain" style={{ ...formBg, display: vis(['contato']) }}>
          <Wave fill="#10130d" className="-mt-px" />
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-5 text-center">
              {sx('faq').eyebrow || 'Perguntas frequentes'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl text-ivory mb-12 text-center">
              {sx('faq').title || 'Tudo que você precisa saber.'}
            </h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.id} className="border border-gold/15 rounded-xl px-6 py-4">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-ivory font-serif text-xl">
                    {f.question}
                    <span className="faq-icon text-gold shrink-0">
                      <Icon name="plus" className="w-5 h-5" />
                    </span>
                  </summary>
                  <p className="text-ivory/60 text-sm leading-relaxed mt-4">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================== EQUIPE ============================== */}
      {team.length > 0 && (
        <section className="relative bg-ivory text-ink grain" style={{ display: vis(['sobre']) }}>
          <Wave fill="#f4f0e6" className="-mt-px" />
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-5 text-center">
              {sx('team').eyebrow || 'Equipe'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl text-ink mb-14 text-center">
              {sx('team').title || 'Quem cria as experiências.'}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {team.map((m) => (
                <div key={m.id} className="text-center">
                  <div className="organic-mask-soft aspect-square w-40 mx-auto mb-5 bg-sand overflow-hidden">
                    {m.photo_url && <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />}
                  </div>
                  <h3 className="font-serif text-2xl text-ink">{m.name}</h3>
                  {m.role && <p className="text-gold text-[11px] tracking-widerx uppercase mt-1">{m.role}</p>}
                  {m.bio && <p className="text-ink/55 text-sm mt-3 leading-relaxed">{m.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================== CONTATO / FORM ============================== */}
      <section id="contato" className="relative grain vignette" style={{ ...formBg, display: vis(['contato']) }}>
        {sx('contact').background_url && (
          <div className="absolute inset-0">
            <img src={sx('contact').background_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-ink/80" />
          </div>
        )}
        <Wave fill="#10130d" className="-mt-px" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-[11px] tracking-widestx uppercase text-gold mb-5">
              {sx('contact').eyebrow || 'Fale com um especialista'}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight text-ivory mb-6">
              {sx('contact').title || 'Vamos conversar sobre o seu destino.'}
            </h2>
            <p className="text-ivory/65 leading-relaxed max-w-md mb-10">
              {sx('contact').text ||
                'Conte-nos sobre seu projeto. Responda algumas perguntas rápidas e nossa equipe entrará em contato com você.'}
            </p>
            <ul className="space-y-4">
              {[
                { icon: 'user', label: 'Atendimento personalizado' },
                { icon: 'chart', label: 'Análise estratégica do seu projeto' },
                { icon: 'gift', label: 'Soluções sob medida' },
                { icon: 'shield', label: 'Total confidencialidade' },
              ].map((b) => (
                <li key={b.label} className="flex items-center gap-4 text-ivory/75">
                  <span className="w-10 h-10 rounded-full border border-gold/30 flex items-center justify-center text-gold shrink-0">
                    <Icon name={b.icon} className="w-5 h-5" />
                  </span>
                  <span className="text-sm tracking-wide">{b.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-10 font-serif italic text-gold/80 text-xl">
              {sx('contact').closing || 'Sua história merece o cenário perfeito.'}
            </p>
          </div>

          <ExperienceForm />
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="bg-ink border-t border-gold/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="flex flex-col lg:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <div className="font-serif text-2xl text-ivory tracking-wide">{brand.name || 'Seravie'}</div>
              <div className="text-[9px] tracking-widestx text-gold/80 mt-0.5 mb-4">{brand.suffix || 'EXPERIENCES'}</div>
              <p className="text-ivory/45 text-sm leading-relaxed mb-6">
                {brand.tagline || 'Transformamos espaços em destinos memoráveis.'}
              </p>
              <p className="text-[10px] tracking-widerx uppercase text-gold/70 mb-3">Receba nossas experiências</p>
              <NewsletterForm />
            </div>
            <div className="flex flex-col sm:flex-row gap-8 lg:gap-14 text-[11px] tracking-widerx uppercase text-ivory/50">
              {(footerMenu.length > 0
                ? footerMenu.map((m) => ({ label: m.label, href: m.url }))
                : footerLinks.map((l) => ({ label: l, href: legalSlugs[l] ? '#/pagina/' + legalSlugs[l] : '#' }))
              ).map((l, i) => (
                <a key={i} href={l.href} className="hover:text-gold transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex items-start gap-4 text-gold">
              <a
                href={social.instagram || '#'}
                target={social.instagram ? '_blank' : undefined}
                rel="noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-gold/30 flex items-center justify-center hover:bg-gold/10 transition-colors"
              >
                <Icon name="instagram" className="w-5 h-5" />
              </a>
              <a
                href={social.pinterest || '#'}
                target={social.pinterest ? '_blank' : undefined}
                rel="noreferrer"
                aria-label="Pinterest"
                className="w-10 h-10 rounded-full border border-gold/30 flex items-center justify-center hover:bg-gold/10 transition-colors"
              >
                <Icon name="pinterest" className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-gold/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-ivory/35 text-xs">
            <span>© 2026 Seravie Experiences. Todos os direitos reservados.</span>
            <button onClick={onAdmin} className="hover:text-gold transition-colors tracking-widerx uppercase text-[10px]">
              Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
