// Seravie Relationship Studio — Customer 360.
// Agrega, para uma entidade (contato/empresa), TUDO que ela fez no ecossistema:
// pedidos, negócios, orçamentos, projetos, documentos, agenda, conversas,
// tickets, fidelidade, gift cards, NPS, datas especiais e relacionamentos.
// Monta uma timeline unificada e resumos para a visão 360°.
import { supabase } from './supabase'

const num = (n) => Number(n || 0)

// Busca tudo de uma entidade em paralelo (tolerante a tabelas ausentes).
export async function loadCustomer360(contactId) {
  const q = (table, sel, order = 'created_at') =>
    supabase.from(table).select(sel).eq('contact_id', contactId).order(order, { ascending: false }).limit(100)
      .then((r) => r.data || []).catch(() => [])

  const [
    orders, deals, quotes, projects, documents, appointments, conversations,
    tickets, loyalty, giftCards, nps, serviceOrders, specialDates, relationships,
  ] = await Promise.all([
    q('orders', 'id, number, total, status, channel, created_at'),
    q('deals', 'id, title, value, stage, status, created_at, closed_at'),
    q('quotes', 'id, number, title, total, status, created_at'),
    q('projects', 'id, name, status, budget, deadline, created_at'),
    q('documents', 'id, title, type, status, created_at, signed_at'),
    q('appointments', 'id, service, professional, date, time, status, created_at', 'created_at'),
    q('conversations', 'id, channel, subject, status, last_message_at, created_at'),
    q('tickets', 'id, number, subject, status, priority, created_at'),
    supabase.from('loyalty_accounts').select('points, lifetime_points, tier').eq('contact_id', contactId).maybeSingle().then((r) => r.data).catch(() => null),
    q('gift_cards', 'id, code, balance, status, created_at'),
    q('nps_surveys', 'score, comment, responded_at, created_at'),
    q('service_orders', 'id, number, object_label, total, status, created_at'),
    q('contact_special_dates', 'id, label, date, notify, created_at', 'date'),
    supabase.from('contact_relationships').select('id, related_id, relationship, related:contacts!contact_relationships_related_id_fkey(name)').eq('contact_id', contactId).then((r) => r.data || []).catch(() => []),
  ])

  // ---- Resumos ----
  const paidOrders = orders.filter((o) => o.status !== 'cancelled')
  const totalSpent = paidOrders.reduce((s, o) => s + num(o.total), 0)
  const openDeals = deals.filter((d) => d.status === 'open' || (d.status !== 'won' && d.status !== 'lost'))
  const wonDeals = deals.filter((d) => d.status === 'won')
  const summary = {
    orderCount: paidOrders.length,
    totalSpent,
    avgTicket: paidOrders.length ? totalSpent / paidOrders.length : 0,
    lastPurchase: paidOrders[0]?.created_at || null,
    openDealsValue: openDeals.reduce((s, d) => s + num(d.value), 0),
    wonDealsValue: wonDeals.reduce((s, d) => s + num(d.value), 0),
    quotesCount: quotes.length,
    projectsCount: projects.length,
    documentsCount: documents.length,
    ticketsOpen: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    points: loyalty?.points || 0,
    tier: loyalty?.tier || null,
    npsAvg: nps.filter((n) => n.score != null).length ? Math.round(nps.filter((n) => n.score != null).reduce((s, n) => s + n.score, 0) / nps.filter((n) => n.score != null).length) : null,
  }

  // ---- Timeline unificada (eventos de todas as fontes) ----
  const ev = []
  const push = (date, kind, icon, title, sub, value) => { if (date) ev.push({ date, kind, icon, title, sub, value }) }
  orders.forEach((o) => push(o.created_at, 'order', 'cart', `Pedido #${o.number || ''}`, o.status, o.total))
  deals.forEach((d) => push(d.created_at, 'deal', 'chart', `Negócio: ${d.title}`, d.stage, d.value))
  quotes.forEach((x) => push(x.created_at, 'quote', 'tag', `Orçamento ${x.number || ''}: ${x.title || ''}`, x.status, x.total))
  projects.forEach((p) => push(p.created_at, 'project', 'layers', `Projeto: ${p.name}`, p.status, p.budget))
  documents.forEach((d) => push(d.signed_at || d.created_at, 'document', 'book', `Documento: ${d.title}`, d.status))
  appointments.forEach((a) => push(a.created_at, 'appointment', 'calendar', `Agendamento: ${a.service || ''}`, a.status))
  conversations.forEach((c) => push(c.last_message_at || c.created_at, 'conversation', 'mail', `Conversa (${c.channel || ''})`, c.subject))
  tickets.forEach((t) => push(t.created_at, 'ticket', 'check', `Chamado #${t.number || ''}: ${t.subject || ''}`, t.status))
  serviceOrders.forEach((s) => push(s.created_at, 'service', 'gear', `OS #${s.number || ''}: ${s.object_label || ''}`, s.status, s.total))
  nps.forEach((n) => push(n.responded_at || n.created_at, 'nps', 'star', `NPS: nota ${n.score}`, n.comment))
  giftCards.forEach((g) => push(g.created_at, 'giftcard', 'gift', `Gift card ${g.code}`, g.status, g.balance))
  ev.sort((a, b) => new Date(b.date) - new Date(a.date))

  return {
    summary, timeline: ev,
    orders, deals, quotes, projects, documents, appointments, conversations,
    tickets, loyalty, giftCards, nps, serviceOrders, specialDates, relationships,
  }
}

