import { ResourcePanel, ResourceTabs } from './ResourcePanel'

const SEASONS = { year_round: 'Ano todo', easter: 'Páscoa', christmas: 'Natal', mothers_day: 'Dia das Mães', fathers_day: 'Dia dos Pais', valentines: 'Namorados', childrens: 'Dia das Crianças' }
const OCCASIONS = { none: 'Sem ocasião', birthday: 'Aniversário', wedding: 'Casamento', corporate: 'Corporativo', christmas: 'Natal', easter: 'Páscoa', valentines: 'Namorados', mothers_day: 'Dia das Mães' }
const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }

export function ChocolatePanel({ notify }) {
  return (
    <ResourceTabs
      title="Chocolateria"
      subtitle="Linhas, kits e presentes"
      tabs={[
        {
          key: 'lines', label: 'Linhas',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="chocolate_lines" title="Linhas" subtitle="linhas de produto" icon="gift" newLabel="Nova linha" exportName="chocolate-linhas"
              orderBy={{ column: 'sort_order', ascending: true }} inject={{ is_active: true }}
              fields={[
                { key: 'name', label: 'Nome da linha', type: 'text', primary: true, required: true, full: true },
                { key: 'season', label: 'Sazonalidade', type: 'select', options: SEASONS, default: 'year_round', chip: true, filter: true },
                { key: 'is_active', label: 'Ativa', type: 'bool' },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Linhas', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativas', calc: (r) => r.filter((x) => x.is_active).length, fmt: 'int' },
              ]}
            />
          ),
        },
        {
          key: 'kits', label: 'Kits',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="chocolate_kits" title="Kits" subtitle="kits e coleções" icon="gift" newLabel="Novo kit" exportName="chocolate-kits"
              orderBy={{ column: 'created_at', ascending: false }}
              fields={[
                { key: 'name', label: 'Nome do kit', type: 'text', primary: true, required: true, full: true },
                { key: 'line_id', label: 'Linha', type: 'ref', refTable: 'chocolate_lines', refLabel: 'name', chip: true, placeholder: '— sem linha —' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'occasion', label: 'Ocasião', type: 'select', options: OCCASIONS, default: 'none', chip: true, filter: true },
                { key: 'is_corporate', label: 'Corporativo', type: 'bool', chip: true },
                { key: 'is_customizable', label: 'Personalizável', type: 'bool', chip: true },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Kits', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
                { label: 'Corporativos', calc: (r) => r.filter((x) => x.is_corporate).length, fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        {
          key: 'gifts', label: 'Presentes',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="gift_items" title="Presentes" subtitle="presentes" icon="gift" newLabel="Novo presente" exportName="chocolate-presentes"
              orderBy={{ column: 'name', ascending: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
                { key: 'category', label: 'Categoria', type: 'text', chip: true },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'occasion', label: 'Ocasião', type: 'select', options: OCCASIONS, default: 'none', chip: true, filter: true },
                { key: 'is_personalizable', label: 'Personalizável', type: 'bool', chip: true },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Presentes', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
      ]}
    />
  )
}
