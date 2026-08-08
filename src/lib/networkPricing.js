// networkPricing — cálculo do preço de uma rede com N unidades.
//
// Modelo: base (plano Enterprise) já inclui a 1ª unidade + o painel consolidado.
// Cada unidade adicional entra numa escada decrescente (plan_addons, kind='unit'):
//   2ª à 5ª   -> R$199   |   6ª à 15ª -> R$149   |   16ª+ -> R$99
//
// A escada é DATA-DRIVEN: passe as faixas vindas de plan_addons; se não vier nada,
// usamos o default abaixo (mesmos números da migração).

export const DEFAULT_UNIT_TIERS = [
  { tier_from: 2, tier_to: 5, price_monthly: 199, price_yearly: 1990 },
  { tier_from: 6, tier_to: 15, price_monthly: 149, price_yearly: 1490 },
  { tier_from: 16, tier_to: null, price_monthly: 99, price_yearly: 990 },
]

export const ENTERPRISE_BASE = { monthly: 699, yearly: 6990 }

// Preço de UMA unidade de índice `i` (1 = primeira, já inclusa na base).
export function unitPriceAt(i, tiers = DEFAULT_UNIT_TIERS, cycle = 'monthly') {
  if (i <= 1) return 0 // 1ª unidade inclusa na base
  const key = cycle === 'yearly' ? 'price_yearly' : 'price_monthly'
  const t = tiers.find((x) => i >= x.tier_from && (x.tier_to == null || i <= x.tier_to))
  return t ? Number(t[key]) || 0 : 0
}

// Total mensal/anual da rede para `units` unidades.
export function networkPrice(units, { tiers = DEFAULT_UNIT_TIERS, base = ENTERPRISE_BASE, cycle = 'monthly' } = {}) {
  const n = Math.max(1, Number(units) || 1)
  const baseVal = cycle === 'yearly' ? base.yearly : base.monthly
  let addons = 0
  const breakdown = []
  for (let i = 2; i <= n; i++) {
    const p = unitPriceAt(i, tiers, cycle)
    addons += p
    breakdown.push({ unit: i, price: p })
  }
  const total = baseVal + addons
  const perUnit = total / n
  return { units: n, base: baseVal, addons, total, perUnit, breakdown, cycle }
}

// Agrupa o breakdown por faixa (para exibição amigável: "4× R$199 = R$796").
export function summarizeTiers(units, tiers = DEFAULT_UNIT_TIERS, cycle = 'monthly') {
  const n = Math.max(1, Number(units) || 1)
  const key = cycle === 'yearly' ? 'price_yearly' : 'price_monthly'
  const rows = []
  for (const t of tiers) {
    const from = Math.max(t.tier_from, 2)
    const to = t.tier_to == null ? n : Math.min(t.tier_to, n)
    const qty = Math.max(0, to - from + 1)
    if (qty > 0 && from <= n) rows.push({ label: t.name || `${t.tier_from}ª+`, qty, price: Number(t[key]) || 0, subtotal: qty * (Number(t[key]) || 0) })
  }
  return rows
}

export const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
