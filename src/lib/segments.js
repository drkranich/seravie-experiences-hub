// Seravie Marketing Hub — Audience Studio: motor de segmentação.
// Regras compostas (match 'all' = E, 'any' = OU) sobre contatos ENRIQUECIDOS
// com dados de comportamento (compras, recência, gasto, pontos, fidelidade).

// ---- Operadores por tipo de campo ----
const OPS_TEXT = [
  { value: 'eq', label: 'é igual a' },
  { value: 'neq', label: 'é diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'set', label: 'está preenchido' },
  { value: 'unset', label: 'está vazio' },
]
const OPS_NUM = [
  { value: 'gt', label: 'maior que' },
  { value: 'gte', label: 'maior ou igual a' },
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor ou igual a' },
  { value: 'eq', label: 'igual a' },
]
const OPS_BOOL = [
  { value: 'true', label: 'sim' },
  { value: 'false', label: 'não' },
]
const OPS_SELECT = [
  { value: 'eq', label: 'é' },
  { value: 'neq', label: 'não é' },
]

// ---- Catálogo de campos disponíveis para segmentar ----
// group: agrupa no seletor. kind: text|number|bool|select. getter(ct) lê do contato enriquecido.
export const SEGMENT_FIELDS = [
  // Cadastro
  { key: 'segment', label: 'Segmento', group: 'Cadastro', kind: 'select', ops: OPS_SELECT, options: (ctx) => ctx.segments || [], get: (c) => c.segment || '' },
  { key: 'source', label: 'Origem', group: 'Cadastro', kind: 'select', ops: OPS_SELECT, options: (ctx) => ctx.sources || [], get: (c) => c.source || '' },
  { key: 'city', label: 'Cidade', group: 'Cadastro', kind: 'text', ops: OPS_TEXT, get: (c) => c.city || c.metadata?.city || '' },
  { key: 'email', label: 'E-mail', group: 'Cadastro', kind: 'text', ops: OPS_TEXT, get: (c) => c.email || '' },
  { key: 'phone', label: 'Telefone', group: 'Cadastro', kind: 'text', ops: OPS_TEXT, get: (c) => c.phone || '' },
  { key: 'tag', label: 'Tag', group: 'Cadastro', kind: 'text', ops: OPS_TEXT, get: (c) => (Array.isArray(c.tags) ? c.tags.join(',') : '') },
  { key: 'birthday_month', label: 'Mês de aniversário', group: 'Cadastro', kind: 'select', ops: OPS_SELECT, options: () => MONTH_OPTS, get: (c) => (c.birthdate ? String(c.birthdate).slice(5, 7) : '') },
  // Valor
  { key: 'ltv', label: 'LTV (valor total)', group: 'Valor', kind: 'number', ops: OPS_NUM, get: (c) => Number(c.ltv || 0) },
  { key: 'total_spent', label: 'Total gasto (pedidos)', group: 'Valor', kind: 'number', ops: OPS_NUM, get: (c) => Number(c._totalSpent || 0) },
  { key: 'avg_ticket', label: 'Ticket médio', group: 'Valor', kind: 'number', ops: OPS_NUM, get: (c) => Number(c._avgTicket || 0) },
  { key: 'score', label: 'Lead score', group: 'Valor', kind: 'number', ops: OPS_NUM, get: (c) => Number(c.score || 0) },
  // Comportamento
  { key: 'order_count', label: 'Nº de compras', group: 'Comportamento', kind: 'number', ops: OPS_NUM, get: (c) => Number(c._orderCount || 0) },
  { key: 'days_since_purchase', label: 'Dias desde a última compra', group: 'Comportamento', kind: 'number', ops: OPS_NUM, get: (c) => c._daysSincePurchase == null ? 999999 : c._daysSincePurchase },
  { key: 'has_purchased', label: 'Já comprou', group: 'Comportamento', kind: 'bool', ops: OPS_BOOL, get: (c) => Number(c._orderCount || 0) > 0 },
  { key: 'bought_product', label: 'Comprou o produto (nome contém)', group: 'Comportamento', kind: 'text', ops: OPS_TEXT, get: (c) => (c._productNames || []).join(' | ') },
  // Fidelidade
  { key: 'points', label: 'Pontos de fidelidade', group: 'Fidelidade', kind: 'number', ops: OPS_NUM, get: (c) => Number(c._points || 0) },
  { key: 'tier', label: 'Nível de fidelidade', group: 'Fidelidade', kind: 'text', ops: OPS_TEXT, get: (c) => c._tier || '' },
]
export const FIELD_MAP = Object.fromEntries(SEGMENT_FIELDS.map((f) => [f.key, f]))
export const MONTH_OPTS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' }, { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

// ---- Avaliação de uma condição sobre um contato enriquecido ----
export function evalCondition(cond, contact) {
  const f = FIELD_MAP[cond.field]
  if (!f) return false
  const v = f.get(contact)
  const target = cond.value
  switch (f.kind) {
    case 'number': {
      const a = Number(v), b = Number(target)
      switch (cond.op) {
        case 'gt': return a > b
        case 'gte': return a >= b
        case 'lt': return a < b
        case 'lte': return a <= b
        case 'eq': return a === b
        default: return false
      }
    }
    case 'bool': return (!!v) === (cond.op === 'true')
    case 'select':
      if (cond.op === 'neq') return String(v) !== String(target)
      return String(v) === String(target)
    case 'text':
    default: {
      const s = String(v || '').toLowerCase()
      const t = String(target || '').toLowerCase()
      switch (cond.op) {
        case 'eq': return s === t
        case 'neq': return s !== t
        case 'contains': return t !== '' && s.includes(t)
        case 'set': return s.trim() !== ''
        case 'unset': return s.trim() === ''
        default: return false
      }
    }
  }
}

// ---- Avalia o conjunto de regras (match all/any) ----
export function evalRules(rules, contact) {
  const conds = rules?.conditions || []
  if (conds.length === 0) return true // sem regras = todos
  const results = conds.map((c) => evalCondition(c, contact))
  return rules.match === 'any' ? results.some(Boolean) : results.every(Boolean)
}

// ---- Enriquece contatos com dados de pedidos e fidelidade ----
// orders: [{contact_id,total,created_at,items,status}] · loyalty: [{contact_id,points,tier}]
export function enrichContacts(contacts, orders = [], loyalty = []) {
  const byContact = {}
  orders.forEach((o) => {
    if (!o.contact_id) return
    const b = (byContact[o.contact_id] = byContact[o.contact_id] || { count: 0, total: 0, last: 0, products: new Set() })
    b.count += 1
    b.total += Number(o.total || 0)
    const t = new Date(o.created_at).getTime()
    if (t > b.last) b.last = t
    ;(Array.isArray(o.items) ? o.items : []).forEach((it) => { if (it?.name) b.products.add(String(it.name)) })
  })
  const loyaltyByContact = {}
  loyalty.forEach((l) => { if (l.contact_id) loyaltyByContact[l.contact_id] = l })
  const now = Date.now()
  return contacts.map((c) => {
    const b = byContact[c.id]
    const l = loyaltyByContact[c.id]
    return {
      ...c,
      _orderCount: b?.count || 0,
      _totalSpent: b?.total || 0,
      _avgTicket: b && b.count ? b.total / b.count : 0,
      _daysSincePurchase: b?.last ? Math.floor((now - b.last) / 86400000) : null,
      _productNames: b ? [...b.products] : [],
      _points: l?.points || 0,
      _tier: l?.tier || '',
    }
  })
}

// ---- Públicos inteligentes prontos (templates) ----
export const SMART_AUDIENCES = [
  { name: 'Clientes VIP', icon: 'star', color: 'gold', rules: { match: 'all', conditions: [{ field: 'ltv', op: 'gte', value: 1000 }] } },
  { name: 'Inativos (+60 dias)', icon: 'clock', color: 'rose', rules: { match: 'all', conditions: [{ field: 'has_purchased', op: 'true', value: '' }, { field: 'days_since_purchase', op: 'gt', value: 60 }] } },
  { name: 'Primeira compra', icon: 'spark', color: 'champ', rules: { match: 'all', conditions: [{ field: 'order_count', op: 'eq', value: 1 }] } },
  { name: 'Acima de R$ 500', icon: 'chart', color: 'sage', rules: { match: 'all', conditions: [{ field: 'total_spent', op: 'gte', value: 500 }] } },
  { name: 'Aniversariantes do mês', icon: 'gift', color: 'rose', rules: { match: 'all', conditions: [{ field: 'birthday_month', op: 'eq', value: currentMonth() }] } },
  { name: 'Nunca compraram (leads)', icon: 'user', color: 'copper', rules: { match: 'all', conditions: [{ field: 'has_purchased', op: 'false', value: '' }] } },
  { name: 'Recorrentes (3+ compras)', icon: 'heart', color: 'sage', rules: { match: 'all', conditions: [{ field: 'order_count', op: 'gte', value: 3 }] } },
  { name: 'Contatáveis por e-mail', icon: 'mail', color: 'champ', rules: { match: 'all', conditions: [{ field: 'email', op: 'set', value: '' }] } },
]
function currentMonth() {
  // sem Date.now proibido em workflows, mas aqui é app normal
  const m = new Date().getMonth() + 1
  return String(m).padStart(2, '0')
}
