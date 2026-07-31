import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { supplierTab } from './sharedTabs'

const CATEGORIES = { bebida: 'Bebida', grao: 'Grão', metodo: 'Método', doce: 'Doçaria' }
const EVENT_STATUS = { draft: 'Rascunho', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' }

export function CoffeePanel({ notify }) {
  return (
    <ResourceTabs
      title="Cafeteria"
      subtitle="Cardápio, workshops e fornecedores"
      tabs={[
        {
          key: 'menu', label: 'Cardápio',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="coffee_menu" title="Cardápio" subtitle="itens no cardápio" icon="cup" newLabel="Novo item" exportName="cardapio-cafe"
              orderBy={{ column: 'name', ascending: true }} inject={{ is_active: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Espresso Duplo' },
                { key: 'category', label: 'Categoria', type: 'select', options: CATEGORIES, default: 'bebida', chip: true, filter: true },
                { key: 'method', label: 'Método', type: 'text', chip: true, placeholder: 'Ex: Hario V60' },
                { key: 'origin', label: 'Origem', type: 'text', chip: true, placeholder: 'Ex: Cerrado MG' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'is_active', label: 'Ativo no cardápio', type: 'bool' },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Itens', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.is_active).length, fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        {
          key: 'workshops', label: 'Workshops',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="events" title="Workshops" subtitle="workshops" icon="calendar" newLabel="Novo workshop" exportName="workshops-cafe"
              orderBy={{ column: 'event_date', ascending: false }}
              baseFilter={{ column: 'type', op: 'eq', value: 'workshop' }} inject={{ type: 'workshop' }}
              fields={[
                { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Introdução ao Barismo' },
                { key: 'event_date', label: 'Data', type: 'date' },
                { key: 'guest_count', label: 'Vagas', type: 'int', chip: true },
                { key: 'venue', label: 'Local', type: 'text', chip: true },
                { key: 'budget', label: 'Valor (R$)', type: 'currency' },
                { key: 'status', label: 'Status', type: 'status', options: EVENT_STATUS, default: 'confirmed', filter: true },
                { key: 'notes', label: 'Observações', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Workshops', calc: (r) => r.length, fmt: 'int' },
                { label: 'Confirmados', calc: (r) => r.filter((x) => x.status === 'confirmed').length, fmt: 'int' },
                { label: 'Vagas ofertadas', calc: (r) => r.reduce((s, x) => s + (Number(x.guest_count) || 0), 0), fmt: 'int' },
              ]}
            />
          ),
        },
        supplierTab(notify),
      ]}
    />
  )
}
