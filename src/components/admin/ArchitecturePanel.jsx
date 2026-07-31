import { ResourcePanel } from './ResourcePanel'

const STATUS = { briefing: 'Briefing', design: 'Projeto', approval: 'Aprovação', execution: 'Execução', delivered: 'Entregue', cancelled: 'Cancelado' }

export function ArchitecturePanel({ notify }) {
  return (
    <ResourcePanel
      notify={notify}
      table="projects"
      title="Arquitetura"
      subtitle="projetos"
      icon="layout"
      exportName="projetos"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'name', label: 'Nome do projeto', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Loja conceito SP' },
        { key: 'client_name', label: 'Cliente', type: 'text', chip: true },
        { key: 'status', label: 'Etapa', type: 'status', options: STATUS, default: 'briefing', filter: true },
        { key: 'budget', label: 'Orçamento (R$)', type: 'currency' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'deadline', label: 'Prazo', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Projetos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Em execução', calc: (r) => r.filter((x) => x.status === 'execution').length, fmt: 'int' },
        { label: 'Entregues', calc: (r) => r.filter((x) => x.status === 'delivered').length, fmt: 'int' },
        { label: 'Pipeline (R$)', calc: (r) => r.filter((x) => !['delivered', 'cancelled'].includes(x.status)).reduce((s, x) => s + Number(x.budget || 0), 0), fmt: 'currency' },
      ]}
    />
  )
}
