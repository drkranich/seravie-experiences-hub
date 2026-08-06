import { ResourcePanel, ResourceTabs } from './ResourcePanel'

// Frentes com identidade de negócio própria (não mais só "catálogo genérico").
// Cada vertical declara suas abas específicas além do catálogo.
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }
const CO_STATUS = { orcamento: 'Orçamento', confirmado: 'Confirmado', producao: 'Produção', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' }

const META = {
  brewery: { title: 'Cervejaria', icon: 'cup', item: 'Rótulos', itemSing: 'rótulo', subtitle: 'rótulos, tap room e clube do chopp' },
  bakery: { title: 'Padaria & Confeitaria', icon: 'cup', item: 'Cardápio', itemSing: 'item', subtitle: 'cardápio, encomendas sob demanda e produção' },
  floriculture: { title: 'Floricultura', icon: 'leaf', item: 'Arranjos', itemSing: 'arranjo', subtitle: 'arranjos, entregas com data e assinaturas florais' },
  beauty: { title: 'Beauty', icon: 'heart', item: 'Produtos', itemSing: 'produto', subtitle: 'produtos, rotinas e assinaturas de reposição' },
  saboaria: { title: 'Saboaria', icon: 'leaf', item: 'Sabonetes', itemSing: 'sabonete', subtitle: 'sabonetes artesanais, encomendas, kits e clube de assinatura' },
  perfumaria: { title: 'Perfumaria', icon: 'heart', item: 'Perfumes', itemSing: 'perfume', subtitle: 'fragrâncias, decants, encomendas e clube de assinatura' },
}

const catalogTab = (vertical, cfg) => ({
  key: 'items', label: cfg.item,
  render: () => (
    <ResourcePanel embedded notify={cfg.notify} table="products" title={cfg.item} subtitle={cfg.item.toLowerCase()} icon={cfg.icon} newLabel={`Novo ${cfg.itemSing}`} exportName={vertical}
      orderBy={{ column: 'name', ascending: true }}
      baseFilter={{ column: 'tags', op: 'contains', value: [vertical] }}
      inject={{ tags: [vertical], status: 'active' }}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'text', chip: true },
        { key: 'sku', label: 'SKU', type: 'text' },
        { key: 'barcode', label: 'Código de barras', type: 'text', placeholder: 'Bipe ou digite' },
        { key: 'price', label: 'Preço (R$)', type: 'currency' },
        { key: 'cost', label: 'Custo (R$)', type: 'currency' },
        { key: 'stock', label: 'Estoque', type: 'int', chip: true },
        { key: 'image_url', label: 'Imagem (URL)', type: 'text', full: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: cfg.item, calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Estoque total', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0), 0), fmt: 'int' },
        { label: 'Valor em estoque', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
      ]}
    />
  ),
})

