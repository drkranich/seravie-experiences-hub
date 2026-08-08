// Seravie Marketing Hub — Automation Studio: modelo de dados das Jornadas.
// Uma jornada é um grafo de nós (steps). Cada nó tem: id, type, x, y, config e
// conexões (next para fluxo linear; yes/no para condições).
import { MARKETING_EVENTS } from './marketingEvents'

// ---- Tipos de nó ----
export const NODE_TYPES = {
  trigger: { label: 'Gatilho', icon: 'flame', color: 'champ', desc: 'Evento do ecossistema que inicia a jornada.' },
  wait: { label: 'Esperar', icon: 'clock', color: 'gold', desc: 'Aguardar um tempo antes do próximo passo.' },
  message: { label: 'Enviar mensagem', icon: 'mail', color: 'sage', desc: 'E-mail, WhatsApp ou SMS ao contato.' },
  condition: { label: 'Condição', icon: 'search', color: 'copper', desc: 'Ramifica o fluxo (sim / não).' },
  reward: { label: 'Recompensa', icon: 'gift', color: 'rose', desc: 'Dar cupom ou creditar pontos.' },
}
export const NODE_TYPE_LIST = Object.entries(NODE_TYPES).map(([type, v]) => ({ type, ...v }))

// Nós que o usuário pode adicionar pela paleta (o gatilho é único e já existe).
export const ADDABLE_NODES = NODE_TYPE_LIST.filter((n) => n.type !== 'trigger')

// ---- Opções de configuração ----
export const CHANNELS = [
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
]
export const WAIT_UNITS = [
  { value: 'hours', label: 'horas' },
  { value: 'days', label: 'dias' },
]
// Condições disponíveis (comportamento do contato).
export const CONDITION_FIELDS = [
  { value: 'opened_email', label: 'Abriu o e-mail anterior' },
  { value: 'clicked', label: 'Clicou no link' },
  { value: 'purchased', label: 'Comprou desde o início da jornada' },
  { value: 'has_coupon', label: 'Recebeu um cupom' },
  { value: 'ltv_gt', label: 'LTV maior que…' },
]
export const REWARD_TYPES = [
  { value: 'coupon', label: 'Dar cupom' },
  { value: 'points', label: 'Creditar pontos' },
]

// Eventos que podem ser gatilho (todos do catálogo do motor de eventos).
export const TRIGGER_OPTIONS = MARKETING_EVENTS.map((e) => ({ value: e.type, label: e.label }))

// ---- Config padrão por tipo de nó ----
export function defaultConfig(type) {
  switch (type) {
    case 'trigger': return { event: 'sale_completed' }
    case 'wait': return { amount: 3, unit: 'days' }
    case 'message': return { channel: 'email', subject: '', message: 'Olá {nome}, ...' }
    case 'condition': return { field: 'opened_email', value: '' }
    case 'reward': return { reward: 'coupon', couponId: '', points: 100 }
    default: return {}
  }
}

// ---- Fábrica de nó ----
let _fallbackSeq = 0
export function makeNode(type, x, y, idSeed) {
  // id determinístico (não usa Math.random — combina seed do chamador)
  const id = `n_${type}_${idSeed != null ? idSeed : _fallbackSeq++}`
  return { id, type, x, y, config: defaultConfig(type), next: null, yes: null, no: null }
}