// Score de relacionamento (heurístico, 0..100) a partir dos resumos.
export function relationshipScore(s) {
  if (!s) return { relationship: 0, purchase: 0, engagement: 0, financial: 0, overall: 0 }
  const recencyDays = s.lastPurchase ? (Date.now() - new Date(s.lastPurchase).getTime()) / 86400000 : 9999
  const purchase = Math.min(100, s.orderCount * 12 + (s.totalSpent > 0 ? 20 : 0))
  const engagement = Math.min(100, (s.projectsCount + s.quotesCount + s.documentsCount) * 10 + (s.npsAvg ? s.npsAvg / 10 : 0))
  const relationship = Math.max(0, 100 - Math.min(100, recencyDays / 2)) // quanto mais recente, maior
  const financial = Math.min(100, Math.round(s.totalSpent / 100)) // R$100 = 1 ponto (cap 100)
  const overall = Math.round((purchase + engagement + relationship + financial) / 4)
  return { relationship: Math.round(relationship), purchase: Math.round(purchase), engagement: Math.round(engagement), financial, overall }
}

// Insights automáticos (o "copilot" simples) sobre a entidade.
export function customerInsights(s, timeline) {
  const out = []
  if (!s) return out
  const recencyDays = s.lastPurchase ? Math.floor((Date.now() - new Date(s.lastPurchase).getTime()) / 86400000) : null
  if (recencyDays != null && recencyDays > 90) out.push({ tone: 'rose', icon: 'clock', text: `Cliente inativo há ${recencyDays} dias — considere uma campanha de reativação.` })
  if (s.openDealsValue > 0) out.push({ tone: 'gold', icon: 'chart', text: `Há negócios em aberto somando ${fmtBRL(s.openDealsValue)} — priorize o follow-up.` })
  if (s.ticketsOpen > 0) out.push({ tone: 'copper', icon: 'check', text: `${s.ticketsOpen} chamado(s) de suporte em aberto — atenção ao atendimento.` })
  if (s.orderCount >= 3 && s.projectsCount === 0) out.push({ tone: 'sage', icon: 'layers', text: 'Comprador recorrente sem projeto vinculado — oportunidade de upsell.' })
  if (s.npsAvg != null && s.npsAvg <= 6) out.push({ tone: 'rose', icon: 'star', text: `NPS baixo (${s.npsAvg}) — risco de churn, vale um contato próximo.` })
  if (s.totalSpent > 0 && s.orderCount === 1) out.push({ tone: 'champ', icon: 'spark', text: 'Primeira compra registrada — ative a jornada de boas-vindas.' })
  if (out.length === 0) out.push({ tone: 'sage', icon: 'check', text: 'Relacionamento saudável — sem alertas no momento.' })
  return out
}

function fmtBRL(n) { return `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }

export const TIMELINE_KIND = {
  order: { label: 'Pedido', color: 'sage' }, deal: { label: 'Negócio', color: 'gold' },
  quote: { label: 'Orçamento', color: 'champ' }, project: { label: 'Projeto', color: 'copper' },
  document: { label: 'Documento', color: 'champ' }, appointment: { label: 'Agenda', color: 'gold' },
  conversation: { label: 'Conversa', color: 'sage' }, ticket: { label: 'Suporte', color: 'copper' },
  service: { label: 'OS', color: 'gold' }, nps: { label: 'NPS', color: 'rose' }, giftcard: { label: 'Gift card', color: 'rose' },
}
