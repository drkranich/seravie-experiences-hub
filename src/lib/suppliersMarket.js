// suppliersMarket — vocabulário e helpers do marketplace Seravie Suppliers.

export const SUPPLIER_CATEGORIES = {
  arquitetura: 'Arquitetura', mobiliario: 'Mobiliário', marcenaria: 'Marcenaria',
  iluminacao: 'Iluminação', paisagismo: 'Paisagismo', embalagens: 'Embalagens',
  grafica: 'Gráfica', comunicacao_visual: 'Comunicação Visual', uniformes: 'Uniformes',
  aromatizacao: 'Fragrâncias & Aromas', tecnologia: 'Tecnologia', sinalizacao: 'Sinalização',
  louças: 'Louças & Utensílios', decoracao: 'Decoração', logistica: 'Logística',
  ceramica: 'Cerâmica', costura: 'Têxtil & Costura', velas: 'Velas',
  cafe: 'Cafés Especiais', vinho: 'Vinícola', chocolate: 'Chocolateria',
  rural: 'Produtor Rural', automacao: 'Automação', brindes: 'Brindes',
}

// ícone (do set do design system) por categoria — para os chips visuais
export const CATEGORY_ICON = {
  arquitetura: 'layout', mobiliario: 'grid', marcenaria: 'box', iluminacao: 'spark',
  paisagismo: 'leaf', embalagens: 'gift', grafica: 'image', comunicacao_visual: 'palette',
  uniformes: 'user', aromatizacao: 'sparkles', tecnologia: 'bolt', sinalizacao: 'map',
  louças: 'cup', decoracao: 'star', logistica: 'truck', ceramica: 'cup', costura: 'layers',
  velas: 'flame', cafe: 'cup', vinho: 'wine', chocolate: 'heart', rural: 'leaf',
  automacao: 'bolt', brindes: 'gift',
}

// selos de homologação (níveis)
// style = chip normal (fundo claro do sistema) | text = cor de texto legível sobre fundo escuro
// dot = cor do ponto indicador do nível (usado no selo sobre imagem)
export const VERIF_LEVELS = {
  bronze: { label: 'Bronze', style: 'bg-[#7c5a3a]/25 text-[#c79a6a]', text: 'text-[#d8b48a]', dot: 'bg-[#c79a6a]', ring: 'ring-[#c79a6a]/30', rank: 1 },
  prata: { label: 'Prata', style: 'bg-white/10 text-white/80', text: 'text-white/90', dot: 'bg-white/70', ring: 'ring-white/25', rank: 2 },
  ouro: { label: 'Ouro', style: 'bg-admin-gold/20 text-admin-gold', text: 'text-admin-gold', dot: 'bg-admin-gold', ring: 'ring-admin-gold/40', rank: 3 },
  platinum: { label: 'Platinum', style: 'bg-admin-champ/20 text-admin-champ', text: 'text-admin-champ', dot: 'bg-admin-champ', ring: 'ring-admin-champ/45', rank: 4 },
  signature: { label: 'Signature', style: 'bg-admin-sage/20 text-admin-sage', text: 'text-admin-sage', dot: 'bg-admin-sage', ring: 'ring-admin-sage/45', rank: 5 },
}

export const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export const SORTS = [
  { value: 'featured', label: 'Em destaque' },
  { value: 'rating', label: 'Mais bem avaliados' },
  { value: 'recent', label: 'Novidades' },
  { value: 'name', label: 'Nome (A–Z)' },
]

// moodboards-tema sugeridos (curadoria inicial; conectam fornecedores reais)
export const MOODBOARD_THEMES = [
  { theme: 'cafeterias', title: 'Cafeterias', palette: ['#3c2a1e', '#c79a6a', '#efe7d8'] },
  { theme: 'hoteis', title: 'Hotéis Boutique', palette: ['#1f3a3a', '#c9a86a', '#f2ede3'] },
  { theme: 'floriculturas', title: 'Floriculturas', palette: ['#2e4b3c', '#e7b6c2', '#f4efe6'] },
  { theme: 'chocolaterias', title: 'Chocolaterias', palette: ['#3a241a', '#a0522d', '#e9d9c3'] },
  { theme: 'vinicolas', title: 'Vinícolas', palette: ['#3a1622', '#7b2d3a', '#e6d2cf'] },
  { theme: 'boutiques', title: 'Boutiques', palette: ['#2a2a2a', '#c9a86a', '#f0ece4'] },
  { theme: 'natal', title: 'Natal', palette: ['#2a3a2a', '#b5423a', '#e8d9b8'] },
  { theme: 'casamentos', title: 'Casamentos', palette: ['#3a3340', '#c9a8b8', '#f4eef2'] },
]

export const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ordena fornecedores conforme o critério escolhido
export function sortSuppliers(list, sort) {
  const arr = [...list]
  if (sort === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'recent') arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  else if (sort === 'name') arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  else arr.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (VERIF_LEVELS[b.verification_level]?.rank || 0) - (VERIF_LEVELS[a.verification_level]?.rank || 0) || (b.rating || 0) - (a.rating || 0))
  return arr
}

// filtra por texto/categoria/uf/nível
export function filterSuppliers(list, { q = '', cat = '', uf = '', level = '' } = {}) {
  const nq = String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return list.filter((s) => {
    if (cat && s.category !== cat) return false
    if (level && s.verification_level !== level) return false
    if (uf) {
      const states = Array.isArray(s.states) ? s.states : []
      if (s.state !== uf && !states.includes(uf)) return false
    }
    if (nq) {
      const hay = [s.name, s.description, s.city, SUPPLIER_CATEGORIES[s.category], ...(Array.isArray(s.specialties) ? s.specialties : [])]
        .join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (!hay.includes(nq)) return false
    }
    return true
  })
}
