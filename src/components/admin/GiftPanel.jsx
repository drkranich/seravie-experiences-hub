import { ResourcePanel } from './ResourcePanel'

const OCCASIONS = { none: 'Sem ocasião', birthday: 'Aniversário', wedding: 'Casamento', corporate: 'Corporativo', christmas: 'Natal', valentines: 'Namorados', mothers_day: 'Dia das Mães', fathers_day: 'Dia dos Pais' }
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }

export function GiftPanel({ notify }) {
  return (
    <ResourcePanel
      notify={notify}
      table="gift_items"
      title="Presentes"
      subtitle="itens no catálogo de presentes"
      icon="gift"
      exportName="presentes"
      orderBy={{ column: 'name', ascending: true }}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'text', chip: true, placeholder: 'Ex: Cesta, Kit' },
        { key: 'price', label: 'Preço (R$)', type: 'currency' },
        { key: 'occasion', label: 'Ocasião', type: 'select', options: OCCASIONS, default: 'none', chip: true, filter: true },
        { key: 'is_personalizable', label: 'Personalizável', type: 'bool', chip: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Itens', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Personalizáveis', calc: (r) => r.filter((x) => x.is_personalizable).length, fmt: 'int' },
        { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
      ]}
    />
  )
}
