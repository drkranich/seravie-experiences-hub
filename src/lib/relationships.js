// Seravie Relationship Studio — grafo de relacionamentos e IA copilot.
// Constrói o "Experience Graph" de uma entidade (nós + arestas) a partir dos
// dados 360° já carregados, e gera um resumo/copilot com próximos passos.

// Tipos de nó do grafo e seus estilos (cores do design admin).
export const GRAPH_KIND = {
  entity: { label: 'Entidade', color: 'champ' },
  order: { label: 'Pedidos', color: 'sage' },
  deal: { label: 'Negócios', color: 'gold' },
  quote: { label: 'Orçamentos', color: 'champ' },
  project: { label: 'Projetos', color: 'copper' },
  document: { label: 'Contratos/Docs', color: 'champ' },
  ticket: { label: 'Suporte', color: 'copper' },
  person: { label: 'Pessoas', color: 'sage' },
  loyalty: { label: 'Fidelidade', color: 'rose' },
}

// Monta os nós agregados do grafo a partir do objeto data do customer360.
// Cada nó "categoria" mostra a contagem; o nó central é a entidade.
export function buildGraph(contact, data) {
  const center = { id: 'center', kind: 'entity', label: contact.name || 'Entidade', count: null }
  const cats = []
  const add = (kind, arr, valueFn) => {
    const n = (arr || []).length
    if (n > 0) cats.push({ id: kind, kind, label: `${GRAPH_KIND[kind]?.label || kind}`, count: n, value: valueFn ? (arr.reduce((s, x) => s + Number(valueFn(x) || 0), 0)) : null })
  }
  add('order', data.orders, (o) => o.total)
  add('deal', data.deals, (d) => d.value)
  add('quote', data.quotes, (q) => q.total)
  add('project', data.projects, (p) => p.budget)
  add('document', data.documents)
  add('ticket', data.tickets)
  add('person', data.relationships)
  if (data.loyalty) cats.push({ id: 'loyalty', kind: 'loyalty', label: 'Fidelidade', count: data.loyalty.points || 0, value: null })
  return { center, cats }
}

// Copilot: resumo executivo + próximos passos, sobre os dados reais.
// Heurístico (sem chamada externa) — pode evoluir para LLM depois.
export function copilotBrief(contact, data, summary) {
  const s = summary || {}
  const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
  const recencyDays = s.lastPurchase ? Math.floor((Date.now() - new Date(s.lastPurchase).getTime()) / 86400000) : null

  // ---- Resumo ----
  const resumoParts = []
  resumoParts.push(`${contact.name || 'Este contato'} ${s.orderCount ? `já fez ${s.orderCount} compra(s)` : 'ainda não comprou'}`)
  if (s.totalSpent > 0) resumoParts.push(`somando ${brl(s.totalSpent)} (ticket médio ${brl(s.avgTicket)})`)
  if (s.openDealsValue > 0) resumoParts.push(`tem ${brl(s.openDealsValue)} em negócios abertos`)
  if (s.tier) resumoParts.push(`está no nível ${s.tier} de fidelidade`)
  const resumo = resumoParts.join(', ') + '.'

  // ---- Últimos assuntos (da timeline) ----
  const ultimos = (data.timeline || []).slice(0, 4).map((e) => e.title)

  // ---- Próximos passos ----
  const passos = []
  if (recencyDays != null && recencyDays > 60) passos.push(`Reengajar: sem comprar há ${recencyDays} dias — enviar oferta de retorno.`)
  if (s.openDealsValue > 0) passos.push('Avançar os negócios em aberto no pipeline (follow-up ativo).')
  if (s.ticketsOpen > 0) passos.push(`Resolver ${s.ticketsOpen} chamado(s) de suporte pendente(s).`)
  if (s.quotesCount > 0 && s.orderCount === 0) passos.push('Converter orçamento em venda — cliente pediu proposta mas não comprou.')
  if (!contact.email || !contact.phone) passos.push('Completar o cadastro de contato (falta e-mail ou telefone).')
  if (passos.length === 0) passos.push('Manter o relacionamento: enviar novidade ou conteúdo relevante.')

  // ---- Oportunidades ----
  const oportunidades = []
  if (s.orderCount >= 2 && s.projectsCount === 0) oportunidades.push('Cliente recorrente sem projeto — oferecer serviço/projeto (upsell).')
  if (s.totalSpent >= 1000) oportunidades.push('Alto valor — convidar para programa VIP ou plano superior.')
  if (s.orderCount === 1) oportunidades.push('Estimular a 2ª compra com um incentivo (cross-sell).')
  if (oportunidades.length === 0) oportunidades.push('Nenhuma oportunidade óbvia agora — acompanhar o comportamento.')

  // ---- Riscos ----
  const riscos = []
  if (recencyDays != null && recencyDays > 120) riscos.push('Risco alto de churn (inativo há muito tempo).')
  if (s.npsAvg != null && s.npsAvg <= 6) riscos.push(`Satisfação baixa (NPS ${s.npsAvg}).`)
  if (s.ticketsOpen > 1) riscos.push('Vários chamados abertos — insatisfação possível.')
  if (riscos.length === 0) riscos.push('Sem riscos aparentes.')

  return { resumo, ultimos, passos, oportunidades, riscos }
}
