// ============================================================
// Seravie Experience OS — Navegação orientada a configuração.
// Núcleo comum (para todos) + frentes especializadas por segmento.
// (Sem hotelaria/hospedagem.)
//
// Cada item: { key, label, icon, route?, pages?: [...] }
//  - route: chave de um painel real (ver COMPONENT map no AdminDashboard).
//           Sem route => abre a ScaffoldPage (estrutura on-brand).
//  - pages: subpáginas do módulo (mesmo formato).
// ============================================================

// ---------- NÚCLEO COMUM ----------
export const CORE_SECTIONS = [
  {
    group: 'Núcleo',
    items: [
      { key: 'overview', label: 'Painel Executivo', icon: 'grid', route: 'overview', pages: [
        { key: 'exec.sales', label: 'Últimas Vendas', route: 'salesview' },
        { key: 'exec.conversations', label: 'Últimas Conversas', route: 'conversations' },
      ]},
      { key: 'crm', label: 'Experience CRM', icon: 'user', route: 'crm', pages: [
        { key: 'crm.pipeline', label: 'Pipeline (Negócios)', route: 'pipeline' },
        { key: 'crm.all', label: 'Todos os Clientes', route: 'crm' },
        { key: 'crm.leads', label: 'Leads', route: 'crm_leads' },
        { key: 'crm.companies', label: 'Empresas', route: 'crm_companies' },
        { key: 'crm.vip', label: 'VIP', route: 'crm_vip' },
      ]},
      { key: 'helpdesk', label: 'Help Desk', icon: 'check', route: 'helpdesk', pages: [
        { key: 'hd.tickets', label: 'Chamados', route: 'helpdesk' },
        { key: 'hd.inbox', label: 'Central de Conversas', route: 'conversations' },
        { key: 'hd.channels', label: 'Canais de Atendimento', route: 'hd_channels' },
        { key: 'hd.sla', label: 'SLA', route: 'sla' },
        { key: 'hd.nps', label: 'Pesquisas NPS', route: 'nps' },
        { key: 'hd.kb', label: 'Base de Conhecimento', route: 'knowledge' },
        { key: 'hd.audit', label: 'Auditoria', route: 'audit' },
      ]},
      { key: 'pos', label: 'Seravie POS', icon: 'tag', route: 'pos' },
      { key: 'kds', label: 'Seravie Cuisine', icon: 'flame', route: 'kds' },
      { key: 'fiscal', label: 'Emissão Fiscal', icon: 'check', route: 'fiscal' },
      { key: 'loyalty', label: 'Fidelidade', icon: 'star', route: 'loyalty' },
      { key: 'client_exp', label: 'Experiências do Cliente', icon: 'spark', route: 'client_exp' },
      { key: 'receivables', label: 'Recebíveis', icon: 'chart', route: 'receivables' },
      { key: 'ecommerce', label: 'Seravie Commerce Hub', icon: 'cart', route: 'ecommerce', pages: [
        { key: 'ec.dashboard', label: 'Dashboard', route: 'ecommerce' },
        { key: 'ec.catalog', label: 'Catálogo (multi-tipo)', route: 'ecommerce' },
        { key: 'ec.marketplace', label: 'Marketplace', route: 'ecommerce' },
        { key: 'ec.store', label: 'Loja & Pedidos', route: 'ecommerce' },
        { key: 'ec.shipping', label: 'Frete · Melhor Envio', route: 'ecommerce' },
        { key: 'ec.coupons', label: 'Cupons', route: 'coupons' },
      ]},
      { key: 'agenda', label: 'Agenda', icon: 'calendar', route: 'agenda' },
      { key: 'marketing', label: 'Marketing', icon: 'star', route: 'marketing', pages: [
        { key: 'mkt.campaigns', label: 'Campanhas', route: 'marketing' },
        { key: 'mkt.coupons', label: 'Cupons', route: 'coupons' },
        { key: 'mkt.forms', label: 'Formulários', route: 'messages' },
        { key: 'mkt.automations', label: 'Automações', route: 'automations' },
        { key: 'mkt.analytics', label: 'Analytics', route: 'analytics' },
      ]},
      { key: 'operations', label: 'Operações', icon: 'check', route: 'operations', pages: [
        { key: 'ops.checklists', label: 'Checklists', route: 'operations' },
        { key: 'ops.stock', label: 'Estoque', route: 'stockview' },
        { key: 'ops.equipment', label: 'Equipamentos', route: 'equipment' },
      ]},
      { key: 'team', label: 'Equipe', icon: 'user', route: 'team', pages: [
        { key: 'team.employees', label: 'Funcionários', route: 'team' },
        { key: 'team.goals', label: 'Metas', route: 'goals' },
        { key: 'team.access', label: 'Usuários & Acessos', route: 'users' },
      ]},
      { key: 'knowledge', label: 'Conhecimento', icon: 'book', route: 'knowledge', pages: [
        { key: 'kn.library', label: 'Biblioteca', route: 'knowledge' },
        { key: 'kn.courses', label: 'Cursos', route: 'courses' },
        { key: 'kn.faq', label: 'FAQ', route: 'faqs' },
      ]},
      { key: 'media', label: 'Mídia', icon: 'image', route: 'media' },
      { key: 'finance', label: 'Financeiro', icon: 'chart', route: 'finance', pages: [
        { key: 'fin.main', label: 'Receitas & Despesas', route: 'finance' },
        { key: 'fin.accounts', label: 'Contas a Pagar/Receber', route: 'payables' },
        { key: 'fin.dre', label: 'DRE (Resultado)', route: 'dre' },
        { key: 'fin.goals', label: 'Metas', route: 'goals' },
        { key: 'fin.subscriptions', label: 'Assinatura', route: 'subscription' },
      ]},
      { key: 'analytics', label: 'Analytics', icon: 'star', route: 'analytics', pages: [
        { key: 'an.sales', label: 'Vendas', route: 'salesview' },
        { key: 'an.customers', label: 'Clientes', route: 'crm_customers' },
        { key: 'an.support', label: 'Atendimento (NPS)', route: 'nps' },
      ]},
      { key: 'ai', label: 'Seravie AI', icon: 'spark', route: 'ai' },
      { key: 'automations', label: 'Automações', icon: 'spark', route: 'automations' },
    ],
  },
  {
    group: 'Rede Seravie',
    items: [
      { key: 'expansao', label: 'Expansão', icon: 'map', route: 'expansao' },
      { key: 'franqueados', label: 'Franqueados', icon: 'building', route: 'franqueados' },
      { key: 'royalties', label: 'Royalties & Faturamento', icon: 'chart', route: 'royalties' },
      { key: 'implantacoes', label: 'Implantações', icon: 'layout', route: 'implantacoes' },
      { key: 'catalogo_oficial', label: 'Catálogo Oficial', icon: 'box', route: 'catalogo_oficial' },
      { key: 'standards', label: 'Experience Standards', icon: 'star', route: 'standards' },
      { key: 'certification', label: 'Certificação', icon: 'check', route: 'certification' },
      { key: 'network_types', label: 'Tipos de Profissional', icon: 'users', route: 'network_types' },
      { key: 'network_communities', label: 'Comunidades do Ecossistema', icon: 'grid', route: 'network_communities' },
    ],
  },
  {
    group: 'Seravie Hub',
    items: [
      { key: 'flow', label: 'Seravie Flow', icon: 'tag', route: 'flow' },
      { key: 'quotes', label: 'Seravie Quote Studio', icon: 'chart', route: 'quotes' },
      { key: 'documents', label: 'Seravie Document Studio', icon: 'book', route: 'documents' },
      { key: 'suppliers', label: 'Seravie Suppliers', icon: 'box', route: 'suppliers', pages: [
        { key: 'sup.dashboard', label: 'Painel do fornecedor', route: 'suppliers_dashboard' },
        { key: 'sup.discover', label: 'Descobrir', route: 'suppliers' },
        { key: 'sup.moodboards', label: 'Moodboards', route: 'suppliers' },
        { key: 'sup.profile', label: 'Meu perfil de fornecedor', route: 'suppliers_profile' },
      ]},
      { key: 'network_hub', label: 'Seravie Network', icon: 'user', route: 'network_hub' },
      { key: 'legal', label: 'Termos & Conformidade', icon: 'check', route: 'legal' },
    ],
  },
  {
    group: 'Site & Conteúdo',
    items: [
      { key: 'content', label: 'Seções', icon: 'layout', route: 'content' },
      { key: 'services', label: 'Serviços', icon: 'spark', route: 'services' },
      { key: 'portfolio', label: 'Portfólio', icon: 'image', route: 'portfolio' },
      { key: 'process', label: 'Processo', icon: 'check', route: 'process' },
      { key: 'segments', label: 'Segmentos', icon: 'leaf', route: 'segments' },
      { key: 'jornal', label: 'Jornal', icon: 'book', route: 'jornal' },
      { key: 'testimonials', label: 'Depoimentos', icon: 'star', route: 'testimonials' },
      { key: 'faqs', label: 'FAQ', icon: 'spark', route: 'faqs' },
      { key: 'pages', label: 'Páginas', icon: 'layout', route: 'pages' },
      { key: 'menus', label: 'Menus', icon: 'link', route: 'menus' },
      { key: 'newsletter', label: 'Newsletter', icon: 'gift', route: 'newsletter' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { key: 'verticals', label: 'Frentes / Núcleos', icon: 'leaf', route: 'verticals' },
      { key: 'users', label: 'Usuários & Acessos', icon: 'user', route: 'users' },
      { key: 'subscription', label: 'Minha Assinatura', icon: 'star', route: 'subscription' },
      { key: 'meu_espaco', label: 'Meu Espaço (Franquia)', icon: 'layout', route: 'meu_espaco' },
      { key: 'plans', label: 'Planos da Plataforma', icon: 'gear', route: 'plans' },
      { key: 'service_pricing', label: 'Franquias & Assessoria', icon: 'leaf', route: 'service_pricing' },
      { key: 'superadmin', label: 'Super Admin', icon: 'gear', route: 'superadmin' },
      { key: 'settings', label: 'Configurações', icon: 'gear', route: 'settings', pages: [
        { key: 'set.brand', label: 'Marca (logo/favicon)', route: 'settings' },
        { key: 'set.roles', label: 'Perfis & Permissões', route: 'roles' },
        { key: 'set.audit', label: 'Auditoria', route: 'audit' },
      ]},
    ],
  },
]

// ---------- FRENTES ESPECIALIZADAS (por segmento) ----------
// Ativadas conforme os núcleos do tenant (vertical_configs). Sem hotelaria.
export const VERTICAL_CORES = {
  franchise: { label: 'Franquias', icon: 'leaf', pages: [
    'Rede','Unidades','Supervisores','Comunicação','Campanhas','Auditorias','Visual Merchandising','Checklist de Loja','Compliance','Ranking','Metas','Benchmark','Biblioteca','Ocorrências','IA da Franquia',
  ]},
  chocolate: { label: 'Chocolateria', icon: 'gift', pages: [
    'Catálogo','Linhas de Produtos','Datas Sazonais','Páscoa','Natal','Dia das Mães','Dia dos Namorados','Kits','Embalagens','Presentes Corporativos','Vitrines','Visual Merchandising','Estoque','Degustações','Programas de Fidelidade','Campanhas','Treinamentos','Auditorias','IA Especialista',
  ]},
  gourmet: { label: 'Empório Gourmet', icon: 'cup', pages: [
    'Produtos','Cestas','Kits','Harmonizações','Degustações','Assinaturas','Fornecedores','Estoque Premium','Sazonalidade','Presentes','Curadoria','Receitas',
  ]},
  coffee: { label: 'Cafeteria', icon: 'cup', pages: [
    'Cardápio','Assinaturas','Workshops','Degustações','Cafés','Torrefação','Eventos','Clientes Frequentes','Programa Barista','Harmonizações',
  ]},
  wine: { label: 'Vinhos', icon: 'wine', pages: [
    'Rótulos','Safras','Produtores','Degustações','Eventos','Assinaturas','Clube','Harmonizações','Importações','Adega','Coleções',
  ]},
  brewery: { label: 'Cervejaria', icon: 'cup', pages: [
    'Rótulos','Tap Room','Eventos','Growlers','Clube','Degustações','Festival','Receitas','Ingredientes',
  ]},
  bakery: { label: 'Padaria', icon: 'cup', pages: [
    'Cardápio','Encomendas','Produção','Sazonalidade','Assinaturas','Fornecedores','Estoque','Receitas',
  ]},
  gift: { label: 'Presentes', icon: 'gift', pages: [
    'Catálogo','Embalagens','Kits','Cartões','Personalizações','Presentes Corporativos','Assinaturas','Coleções','Datas',
  ]},
  floriculture: { label: 'Floricultura', icon: 'leaf', pages: [
    'Flores','Arranjos','Buquês','Assinaturas','Eventos','Casamentos','Datas','Entrega','Fornecedores','Estoque',
  ]},
  tourism: { label: 'Turismo', icon: 'map', pages: [
    'Passeios','Guias','Transfers','Ingressos','Calendário','Experiências','Roteiros','Parceiros','Veículos','Motoristas',
  ]},
  beauty: { label: 'Beauty', icon: 'heart', pages: [
    'Produtos','Coleções','Rotinas','Skincare','Consultorias','Assinaturas','Amostras','Influenciadores','Consultores','Campanhas','Lançamentos','Estoque','Ingredientes',
  ]},
  spa: { label: 'Spa', icon: 'heart', pages: [
    'Protocolos','Massagens','Ambientes','Agenda','Terapeutas','Clientes','Prontuário','Pacotes','Gift Cards',
  ]},
  architecture: { label: 'Arquitetura', icon: 'layout', pages: [
    'Projetos','Briefings','Moodboards','Materiais','Curadoria','Orçamentos','Cronograma','Clientes','Portfólio','Renderizações','Visitas','Fornecedores',
  ]},
  artesanato: { label: 'Artesanato', icon: 'palette', pages: [
    'Peças','Encomendas','Coleções','Artesãos','Técnicas','Materiais','Estoque','Feiras & Eventos','Personalizações','Fornecedores','Precificação','Fotos',
  ]},
  events: { label: 'Eventos', icon: 'star', pages: [
    'Casamentos','Buffets','Cerimônias','Convidados','Cronograma','Fornecedores','Checklist','Financeiro','Decoração','Montagem','Desmontagem',
  ]},
  saboaria: { label: 'Saboaria', icon: 'leaf', pages: [
    'Sabonetes','Linhas & Coleções','Aromas & Essências','Produção & Cura','Insumos','Embalagens','Kits & Presentes','Estoque','Encomendas','Clube de Assinatura','Feiras & Eventos','Precificação','Fornecedores',
  ]},
  perfumaria: { label: 'Perfumaria', icon: 'heart', pages: [
    'Perfumes','Fragrâncias & Famílias Olfativas','Decants','Notas & Ingredientes','Frascos & Embalagens','Kits & Presentes','Estoque','Encomendas','Clube de Assinatura','Curadoria','Precificação','Fornecedores',
  ]},
}

const slug = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Converte um núcleo vertical em item de navegação (com subpáginas scaffold).
export function verticalToNav(key) {
  const v = VERTICAL_CORES[key]
  if (!v) return null
  return {
    key: `vertical.${key}`,
    label: v.label,
    icon: v.icon,
    vertical: key,
    pages: v.pages.map((p) => ({ key: `v.${key}.${slug(p)}`, label: p })),
  }
}