// ---- Templates de jornada prontos ----
// Coordenadas em grade; o canvas centraliza/scrolla conforme necessário.
export const JOURNEY_TEMPLATES = [
  {
    key: 'welcome', name: 'Boas-vindas', trigger: 'first_purchase',
    desc: 'Recebe o novo cliente, espera e oferece um cupom.',
    build: () => {
      const t = { id: 'n_trigger_0', type: 'trigger', x: 60, y: 200, config: { event: 'first_purchase' }, next: 'n_message_1' }
      const m1 = { id: 'n_message_1', type: 'message', x: 320, y: 200, config: { channel: 'whatsapp', subject: '', message: 'Bem-vindo(a), {nome}! Que bom ter você com a gente.' }, next: 'n_wait_2' }
      const w = { id: 'n_wait_2', type: 'wait', x: 580, y: 200, config: { amount: 2, unit: 'days' }, next: 'n_reward_3' }
      const r = { id: 'n_reward_3', type: 'reward', x: 820, y: 200, config: { reward: 'coupon', couponId: '', points: 100 }, next: null }
      return [t, m1, w, r]
    },
  },
  {
    key: 'winback', name: 'Reativação (winback)', trigger: 'winback_due',
    desc: 'Cliente inativo: manda mensagem e, se não comprar, oferece desconto.',
    build: () => {
      const t = { id: 'n_trigger_0', type: 'trigger', x: 60, y: 200, config: { event: 'winback_due' }, next: 'n_message_1' }
      const m1 = { id: 'n_message_1', type: 'message', x: 320, y: 200, config: { channel: 'email', subject: 'Sentimos sua falta', message: 'Oi {nome}, faz um tempo! Volte para nos visitar.' }, next: 'n_wait_2' }
      const w = { id: 'n_wait_2', type: 'wait', x: 580, y: 200, config: { amount: 5, unit: 'days' }, next: 'n_condition_3' }
      const c = { id: 'n_condition_3', type: 'condition', x: 820, y: 200, config: { field: 'purchased', value: '' }, yes: null, no: 'n_reward_4' }
      const r = { id: 'n_reward_4', type: 'reward', x: 1080, y: 320, config: { reward: 'coupon', couponId: '', points: 0 }, next: null }
      return [t, m1, w, c, r]
    },
  },
  {
    key: 'post_sale', name: 'Pós-venda', trigger: 'sale_completed',
    desc: 'Após a compra, agradece e pede avaliação.',
    build: () => {
      const t = { id: 'n_trigger_0', type: 'trigger', x: 60, y: 200, config: { event: 'sale_completed' }, next: 'n_wait_1' }
      const w = { id: 'n_wait_1', type: 'wait', x: 320, y: 200, config: { amount: 3, unit: 'days' }, next: 'n_message_2' }
      const m = { id: 'n_message_2', type: 'message', x: 580, y: 200, config: { channel: 'whatsapp', subject: '', message: '{nome}, como foi sua experiência? Conta pra gente!' }, next: null }
      return [t, w, m]
    },
  },
  {
    key: 'birthday', name: 'Aniversário', trigger: 'birthday_near',
    desc: 'Perto do aniversário, envia felicitação com cupom.',
    build: () => {
      const t = { id: 'n_trigger_0', type: 'trigger', x: 60, y: 200, config: { event: 'birthday_near' }, next: 'n_message_1' }
      const m = { id: 'n_message_1', type: 'message', x: 320, y: 200, config: { channel: 'email', subject: 'Feliz aniversário! 🎉', message: 'Parabéns, {nome}! Um presente especial para você.' }, next: 'n_reward_2' }
      const r = { id: 'n_reward_2', type: 'reward', x: 580, y: 200, config: { reward: 'coupon', couponId: '', points: 0 }, next: null }
      return [t, m, r]
    },
  },
  {
    key: 'blank', name: 'Em branco', trigger: 'sale_completed',
    desc: 'Comece do zero apenas com o gatilho.',
    build: () => [{ id: 'n_trigger_0', type: 'trigger', x: 60, y: 200, config: { event: 'sale_completed' }, next: null }],
  },
]

// ---- Helpers de grafo ----
export const nodeById = (nodes, id) => nodes.find((n) => n.id === id)

// Portas de saída de um nó (para desenhar conexões). Condição tem yes/no.
export function outPorts(node) {
  if (node.type === 'condition') return [{ key: 'yes', label: 'Sim', target: node.yes }, { key: 'no', label: 'Não', target: node.no }]
  return [{ key: 'next', label: '', target: node.next }]
}

// Valida o grafo: gatilho existe, sem portas soltas críticas. Retorna array de avisos.
export function validateJourney(nodes) {
  const warns = []
  const triggers = nodes.filter((n) => n.type === 'trigger')
  if (triggers.length === 0) warns.push('A jornada precisa de um gatilho.')
  if (triggers.length > 1) warns.push('Só pode haver um gatilho.')
  nodes.forEach((n) => {
    if (n.type === 'message' && !n.config?.message?.trim()) warns.push(`Mensagem vazia em um nó de envio.`)
    if (n.type === 'condition' && !n.yes && !n.no) warns.push('Uma condição não leva a lugar nenhum.')
  })
  return warns
}

// Resumo curto do nó (para o card no canvas).
export function nodeSummary(node, ctx = {}) {
  const c = node.config || {}
  switch (node.type) {
    case 'trigger': return TRIGGER_OPTIONS.find((o) => o.value === c.event)?.label || 'Evento'
    case 'wait': return `${c.amount || 0} ${WAIT_UNITS.find((u) => u.value === c.unit)?.label || c.unit || ''}`
    case 'message': return `${CHANNELS.find((ch) => ch.value === c.channel)?.label || c.channel}${c.subject ? ' · ' + c.subject : ''}`
    case 'condition': return CONDITION_FIELDS.find((f) => f.value === c.field)?.label || 'Condição'
    case 'reward': return c.reward === 'points' ? `${c.points || 0} pontos` : (ctx.couponCode ? `Cupom ${ctx.couponCode}` : 'Cupom')
    default: return ''
  }
}
