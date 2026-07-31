import { ResourcePanel, ResourceTabs } from './ResourcePanel'

// Frentes baseadas em catálogo próprio (produtos escopados por tag) + fornecedores.
export const VERTICAL_CATALOGS = {
  brewery: { title: 'Cervejaria', icon: 'cup', item: 'Rótulos', itemSing: 'rótulo' },
  bakery: { title: 'Padaria', icon: 'cup', item: 'Produtos', itemSing: 'produto' },
  floriculture: { title: 'Floricultura', icon: 'leaf', item: 'Arranjos', itemSing: 'arranjo' },
  beauty: { title: 'Beauty', icon: 'heart', item: 'Produtos', itemSing: 'produto' },
}
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }

export function VerticalCatalogPanel({ vertical, notify }) {
  const cfg = VERTICAL_CATALOGS[vertical] || { title: 'Catálogo', icon: 'box', item: 'Itens', itemSing: 'item' }
  return (
    <ResourceTabs
      title={cfg.title}
      subtitle={`Catálogo de ${cfg.item.toLowerCase()} e fornecedores`}
      tabs={[
        {
          key: 'items', label: cfg.item,
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="products" title={cfg.item} subtitle={cfg.item.toLowerCase()} icon={cfg.icon} newLabel={`Novo ${cfg.itemSing}`} exportName={vertical}
              orderBy={{ column: 'name', ascending: true }}
              baseFilter={{ column: 'tags', op: 'contains', value: [vertical] }}
              inject={{ tags: [vertical], status: 'active' }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
                { key: 'sku', label: 'SKU', type: 'text', chip: true },
                { key: 'barcode', label: 'Código de barras', type: 'text', placeholder: 'Bipe ou digite' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'cost', label: 'Custo (R$)', type: 'currency' },
                { key: 'stock', label: 'Estoque', type: 'int', chip: true },
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
        },
        {
          key: 'suppliers', label: 'Fornecedores',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="suppliers" title="Fornecedores" subtitle="fornecedores" icon="user" newLabel="Novo fornecedor" exportName="fornecedores"
              inject={{ status: 'active' }}
              orderBy={{ column: 'name', ascending: true }}
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
        },
      ]}
    />
  )
}
