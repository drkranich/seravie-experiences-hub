// flowEngine.js — Experience Flow Engine
// -----------------------------------------------------------------------------
// Motor de fluxo operacional CONFIGURÁVEL da Seravie. O KDS (cozinha) é apenas a
// primeira aplicação; o mesmo motor serve Chocolate Flow, Coffee Flow, Spa Flow,
// Events Flow etc. — muda só a configuração, não o código.
//
// Conceitos:
//  - stages: as colunas do quadro (Kanban), com ordem e status persistido.
//  - timerBands: faixas de tempo que colorem o cronômetro do cartão conforme o SLA.
//  - presets: um conjunto de stages + rótulos por vertical.
//
// Tudo em segundos internamente; a UI formata em mm:ss / min.

// Paleta do design system (mantém coerência com tailwind.config.js)
export const FLOW_COLORS = {
  champ: '#DCCBA7',   // champagne
  gold: '#B89C61',
  copper: '#C1835B',  // cobre
  sage: '#55634D',    // verde musgo
  rose: '#B7745E',    // vermelho suave
  orange: '#D08A3E',  // laranja (faixa intermediária do timer)
}

// Faixas do cronômetro (do documento): 0–5 champagne, 5–10 cobre, 10–15 laranja,
// acima do SLA vermelho. Expressas em segundos e resolvidas contra o SLA do ticket.
export const TIMER_BANDS = [
  { upToSec: 5 * 60, key: 'calm', color: FLOW_COLORS.champ, ring: 'ring-admin-champ/30', text: 'text-admin-champ' },
  { upToSec: 10 * 60, key: 'warm', color: FLOW_COLORS.copper, ring: 'ring-admin-copper/40', text: 'text-admin-copper' },
  { upToSec: 15 * 60, key: 'hot', color: FLOW_COLORS.orange, ring: 'ring-[#D08A3E]/50', text: 'text-[#D08A3E]' },
  { upToSec: Infinity, key: 'over', color: FLOW_COLORS.rose, ring: 'ring-admin-rose/60', text: 'text-admin-rose' },
]

// Resolve a faixa do cronômetro para um número de segundos decorridos.
// Se houver SLA definido e ele for estourado, força a faixa "over" (vermelho).
export function timerBand(elapsedSec, slaSec) {
  if (slaSec && elapsedSec >= slaSec) return TIMER_BANDS[TIMER_BANDS.length - 1]
  return TIMER_BANDS.find((b) => elapsedSec < b.upToSec) || TIMER_BANDS[TIMER_BANDS.length - 1]
}

export const fmtMMSS = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
export const fmtMin = (sec) => `${Math.max(0, Math.round(sec / 60))} min`

// Estágios do fluxo de COZINHA (KDS). `status` é o valor persistido em kds_tickets.
// active:true = estágio "de trabalho" (conta como em produção). terminal:true = saiu do fluxo.
const KITCHEN_STAGES = [
  { key: 'queued', status: 'queued', label: 'Novos', icon: 'bell', accent: 'champ' },
  { key: 'preparing', status: 'preparing', label: 'Em preparo', icon: 'flame', accent: 'copper', active: true },
  { key: 'waiting', status: 'waiting', label: 'Aguardando estação', icon: 'clock', accent: 'gold', active: true },
  { key: 'assembly', status: 'assembly', label: 'Montagem', icon: 'layers', accent: 'sage', active: true },
  { key: 'review', status: 'review', label: 'Conferência', icon: 'check', accent: 'gold', active: true },
  { key: 'ready', status: 'ready', label: 'Prontos', icon: 'sparkles', accent: 'sage' },
  { key: 'delivered', status: 'delivered', label: 'Entregues', icon: 'truck', accent: 'muted', terminal: true },
]

// Presets por vertical. Hoje só 'kitchen' está completo; os demais herdam a
// mesma engrenagem, mudando rótulos/ícones — provando a reutilização do motor.
export const FLOW_PRESETS = {
  kitchen: {
    key: 'kitchen',
    label: 'Kitchen Flow',
    unitSingular: 'pedido',
    unitPlural: 'pedidos',
    stages: KITCHEN_STAGES,
    defaultSlaSec: 15 * 60,
  },
  chocolate: { key: 'chocolate', label: 'Chocolate Flow', unitSingular: 'produção', unitPlural: 'produções', stages: KITCHEN_STAGES, defaultSlaSec: 30 * 60 },
  coffee: { key: 'coffee', label: 'Coffee Flow', unitSingular: 'pedido', unitPlural: 'pedidos', stages: KITCHEN_STAGES, defaultSlaSec: 8 * 60 },
  spa: { key: 'spa', label: 'Spa Flow', unitSingular: 'atendimento', unitPlural: 'atendimentos', stages: KITCHEN_STAGES, defaultSlaSec: 60 * 60 },
  events: { key: 'events', label: 'Events Flow', unitSingular: 'tarefa', unitPlural: 'tarefas', stages: KITCHEN_STAGES, defaultSlaSec: 45 * 60 },
}

export const getPreset = (kind = 'kitchen') => FLOW_PRESETS[kind] || FLOW_PRESETS.kitchen
export const stageByStatus = (preset, status) => preset.stages.find((s) => s.status === status) || preset.stages[0]

// Estilo (tag premium) para as marcações de cartão. Reconhece as principais e
// cai num estilo neutro elegante para tags livres.
export function tagStyle(tag) {
  const t = String(tag || '').toUpperCase()
  const map = {
    'VIP': 'bg-admin-champ/20 text-admin-champ',
    'URGENTE': 'bg-admin-rose/20 text-admin-rose',
    'ATRASADO': 'bg-admin-rose/20 text-admin-rose',
    'ALERGIA': 'bg-admin-rose/20 text-admin-rose',
    'SEM GLÚTEN': 'bg-[#D08A3E]/20 text-[#D08A3E]',
    'SEM GLUTEN': 'bg-[#D08A3E]/20 text-[#D08A3E]',
    'SEM CEBOLA': 'bg-[#D08A3E]/15 text-[#D08A3E]',
    'DELIVERY': 'bg-admin-sage/20 text-admin-sage',
    'RETIRADA': 'bg-admin-gold/15 text-admin-gold',
  }
  return map[t] || 'bg-white/[0.06] text-admin-muted'
}

// Ícone e rótulo por canal de origem (multi-canal: pdv, flow, delivery, manual).
export const CHANNEL_META = {
  pdv: { label: 'PDV', icon: 'cart' },
  flow: { label: 'Flow QR', icon: 'grid' },
  delivery: { label: 'Delivery', icon: 'truck' },
  manual: { label: 'Manual', icon: 'pen' },
}
export const channelMeta = (c) => CHANNEL_META[c] || CHANNEL_META.manual

// Segundos decorridos desde uma data ISO (base do cronômetro), com `now` injetável
// para permitir 1 tick/seg controlado pela tela sem recriar Date a cada cartão.
export const elapsedSeconds = (iso, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
