// commerceTypes.js — tipos de item de PRIMEIRA CLASSE do Seravie Commerce Hub.
// O catálogo vende qualquer coisa do ecossistema: produto físico, serviço,
// experiência, reserva, assinatura, kit, digital, gift card, curso, evento,
// orçamento. Cada tipo define seus campos específicos e visual.

export const ITEM_TYPES = [
  { key: 'product', label: 'Produto', icon: 'box', accent: 'champ', hint: 'Produto físico com estoque' },
  { key: 'service', label: 'Serviço', icon: 'spark', accent: 'sage', hint: 'Consultoria, atendimento, projeto' },
  { key: 'experience', label: 'Experiência', icon: 'star', accent: 'gold', hint: 'Passeio, workshop, degustação' },
  { key: 'booking', label: 'Reserva', icon: 'calendar', accent: 'copper', hint: 'Hospedagem, mesa, sala' },
  { key: 'subscription', label: 'Assinatura', icon: 'refresh', accent: 'champ', hint: 'Clube recorrente' },
  { key: 'kit', label: 'Kit / Combo', icon: 'gift', accent: 'gold', hint: 'Cesta, presente, linha sazonal' },
  { key: 'digital', label: 'Digital', icon: 'download', accent: 'sage', hint: 'E-book, curso, download, licença' },
  { key: 'giftcard', label: 'Gift Card', icon: 'tag', accent: 'copper', hint: 'Vale-presente' },
  { key: 'course', label: 'Curso', icon: 'book', accent: 'champ', hint: 'Aulas, turmas' },
  { key: 'event', label: 'Evento', icon: 'calendar', accent: 'rose', hint: 'Ingressos com data' },
  { key: 'quote', label: 'Orçamento', icon: 'pen', accent: 'muted', hint: 'B2B / sob medida' },
]
export const typeMeta = (k) => ITEM_TYPES.find((t) => t.key === k) || ITEM_TYPES[0]

// Workflow de publicação (Digital Assets / Workflow do produto).
export const WORKFLOW = [
  { key: 'draft', label: 'Rascunho', tone: 'text-admin-muted/60', chip: 'bg-white/[0.06] text-admin-muted' },
  { key: 'review', label: 'Revisão', tone: 'text-admin-gold', chip: 'bg-admin-gold/15 text-admin-gold' },
  { key: 'published', label: 'Publicado', tone: 'text-admin-sage', chip: 'bg-admin-sage/15 text-admin-sage' },
  { key: 'archived', label: 'Arquivado', tone: 'text-admin-muted/40', chip: 'bg-white/[0.04] text-admin-muted/50' },
]
export const workflowMeta = (k) => WORKFLOW.find((w) => w.key === k) || WORKFLOW[0]

// Quais campos extras cada tipo mostra no editor (além dos comuns).
export function fieldsForType(type) {
  const common = ['price', 'cost', 'category', 'collection', 'brand']
  const map = {
    product: [...common, 'sku', 'stock'],
    service: [...common, 'duration'],
    experience: [...common, 'start_at', 'capacity', 'duration', 'location'],
    booking: [...common, 'start_at', 'end_at', 'capacity', 'location'],
    subscription: [...common, 'recurrence'],
    kit: [...common, 'kit_items', 'stock'],
    digital: [...common, 'digital_url'],
    giftcard: ['price', 'category'],
    course: [...common, 'start_at', 'capacity', 'duration'],
    event: [...common, 'start_at', 'end_at', 'capacity', 'location'],
    quote: ['category', 'brand'],
  }
  return map[type] || common
}

export const RECURRENCE = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
]

// Marketplaces / canais de venda do Commerce (conexão real via credenciais+webhook).
export const MARKETPLACES = [
  { key: 'mercadolivre', label: 'Mercado Livre', color: '#FFE600', fields: ['client_id', 'client_secret', 'seller_id'] },
  { key: 'amazon', label: 'Amazon', color: '#FF9900', fields: ['seller_id', 'access_key', 'secret_key', 'marketplace_id'] },
  { key: 'shopee', label: 'Shopee', color: '#EE4D2D', fields: ['partner_id', 'shop_id', 'api_key'] },
  { key: 'magalu', label: 'Magalu', color: '#0086FF', fields: ['api_key', 'seller_id'] },
  { key: 'americanas', label: 'Americanas', color: '#E60014', fields: ['api_key', 'seller_id'] },
  { key: 'tiktokshop', label: 'TikTok Shop', color: '#000000', fields: ['app_key', 'app_secret', 'shop_id'] },
  { key: 'instagram_shop', label: 'Instagram Shopping', color: '#E1306C', fields: ['catalog_id', 'access_token'] },
  { key: 'facebook_shop', label: 'Facebook Shop', color: '#1877F2', fields: ['catalog_id', 'access_token'] },
  { key: 'google_shopping', label: 'Google Shopping', color: '#4285F4', fields: ['merchant_id', 'access_token'] },
  { key: 'nuvemshop', label: 'Nuvemshop', color: '#2A47F5', fields: ['store_id', 'access_token'] },
  { key: 'shopify', label: 'Shopify', color: '#95BF47', fields: ['shop_domain', 'access_token'] },
  { key: 'woocommerce', label: 'WooCommerce', color: '#96588A', fields: ['site_url', 'consumer_key', 'consumer_secret'] },
]
export const FIELD_LABELS = {
  client_id: 'Client ID', client_secret: 'Client Secret', seller_id: 'Seller ID', access_key: 'Access Key',
  secret_key: 'Secret Key', marketplace_id: 'Marketplace ID', partner_id: 'Partner ID', shop_id: 'Shop ID',
  api_key: 'API Key', app_key: 'App Key', app_secret: 'App Secret', catalog_id: 'Catalog ID',
  access_token: 'Access Token', merchant_id: 'Merchant ID', store_id: 'Store ID', shop_domain: 'Shop Domain',
  site_url: 'URL do site', consumer_key: 'Consumer Key', consumer_secret: 'Consumer Secret',
}

export const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
