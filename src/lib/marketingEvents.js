// Seravie Marketing Hub — Motor de Eventos do ecossistema.
// O diferencial da Seravie: campanhas disparam porque ALGO ACONTECEU em qualquer
// módulo (PDV, CRM, e-commerce, fidelidade, reservas, financeiro, academy), e não
// porque alguém entrou numa lista. Cada módulo emite eventos; as jornadas reagem.
import { supabase } from './supabase'

// ---- Catálogo de tipos de evento (fonte única) ----
// icon/color usam os tokens do design system admin.
export const MARKETING_EVENTS = [
  { type: 'first_purchase', label: 'Primeira compra', module: 'pos', icon: 'star', color: 'champ', desc: 'Cliente comprou pela primeira vez.' },
  { type: 'sale_completed', label: 'Venda concluída', module: 'pos', icon: 'cart', color: 'sage', desc: 'Uma venda foi finalizada no PDV ou e-commerce.' },
  { type: 'high_ticket', label: 'Compra acima da média', module: 'pos', icon: 'chart', color: 'gold', desc: 'Ticket acima do valor definido.' },
  { type: 'birthday_near', label: 'Aniversário próximo', module: 'crm', icon: 'gift', color: 'rose', desc: 'Aniversário do cliente está chegando.' },
  { type: 'points_reached', label: 'Atingiu pontos', module: 'loyalty', icon: 'star', color: 'gold', desc: 'Cliente atingiu uma faixa de pontos de fidelidade.' },
  { type: 'winback_due', label: 'Cliente inativo', module: 'crm', icon: 'clock', color: 'rose', desc: 'Cliente sem comprar há N dias.' },
  { type: 'cart_abandoned', label: 'Carrinho abandonado', module: 'ecommerce', icon: 'cart', color: 'copper', desc: 'Deixou itens no carrinho sem concluir.' },
  { type: 'quote_approved', label: 'Orçamento aprovado', module: 'crm', icon: 'check', color: 'sage', desc: 'Um orçamento foi aprovado pelo cliente.' },
  { type: 'checkout', label: 'Check-out (hospedagem)', module: 'reservations', icon: 'building', color: 'champ', desc: 'Hóspede fez check-out.' },
  { type: 'reservation_upcoming', label: 'Reserva chegando', module: 'reservations', icon: 'calendar', color: 'gold', desc: 'Reserva a X dias da chegada.' },
  { type: 'course_completed', label: 'Curso concluído', module: 'academy', icon: 'book', color: 'sage', desc: 'Usuário concluiu um curso na Academy.' },
  { type: 'payment_late', label: 'Pagamento atrasado', module: 'finance', icon: 'clock', color: 'rose', desc: 'Um pagamento venceu sem quitação.' },
  { type: 'review_left', label: 'Avaliação recebida', module: 'crm', icon: 'star', color: 'champ', desc: 'Cliente deixou uma avaliação.' },
  { type: 'omnichannel', label: 'Loja física + online', module: 'crm', icon: 'layers', color: 'copper', desc: 'Comprou na loja física e também no e-commerce.' },
]
export const EVENT_MAP = Object.fromEntries(MARKETING_EVENTS.map((e) => [e.type, e]))
export const eventLabel = (t) => EVENT_MAP[t]?.label || t

// ---- Emissor de eventos ----
// Chame em qualquer módulo quando algo relevante acontecer. Nunca lança exceção
// (marketing é secundário à operação): falha em silêncio e retorna {ok}.
export async function emitMarketingEvent(evt, tenantId) {
  try {
    if (!tenantId || !evt?.event_type) return { ok: false }
    const row = {
      tenant_id: tenantId,
      event_type: evt.event_type,
      source_module: evt.source_module || EVENT_MAP[evt.event_type]?.module || null,
      contact_id: evt.contact_id || null,
      reference_id: evt.reference_id || null,
      reference_type: evt.reference_type || null,
      payload: evt.payload || {},
    }
    const { error } = await supabase.from('marketing_events').insert(row)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// Atalho para o evento mais comum (venda), inferindo primeira compra / alto ticket.
export async function emitSaleEvents({ tenantId, contactId, orderId, total, isFirst, avgTicket }) {
  const jobs = []
  jobs.push(emitMarketingEvent({ event_type: isFirst ? 'first_purchase' : 'sale_completed', source_module: 'pos', contact_id: contactId, reference_id: orderId, reference_type: 'order', payload: { total } }, tenantId))
  if (avgTicket && Number(total) >= Number(avgTicket) * 1.5) {
    jobs.push(emitMarketingEvent({ event_type: 'high_ticket', source_module: 'pos', contact_id: contactId, reference_id: orderId, reference_type: 'order', payload: { total, avgTicket } }, tenantId))
  }
  try { await Promise.all(jobs) } catch { /* noop */ }
  return { ok: true }
}
