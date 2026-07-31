import { ResourcePanel, ResourceTabs } from './ResourcePanel'

const APPT_STATUS = { scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' }

export function SpaPanel({ notify }) {
  return (
    <ResourceTabs
      title="Spa"
      subtitle="Agenda de atendimentos e catálogo de serviços"
      tabs={[
        {
          key: 'agenda', label: 'Agenda',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="appointments" title="Agenda" subtitle="agendamentos" icon="calendar" newLabel="Novo agendamento" exportName="agenda-spa"
              orderBy={{ column: 'date', ascending: false }}
              fields={[
                { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, required: true, full: true },
                { key: 'service', label: 'Serviço', type: 'text', chip: true },
                { key: 'professional', label: 'Profissional', type: 'text', chip: true },
                { key: 'date', label: 'Data', type: 'date' },
                { key: 'time', label: 'Hora', type: 'text', placeholder: '14:30' },
                { key: 'status', label: 'Status', type: 'status', options: APPT_STATUS, default: 'scheduled', filter: true },
                { key: 'notes', label: 'Observações', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Agendamentos', calc: (r) => r.length, fmt: 'int' },
                { label: 'Confirmados', calc: (r) => r.filter((x) => x.status === 'confirmed').length, fmt: 'int' },
                { label: 'Concluídos', calc: (r) => r.filter((x) => x.status === 'completed').length, fmt: 'int' },
                { label: 'Cancel./No-show', calc: (r) => r.filter((x) => ['cancelled', 'no_show'].includes(x.status)).length, fmt: 'int' },
              ]}
            />
          ),
        },
        {
          key: 'services', label: 'Serviços',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="spa_services" title="Serviços" subtitle="serviços e protocolos" icon="heart" newLabel="Novo serviço" exportName="servicos-spa"
              orderBy={{ column: 'name', ascending: true }}
              inject={{ is_active: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Massagem relaxante' },
                { key: 'category', label: 'Categoria', type: 'text', chip: true },
                { key: 'duration_min', label: 'Duração (min)', type: 'int', chip: true },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'is_active', label: 'Ativo', type: 'bool' },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Serviços', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.is_active).length, fmt: 'int' },
                { label: 'Duração média', calc: (r) => { const v = r.filter((x) => x.duration_min); return v.length ? Math.round(v.reduce((s, x) => s + x.duration_min, 0) / v.length) : 0 }, fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
      ]}
    />
  )
}
