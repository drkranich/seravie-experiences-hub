import { ResourcePanel, ResourceTabs } from './ResourcePanel'

const TYPES = { passeio: 'Passeio', roteiro: 'Roteiro', transfer: 'Transfer', experiencia: 'Experiência', ingresso: 'Ingresso' }
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }

export function TourismPanel({ notify }) {
  return (
    <ResourceTabs
      title="Turismo"
      subtitle="Passeios, roteiros e parceiros"
      tabs={[
        {
          key: 'tours', label: 'Passeios & Roteiros',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="tours" title="Passeios" subtitle="passeios e roteiros" icon="map" newLabel="Novo passeio" exportName="passeios"
              orderBy={{ column: 'name', ascending: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: City Tour Histórico' },
                { key: 'type', label: 'Tipo', type: 'select', options: TYPES, default: 'passeio', chip: true, filter: true },
                { key: 'duration', label: 'Duração', type: 'text', chip: true, placeholder: '3h' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'capacity', label: 'Capacidade', type: 'int', chip: true },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Passeios', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
                { label: 'Lugares/ciclo', calc: (r) => r.reduce((s, x) => s + (Number(x.capacity) || 0), 0), fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        {
          key: 'partners', label: 'Parceiros',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="suppliers" title="Parceiros" subtitle="parceiros e fornecedores" icon="user" newLabel="Novo parceiro" exportName="parceiros"
              inject={{ status: 'active' }}
              orderBy={{ column: 'name', ascending: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
                { key: 'category', label: 'Categoria', type: 'text', chip: true, placeholder: 'Guia, Transporte, Hotel' },
                { key: 'contact', label: 'Contato', type: 'text' },
                { key: 'phone', label: 'Telefone', type: 'text', chip: true },
                { key: 'email', label: 'E-mail', type: 'text' },
                { key: 'notes', label: 'Observações', type: 'textarea' },
              ]}
              kpis={[{ label: 'Parceiros', calc: (r) => r.length, fmt: 'int' }]}
            />
          ),
        },
      ]}
    />
  )
}
