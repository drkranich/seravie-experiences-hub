import { ResourcePanel } from './ResourcePanel'

const TYPES = { wedding: 'Casamento', corporate: 'Corporativo', birthday: 'Aniversário', buffet: 'Buffet', graduation: 'Formatura', other: 'Outro' }
const STATUS = { briefing: 'Briefing', proposal: 'Proposta', confirmed: 'Confirmado', in_progress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' }

export function EventsPanel({ notify }) {
  return (
    <ResourcePanel
      notify={notify}
      table="events"
      title="Eventos"
      subtitle="eventos"
      icon="star"
      exportName="eventos"
      orderBy={{ column: 'event_date', ascending: false }}
      baseFilter={{ column: 'type', op: 'neq', value: 'workshop' }}
      inject={{ type: 'wedding' }}
      fields={[
        { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Casamento Ana & João' },
        { key: 'type', label: 'Tipo', type: 'select', options: TYPES, default: 'wedding', chip: true, filter: true },
        { key: 'status', label: 'Etapa', type: 'status', options: STATUS, default: 'briefing', filter: true },
        { key: 'event_date', label: 'Data', type: 'date' },
        { key: 'venue', label: 'Local', type: 'text', chip: true },
        { key: 'guest_count', label: 'Convidados', type: 'int', chip: true },
        { key: 'budget', label: 'Orçamento (R$)', type: 'currency' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Eventos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Confirmados', calc: (r) => r.filter((x) => ['confirmed', 'in_progress'].includes(x.status)).length, fmt: 'int' },
        { label: 'Convidados', calc: (r) => r.reduce((s, x) => s + (Number(x.guest_count) || 0), 0), fmt: 'int' },
        { label: 'Pipeline (R$)', calc: (r) => r.filter((x) => !['completed', 'cancelled'].includes(x.status)).reduce((s, x) => s + Number(x.budget || 0), 0), fmt: 'currency' },
      ]}
    />
  )
}
