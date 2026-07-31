import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { supplierTab, pairingTab } from './sharedTabs'

const OCCASIONS = { none: 'Sem ocasião', corporate: 'Corporativo', christmas: 'Natal', birthday: 'Aniversário', wedding: 'Casamento', valentines: 'Namorados' }
const HAMPER_TYPES = { cesta: 'Cesta', kit: 'Kit', tabua: 'Tábua' }
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }

export function EmporioPanel({ notify }) {
  return (
    <ResourceTabs
      title="Empório Gourmet"
      subtitle="Produtos, cestas, harmonizações e fornecedores"
      tabs={[
        {
          key: 'products', label: 'Produtos',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="products" title="Produtos" subtitle="produtos" icon="box" newLabel="Novo produto" exportName="produtos-emporio"
              orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
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
                { label: 'Produtos', calc: (r) => r.length, fmt: 'int' },
                { label: 'Estoque total', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0), 0), fmt: 'int' },
                { label: 'Valor em estoque', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        {
          key: 'hampers', label: 'Cestas & Kits',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="hampers" title="Cestas & Kits" subtitle="cestas e kits" icon="gift" newLabel="Nova cesta/kit" exportName="cestas-kits"
              orderBy={{ column: 'created_at', ascending: false }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Cesta Café da Manhã' },
                { key: 'type', label: 'Tipo', type: 'select', options: HAMPER_TYPES, default: 'cesta', chip: true, filter: true },
                { key: 'occasion', label: 'Ocasião', type: 'select', options: OCCASIONS, default: 'none', chip: true, filter: true },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição / itens', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Cestas & Kits', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        pairingTab(notify, { labelA: 'Item A', labelB: 'Item B' }),
        supplierTab(notify),
      ]}
    />
  )
}