// Encomendas sob demanda (padaria, floricultura) — data de retirada/entrega, sinal, ocasião.
const customOrdersTab = (vertical, notify) => ({
  key: 'orders', label: 'Encomendas',
  render: () => (
    <ResourcePanel embedded notify={notify} table="custom_orders" title="Encomendas" subtitle="pedidos sob demanda com data" icon="calendar" newLabel="Nova encomenda" exportName={`${vertical}-encomendas`}
      orderBy={{ column: 'due_date', ascending: true }}
      baseFilter={{ column: 'vertical', op: 'eq', value: vertical }}
      inject={{ vertical, status: 'orcamento' }}
      fields={[
        { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, required: true },
        { key: 'customer_phone', label: 'Telefone', type: 'text', chip: true },
        { key: 'due_date', label: 'Data de entrega/retirada', type: 'date', chip: true, filter: true },
        { key: 'due_time', label: 'Horário', type: 'text' },
        { key: 'occasion', label: 'Ocasião', type: 'text', chip: true },
        { key: 'delivery_type', label: 'Tipo', type: 'status', options: { retirada: 'Retirada', entrega: 'Entrega' }, default: 'retirada' },
        { key: 'amount', label: 'Valor (R$)', type: 'currency' },
        { key: 'deposit', label: 'Sinal pago (R$)', type: 'currency' },
        { key: 'status', label: 'Status', type: 'status', options: CO_STATUS, default: 'orcamento', filter: true },
        { key: 'message', label: 'Mensagem do cartão', type: 'textarea', full: true },
        { key: 'description', label: 'Descrição do pedido', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Encomendas', calc: (r) => r.length, fmt: 'int' },
        { label: 'Em produção', calc: (r) => r.filter((x) => ['confirmado', 'producao'].includes(x.status)).length, fmt: 'int' },
        { label: 'A entregar (7d)', calc: (r) => r.filter((x) => x.due_date && (new Date(x.due_date) - new Date()) / 86400000 <= 7 && !['entregue', 'cancelado'].includes(x.status)).length, fmt: 'int' },
        { label: 'A receber', calc: (r) => r.filter((x) => x.status !== 'cancelado').reduce((s, x) => s + (Number(x.amount) || 0) - (Number(x.deposit) || 0), 0), fmt: 'currency' },
      ]}
    />
  ),
})

// Clube / assinatura de cliente (cervejaria, floricultura, beauty)
const clubTab = (vertical, notify) => ({
  key: 'club', label: 'Clube / Assinaturas',
  render: () => (
    <div className="space-y-6">
      <ResourcePanel embedded notify={notify} table="club_plans" title="Planos do clube" subtitle="planos de assinatura" icon="star" newLabel="Novo plano" exportName={`${vertical}-planos`}
        baseFilter={{ column: 'vertical', op: 'eq', value: vertical }} inject={{ vertical, active: true }}
        fields={[
          { key: 'name', label: 'Nome do plano', type: 'text', primary: true, required: true, full: true },
          { key: 'cadence', label: 'Frequência', type: 'status', options: { mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral' }, default: 'mensal' },
          { key: 'price', label: 'Preço/ciclo (R$)', type: 'currency', required: true },
          { key: 'items_per_cycle', label: 'Itens por ciclo', type: 'int' },
          { key: 'active', label: 'Ativo', type: 'bool', default: true },
          { key: 'description', label: 'Descrição', type: 'textarea', full: true },
        ]}
        kpis={[{ label: 'Planos', calc: (r) => r.length, fmt: 'int' }, { label: 'Ativos', calc: (r) => r.filter((x) => x.active).length, fmt: 'int' }]}
      />
      <ResourcePanel embedded notify={notify} table="club_subscriptions" title="Assinantes" subtitle="assinantes do clube" icon="user" newLabel="Novo assinante" exportName={`${vertical}-assinantes`}
        fields={[
          { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, required: true },
          { key: 'customer_email', label: 'E-mail', type: 'text' },
          { key: 'plan_id', label: 'Plano', type: 'ref', refTable: 'club_plans', refLabel: 'name', chip: true },
          { key: 'status', label: 'Status', type: 'status', options: { active: 'Ativo', paused: 'Pausado', cancelled: 'Cancelado' }, default: 'active', filter: true },
          { key: 'next_delivery', label: 'Próxima entrega', type: 'date', chip: true },
        ]}
        kpis={[
          { label: 'Assinantes', calc: (r) => r.length, fmt: 'int' },
          { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        ]}
      />
    </div>
  ),
})

const suppliersTab = (notify) => ({
  key: 'suppliers', label: 'Fornecedores',
  render: () => (
    <ResourcePanel embedded notify={notify} table="suppliers" title="Fornecedores" subtitle="fornecedores" icon="user" newLabel="Novo fornecedor" exportName="fornecedores"
      inject={{ status: 'active' }} orderBy={{ column: 'name', ascending: true }}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'text', chip: true },
        { key: 'contact', label: 'Contato', type: 'text' },
        { key: 'phone', label: 'Telefone', type: 'text', chip: true },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[{ label: 'Fornecedores', calc: (r) => r.length, fmt: 'int' }]}
    />
  ),
})

// Abas específicas por vertical — é isto que dá identidade real a cada frente.
const TABS_BY_VERTICAL = {
  brewery: (n) => [clubTab('brewery', n), suppliersTab(n)],
  bakery: (n) => [customOrdersTab('bakery', n), suppliersTab(n)],
  floriculture: (n) => [customOrdersTab('floriculture', n), clubTab('floriculture', n), suppliersTab(n)],
  beauty: (n) => [clubTab('beauty', n), suppliersTab(n)],
  saboaria: (n) => [customOrdersTab('saboaria', n), clubTab('saboaria', n), suppliersTab(n)],
  perfumaria: (n) => [customOrdersTab('perfumaria', n), clubTab('perfumaria', n), suppliersTab(n)],
}

export function VerticalCatalogPanel({ vertical, notify }) {
  const cfg = { ...(META[vertical] || { title: 'Catálogo', icon: 'box', item: 'Itens', itemSing: 'item', subtitle: 'catálogo e fornecedores' }), notify }
  const extra = (TABS_BY_VERTICAL[vertical] || (() => [suppliersTab(notify)]))(notify)
  return (
    <ResourceTabs title={cfg.title} subtitle={cfg.subtitle}
      tabs={[catalogTab(vertical, cfg), ...extra]}
    />
  )
}

// Compat: export antigo
export const VERTICAL_CATALOGS = META
