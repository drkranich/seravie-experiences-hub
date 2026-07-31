import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { supplierTab } from './sharedTabs'

const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }
const COMMISSION_STATUS = { briefing: 'Briefing', aprovado: 'Aprovado', producao: 'Em produção', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' }

export function CraftPanel({ notify }) {
  return (
    <ResourceTabs
      title="Artesanato"
      subtitle="Peças, encomendas personalizadas e fornecedores"
      tabs={[
        {
          key: 'items', label: 'Peças',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="craft_items" title="Peças" subtitle="peças no ateliê" icon="palette" newLabel="Nova peça" exportName="artesanato-pecas"
              orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
              fields={[
                { key: 'name', label: 'Nome da peça', type: 'text', primary: true, required: true, full: true },
                { key: 'artisan', label: 'Artesão', type: 'text', chip: true },
                { key: 'technique', label: 'Técnica', type: 'text', chip: true, placeholder: 'Cerâmica, Crochê, Macramê…' },
                { key: 'material', label: 'Material', type: 'text', chip: true },
                { key: 'collection', label: 'Coleção', type: 'text', filter: false },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'cost', label: 'Custo (R$)', type: 'currency' },
                { key: 'stock', label: 'Estoque', type: 'int', chip: true },
                { key: 'lead_time_days', label: 'Prazo de produção (dias)', type: 'int' },
                { key: 'is_unique', label: 'Peça única', type: 'bool', chip: true },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Peças', calc: (r) => r.length, fmt: 'int' },
                { label: 'Peças únicas', calc: (r) => r.filter((x) => x.is_unique).length, fmt: 'int' },
                { label: 'Estoque total', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0), 0), fmt: 'int' },
                { label: 'Valor em estoque', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        {
          key: 'commissions', label: 'Encomendas',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="craft_commissions" title="Encomendas" subtitle="encomendas personalizadas" icon="pen" newLabel="Nova encomenda" exportName="artesanato-encomendas"
              orderBy={{ column: 'created_at', ascending: false }}
              fields={[
                { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, required: true, full: true },
                { key: 'contact', label: 'Contato', type: 'text', chip: true },
                { key: 'status', label: 'Etapa', type: 'status', options: COMMISSION_STATUS, default: 'briefing', filter: true },
                { key: 'price', label: 'Valor (R$)', type: 'currency' },
                { key: 'deadline', label: 'Prazo', type: 'date' },
                { key: 'description', label: 'Descrição da peça', type: 'textarea' },
                { key: 'notes', label: 'Observações', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Encomendas', calc: (r) => r.length, fmt: 'int' },
                { label: 'Em produção', calc: (r) => r.filter((x) => x.status === 'producao').length, fmt: 'int' },
                { label: 'Entregues', calc: (r) => r.filter((x) => x.status === 'entregue').length, fmt: 'int' },
                { label: 'Carteira (R$)', calc: (r) => r.filter((x) => !['entregue', 'cancelado'].includes(x.status)).reduce((s, x) => s + Number(x.price || 0), 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        supplierTab(notify),
      ]}
    />
  )
}
