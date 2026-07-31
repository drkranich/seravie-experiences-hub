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
        { key: 'exec.dashboard', label: 'Dashboard Executivo', route: 'overview' },
        { key: 'exec.ai_feed', label: 'Feed Inteligente da IA' },
        { key: 'exec.indicators', label: 'Indicadores' },
        { key: 'exec.alerts', label: 'Alertas' },
        { key: 'exec.agenda', label: 'Agenda do Dia' },
        { key: 'exec.conversations', label: 'Últimas Conversas', route: 'conversations' },
        { key: 'exec.sales', label: 'Últimas Vendas' },
        { key: 'exec.pending', label: 'Pendências' },
        { key: 'exec.approvals', label: 'Aprovações' },
        { key: 'exec.activity', label: 'Atividades Recentes' },
      ]},
      { key: 'crm', label: 'Experience CRM', icon: 'user', route: 'crm', pages: [
        { key: 'crm.all', label: 'Todos os Clientes', route: 'crm' },
        { key: 'crm.leads', label: 'Leads' },
        { key: 'crm.companies', label: 'Empresas' },
        { key: 'crm.vip', label: 'VIP' },
        { key: 'crm.loyalty', label: 'Fidelidade' },
        { key: 'crm.history', label: 'Histórico' },
        { key: 'crm.preferences', label: 'Preferências' },
        { key: 'crm.dates', label: 'Datas Especiais' },
        { key: 'crm.family', label: 'Família' },
        { key: 'crm.journey', label: 'Jornada' },
        { key: 'crm.ltv', label: 'Lifetime Value' },
        { key: 'crm.segments', label: 'Segmentações' },
        { key: 'crm.tags', label: 'Etiquetas' },
        { key: 'crm.ai', label: 'IA do Cliente' },
      ]},
      { key: 'conversations', label: 'Central de Conversas', icon: 'mail', route: 'conversations', pages: [
        { key: 'conv.all', label: 'Caixa Geral', route: 'conversations' },
        { key: 'conv.whatsapp', label: 'WhatsApp' },
        { key: 'conv.instagram', label: 'Instagram' },
        { key: 'conv.messenger', label: 'Messenger' },
        { key: 'conv.telegram', label: 'Telegram' },
        { key: 'conv.email', label: 'Email' },
        { key: 'conv.site', label: 'Chat Site' },
        { key: 'conv.google', label: 'Google Business' },
        { key: 'conv.calls', label: 'Chamadas' },
        { key: 'conv.ai', label: 'IA Assistente' },
        { key: 'conv.templates', label: 'Templates' },
        { key: 'conv.signatures', label: 'Assinaturas' },
      ]},
      { key: 'helpdesk', label: 'Help Desk', icon: 'check', route: 'helpdesk', pages: [
        { key: 'hd.tickets', label: 'Chamados', route: 'helpdesk' },
        { key: 'hd.sla', label: 'SLA' },
        { key: 'hd.priorities', label: 'Prioridades' },
        { key: 'hd.categories', label: 'Categorias' },
        { key: 'hd.teams', label: 'Equipes' },
        { key: 'hd.escalations', label: 'Escalonamentos' },
        { key: 'hd.kb', label: 'Base de Conhecimento', route: 'knowledge' },
        { key: 'hd.ai', label: 'IA de Atendimento' },
        { key: 'hd.nps', label: 'Pesquisas NPS' },
        { key: 'hd.audit', label: 'Auditoria' },
      ]},
      { key: 'experiences', label: 'Experiências', icon: 'spark', pages: [
        { key: 'exp.catalog', label: 'Catálogo', route: 'catalog' },
        { key: 'exp.journeys', label: 'Jornadas' },
        { key: 'exp.packages', label: 'Pacotes' },
        { key: 'exp.events', label: 'Eventos' },
        { key: 'exp.dates', label: 'Datas Comemorativas' },
        { key: 'exp.subscriptions', label: 'Assinaturas' },
        { key: 'exp.gifts', label: 'Presentes' },
        { key: 'exp.corporate', label: 'Corporativo' },
        { key: 'exp.exclusive', label: 'Experiências Exclusivas' },
        { key: 'exp.calendar', label: 'Calendário' },
      ]},
      { key: 'pos', label: 'PDV', icon: 'tag', route: 'pos' },
      { key: 'marketing', label: 'Marketing', icon: 'star', route: 'marketing', pages: [
        { key: 'mkt.campaigns', label: 'Campanhas', route: 'marketing' },
        { key: 'mkt.landing', label: 'Landing Pages' },
        { key: 'mkt.forms', label: 'Formulários', route: 'messages' },
        { key: 'mkt.email', label: 'Email Marketing' },
        { key: 'mkt.whatsapp', label: 'WhatsApp Marketing' },
        { key: 'mkt.sms', label: 'SMS' },
        { key: 'mkt.social', label: 'Redes Sociais' },
        { key: 'mkt.automations', label: 'Automações' },
        { key: 'mkt.segments', label: 'Segmentações' },
        { key: 'mkt.coupons', label: 'Cupons' },
        { key: 'mkt.loyalty', label: 'Programa de Fidelidade' },
        { key: 'mkt.analytics', label: 'Analytics', route: 'analytics' },
      ]},
      { key: 'operations', label: 'Operações', icon: 'check', route: 'operations', pages: [
        { key: 'ops.checklists', label: 'Checklists', route: 'operations' },
        { key: 'ops.tasks', label: 'Tarefas' },
        { key: 'ops.approvals', label: 'Aprovações' },
        { key: 'ops.flows', label: 'Fluxos' },
        { key: 'ops.audits', label: 'Auditorias' },
        { key: 'ops.nonconformities', label: 'Não Conformidades' },
        { key: 'ops.action', label: 'Plano de Ação' },
        { key: 'ops.equipment', label: 'Equipamentos' },
        { key: 'ops.maintenance', label: 'Manutenção' },
        { key: 'ops.documents', label: 'Documentos' },
        { key: 'ops.ai', label: 'IA Operacional' },
      ]},
      { key: 'team', label: 'Equipe', icon: 'user', route: 'team', pages: [
        { key: 'team.employees', label: 'Funcionários', route: 'team' },
        { key: 'team.schedules', label: 'Escalas' },
        { key: 'team.goals', label: 'Metas' },
        { key: 'team.commissions', label: 'Comissões' },
        { key: 'team.training', label: 'Treinamentos' },
        { key: 'team.documents', label: 'Documentos' },
        { key: 'team.reviews', label: 'Avaliações' },
        { key: 'team.comm', label: 'Comunicação' },
        { key: 'team.recognition', label: 'Reconhecimentos' },
        { key: 'team.permissions', label: 'Permissões' },
      ]},
      { key: 'knowledge', label: 'Conhecimento', icon: 'book', route: 'knowledge', pages: [
        { key: 'kn.library', label: 'Biblioteca', route: 'knowledge' },
        { key: 'kn.pops', label: 'POPs' },
        { key: 'kn.procedures', label: 'Procedimentos' },
        { key: 'kn.videos', label: 'Vídeos' },
        { key: 'kn.courses', label: 'Cursos' },
        { key: 'kn.certificates', label: 'Certificados' },
        { key: 'kn.faq', label: 'FAQ', route: 'faqs' },
        { key: 'kn.ai', label: 'IA' },
        { key: 'kn.search', label: 'Pesquisa' },
        { key: 'kn.versioning', label: 'Versionamento' },
      ]},
      { key: 'media', label: 'Mídia', icon: 'image', route: 'media', pages: [
        { key: 'md.photos', label: 'Fotos', route: 'media' },
        { key: 'md.videos', label: 'Vídeos' },
        { key: 'md.logos', label: 'Logos' },
        { key: 'md.campaigns', label: 'Campanhas' },
        { key: 'md.arts', label: 'Artes' },
        { key: 'md.templates', label: 'Templates' },
        { key: 'md.documents', label: 'Documentos' },
        { key: 'md.ai', label: 'IA Imagens' },
        { key: 'md.smart', label: 'Organização Inteligente' },
      ]},
      { key: 'finance', label: 'Financeiro', icon: 'chart', pages: [
        { key: 'fin.revenue', label: 'Receitas' },
        { key: 'fin.expenses', label: 'Despesas' },
        { key: 'fin.indicators', label: 'Indicadores' },
        { key: 'fin.commissions', label: 'Comissões' },
        { key: 'fin.goals', label: 'Metas' },
        { key: 'fin.subscriptions', label: 'Assinaturas' },
        { key: 'fin.billing', label: 'Cobranças' },
        { key: 'fin.integrations', label: 'Integrações' },
        { key: 'fin.dashboard', label: 'Dashboard Financeiro' },
      ]},
      { key: 'analytics', label: 'Analytics', icon: 'star', route: 'analytics', pages: [
        { key: 'an.sales', label: 'Vendas' },
        { key: 'an.support', label: 'Atendimento' },
        { key: 'an.customers', label: 'Clientes' },
        { key: 'an.marketing', label: 'Marketing' },
        { key: 'an.operations', label: 'Operações' },
        { key: 'an.conversion', label: 'Conversão' },
        { key: 'an.heatmaps', label: 'Heatmaps' },
        { key: 'an.ai', label: 'IA Insights' },
        { key: 'an.exports', label: 'Exportações' },
      ]},
      { key: 'ai', label: 'Seravie AI', icon: 'spark', route: 'ai', pages: [
        { key: 'ai.chat', label: 'Chat', route: 'ai' },
        { key: 'ai.agents', label: 'Agentes' },
        { key: 'ai.knowledge', label: 'Conhecimento' },
        { key: 'ai.automations', label: 'Automações' },
        { key: 'ai.suggestions', label: 'Sugestões' },
        { key: 'ai.reports', label: 'Relatórios' },
        { key: 'ai.training', label: 'Treinamentos' },
        { key: 'ai.prompts', label: 'Prompt Center' },
        { key: 'ai.audit', label: 'Auditoria IA' },
        { key: 'ai.config', label: 'Configurações' },
      ]},
      { key: 'automations', label: 'Automações', icon: 'spark', pages: [
        { key: 'au.flows', label: 'Fluxos' },
        { key: 'au.triggers', label: 'Gatilhos' },
        { key: 'au.conditions', label: 'Condições' },
        { key: 'au.templates', label: 'Templates' },
        { key: 'au.approvals', label: 'Aprovações' },
        { key: 'au.webhooks', label: 'Webhooks' },
        { key: 'au.integrations', label: 'Integrações' },
        { key: 'au.history', label: 'Histórico' },
      ]},
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
      { key: 'superadmin', label: 'Super Admin', icon: 'gear', route: 'superadmin' },
      { key: 'settings', label: 'Configurações', icon: 'gear', route: 'settings', pages: [
        { key: 'set.companies', label: 'Empresas' },
        { key: 'set.users', label: 'Usuários', route: 'superadmin' },
        { key: 'set.roles', label: 'Perfis' },
        { key: 'set.permissions', label: 'Permissões' },
        { key: 'set.channels', label: 'Canais' },
        { key: 'set.apis', label: 'APIs' },
        { key: 'set.integrations', label: 'Integrações' },
        { key: 'set.webhooks', label: 'Webhooks' },
        { key: 'set.security', label: 'Segurança' },
        { key: 'set.audit', label: 'Auditoria' },
        { key: 'set.themes', label: 'Temas' },
        { key: 'set.languages', label: 'Idiomas' },
        { key: 'set.branding', label: 'Branding' },
        { key: 'set.backup', label: 'Backup' },
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
  events: { label: 'Eventos', icon: 'star', pages: [
    'Casamentos','Buffets','Cerimônias','Convidados','Cronograma','Fornecedores','Checklist','Financeiro','Decoração','Montagem','Desmontagem',
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
