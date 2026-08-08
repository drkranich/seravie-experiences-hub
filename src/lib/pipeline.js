// Seravie CRM — configuração do Pipeline de vendas.
// Etapas padrão (usadas quando o tenant não personalizou) + helpers de forecast.

// Etapas padrão do funil. probability = % de fechamento usada no forecast ponderado.
export const DEFAULT_STAGES = [
  { key: 'new', label: 'Novo Lead', color: 'champ', probability: 10, is_won: false, is_lost: false },
  { key: 'qualified', label: 'Qualificado', color: 'gold', probability: 25, is_won: false, is_lost: false },
  { key: 'proposal', label: 'Proposta', color: 'sage', probability: 50, is_won: false, is_lost: false },
  { key: 'negotiation', label: 'Negociação', color: 'gold', probability: 70, is_won: false, is_lost: false },
  { key: 'won', label: 'Fechado (ganho)', color: 'sage', probability: 100, is_won: true, is_lost: false },
  { key: 'postsale', label: 'Pós-venda', color: 'champ', probability: 100, is_won: false, is_lost: false },
]

export const STAGE_COLORS = ['champ', 'gold', 'sage', 'copper', 'rose']
export const STAGE_STY = {
  champ: { border: 'border-admin-champ/40', text: 'text-admin-champ', dot: 'bg-admin-champ', bg: 'bg-admin-champ/10' },
  gold: { border: 'border-admin-gold/40', text: 'text-admin-gold', dot: 'bg-admin-gold', bg: 'bg-admin-gold/10' },
  sage: { border: 'border-admin-sage/50', text: 'text-admin-sage', dot: 'bg-admin-sage', bg: 'bg-admin-sage/10' },
  copper: { border: 'border-admin-copper/40', text: 'text-admin-copper', dot: 'bg-admin-copper', bg: 'bg-admin-copper/10' },
  rose: { border: 'border-admin-rose/40', text: 'text-admin-rose', dot: 'bg-admin-rose', bg: 'bg-admin-rose/10' },
}

// probabilidade de uma etapa (usa a custom se houver; senão a padrão; senão 20)
export function stageProbability(stageKey, stagesMap) {
  if (stagesMap && stagesMap[stageKey] != null) return stagesMap[stageKey]
  const def = DEFAULT_STAGES.find((s) => s.key === stageKey)
  return def ? def.probability : 20
}

// forecast ponderado: soma(valor × probabilidade) dos negócios em aberto
export function weightedForecast(deals, stagesMap) {
  return deals
    .filter((d) => d.status !== 'won' && d.status !== 'lost')
    .reduce((s, d) => {
      const p = d.probability != null ? d.probability : stageProbability(d.stage, stagesMap)
      return s + (Number(d.value || 0) * p / 100)
    }, 0)
}

export const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'text-admin-muted/60' },
  { value: 'medium', label: 'Média', color: 'text-admin-gold' },
  { value: 'high', label: 'Alta', color: 'text-admin-rose' },
]
export const TASK_KINDS = [
  { value: 'call', label: 'Ligação', icon: 'user' },
  { value: 'email', label: 'E-mail', icon: 'mail' },
  { value: 'meeting', label: 'Reunião', icon: 'calendar' },
  { value: 'proposal', label: 'Proposta', icon: 'tag' },
  { value: 'todo', label: 'Tarefa', icon: 'check' },
]
