import { ResourcePanel } from './ResourcePanel'

/** Aba de Fornecedores reutilizável (tabela suppliers). */
export const supplierTab = (notify) => ({
  key: 'suppliers', label: 'Fornecedores',
  render: () => (
    <ResourcePanel
      embedded notify={notify} table="suppliers" title="Fornecedores" subtitle="fornecedores" icon="user" newLabel="Novo fornecedor" exportName="fornecedores"
      inject={{ status: 'active' }} orderBy={{ column: 'name', ascending: true }}
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
})

/** Aba de Harmonizações reutilizável (tabela pairings). */
export const pairingTab = (notify, { labelA = 'Item A', labelB = 'Item B' } = {}) => ({
  key: 'pairings', label: 'Harmonizações',
  render: () => (
    <ResourcePanel
      embedded notify={notify} table="pairings" title="Harmonizações" subtitle="harmonizações" icon="spark" newLabel="Nova harmonização" exportName="harmonizacoes"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true },
        { key: 'item_a', label: labelA, type: 'text', chip: true },
        { key: 'item_b', label: labelB, type: 'text', chip: true },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]}
      kpis={[{ label: 'Harmonizações', calc: (r) => r.length, fmt: 'int' }]}
    />
  ),
})
