// Seravie POS — motor adaptativo por segmento.
// O núcleo do PDV é sempre o mesmo; cada segmento liga um conjunto de "widgets".
// Um mesmo código atende cafeteria, loja, hotel, salão, oficina, clínica… sem
// virar sistemas diferentes.

// ---- WIDGETS opcionais (o núcleo — venda, caixa, cliente, pagamento, produtos — é sempre ativo) ----
export const POS_WIDGETS = [
  { key: 'barcode', label: 'Leitor de código de barras', desc: 'Campo de leitura e bipe de produtos', icon: 'tag', group: 'Venda' },
  { key: 'product_admin', label: 'Cadastro rápido de produtos', desc: 'Criar, editar e excluir produtos sem sair do PDV', icon: 'plus', group: 'Venda' },
  { key: 'coupon', label: 'Cupom de desconto', desc: 'Aplicar cupons na venda', icon: 'gift', group: 'Venda' },
  { key: 'item_notes', label: 'Observação por item', desc: 'Personalização: sem açúcar, leite vegetal, extras…', icon: 'spark', group: 'Venda' },
  { key: 'comandas', label: 'Comandas / mesas', desc: 'Segurar vendas em aberto (mesas, clientes)', icon: 'layers', group: 'Operação' },
  { key: 'kds', label: 'Enviar para a cozinha (KDS)', desc: 'Atalho para o Seravie Cuisine', icon: 'flame', group: 'Operação' },
  { key: 'stripe', label: 'Cobrança online (Stripe)', desc: 'Gerar link de pagamento para o cliente', icon: 'chart', group: 'Pagamento' },
  { key: 'loyalty', label: 'Fidelidade', desc: 'Acúmulo de pontos por venda', icon: 'star', group: 'Cliente' },
  { key: 'agenda', label: 'Agenda de serviços', desc: 'Agendar horário e profissional junto à venda (beleza/saúde)', icon: 'calendar', group: 'Serviços' },
  { key: 'service_orders', label: 'Ordem de serviço', desc: 'OS com objeto, peças e mão de obra (automotivo/assistência)', icon: 'layers', group: 'Serviços' },
  { key: 'hospedagem', label: 'Consumo na hospedagem', desc: 'Lançar consumo na conta do quarto/hóspede (hotel/pousada)', icon: 'building', group: 'Serviços' },
  { key: 'self_checkout', label: 'Self-checkout / tablet', desc: 'Modo autoatendimento com botões grandes para o cliente', icon: 'grid', group: 'Operação' },
]
export const POS_WIDGET_MAP = Object.fromEntries(POS_WIDGETS.map((w) => [w.key, w]))

// ---- PERFIS (agrupam segmentos e definem os widgets padrão) ----
export const POS_PROFILES = {
  retail: { label: 'Varejo', icon: 'cart', widgets: ['barcode', 'product_admin', 'coupon', 'stripe', 'loyalty'] },
  food: { label: 'Alimentação', icon: 'flame', widgets: ['comandas', 'item_notes', 'kds', 'coupon', 'product_admin', 'loyalty'] },
  hospitality: { label: 'Hotelaria', icon: 'building', widgets: ['coupon', 'product_admin', 'stripe', 'loyalty', 'hospedagem'] },
  beauty: { label: 'Beleza & Bem-estar', icon: 'heart', widgets: ['coupon', 'product_admin', 'loyalty', 'agenda'] },
  automotive: { label: 'Automotivo', icon: 'layers', widgets: ['product_admin', 'stripe', 'service_orders'] },
  healthcare: { label: 'Saúde', icon: 'heart', widgets: ['product_admin', 'stripe', 'agenda'] },
  professional: { label: 'Serviços & Consultoria', icon: 'book', widgets: ['product_admin', 'stripe', 'agenda'] },
  experience: { label: 'Seravie Experiences', icon: 'spark', widgets: ['barcode', 'product_admin', 'coupon', 'item_notes', 'comandas', 'kds', 'stripe', 'loyalty', 'agenda'] },
}

// ---- SEGMENTOS (o que aparece no onboarding "qual é o seu segmento?") ----
// Cada segmento aponta para um perfil, que traz os widgets padrão.
export const POS_SEGMENTS = [
  { key: 'cafeteria', label: 'Cafeteria', icon: 'cart', profile: 'food' },
  { key: 'restaurante', label: 'Restaurante', icon: 'flame', profile: 'food' },
  { key: 'padaria', label: 'Padaria', icon: 'flame', profile: 'food' },
  { key: 'chocolateria', label: 'Chocolateria', icon: 'gift', profile: 'food' },
  { key: 'loja', label: 'Loja / Varejo', icon: 'cart', profile: 'retail' },
  { key: 'mercado', label: 'Mercado / Minimercado', icon: 'cart', profile: 'retail' },
  { key: 'moda', label: 'Moda & Vestuário', icon: 'tag', profile: 'retail' },
  { key: 'presentes', label: 'Loja de Presentes', icon: 'gift', profile: 'retail' },
  { key: 'floricultura', label: 'Floricultura', icon: 'leaf', profile: 'retail' },
  { key: 'petshop', label: 'Pet Shop', icon: 'heart', profile: 'retail' },
  { key: 'vinicola', label: 'Vinícola / Adega', icon: 'star', profile: 'retail' },
  { key: 'cosmeticos', label: 'Cosméticos & Beleza', icon: 'star', profile: 'beauty' },
  { key: 'salao', label: 'Salão / Barbearia', icon: 'heart', profile: 'beauty' },
  { key: 'spa', label: 'Spa / Estética', icon: 'heart', profile: 'beauty' },
  { key: 'hotel', label: 'Hotel / Pousada', icon: 'building', profile: 'hospitality' },
  { key: 'clinica', label: 'Clínica / Consultório', icon: 'heart', profile: 'healthcare' },
  { key: 'academia', label: 'Academia', icon: 'spark', profile: 'healthcare' },
  { key: 'oficina', label: 'Oficina / Automotivo', icon: 'layers', profile: 'automotive' },
  { key: 'consultoria', label: 'Serviços & Consultoria', icon: 'book', profile: 'professional' },
  { key: 'experience', label: 'Seravie Experiences', icon: 'spark', profile: 'experience' },
  { key: 'outros', label: 'Outros', icon: 'grid', profile: 'retail' },
]
export const POS_SEGMENT_MAP = Object.fromEntries(POS_SEGMENTS.map((s) => [s.key, s]))

// widgets padrão a partir de um segmento
export function defaultWidgetsForSegment(segmentKey) {
  const seg = POS_SEGMENT_MAP[segmentKey]
  const prof = seg ? POS_PROFILES[seg.profile] : null
  return prof ? [...prof.widgets] : ['product_admin']
}
