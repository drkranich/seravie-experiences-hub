import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { supplierTab, pairingTab } from './sharedTabs'

const WINE_TYPES = { tinto: 'Tinto', branco: 'Branco', rose: 'Rosé', espumante: 'Espumante', sobremesa: 'Sobremesa', fortificado: 'Fortificado' }

export function WinePanel({ notify }) {
  return (
    <ResourceTabs
      title="Vinhos"
      subtitle="Adega, harmonizações e fornecedores"
      tabs={[
        {
          key: 'labels', label: 'Rótulos',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="wine_labels" title="Rótulos" subtitle="rótulos na adega" icon="wine" newLabel="Novo rótulo" exportName="rotulos-vinho"
              orderBy={{ column: 'name', ascending: true }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
                { key: 'type', label: 'Tipo', type: 'select', options: WINE_TYPES, default: 'tinto', chip: true, filter: true },
                { key: 'vintage', label: 'Safra', type: 'year', chip: true, placeholder: '2020' },
                { key: 'grape', label: 'Uva', type: 'text', chip: true, placeholder: 'Malbec' },
                { key: 'producer', label: 'Produtor', type: 'text' },
                { key: 'region', label: 'Região', type: 'text' },
                { key: 'country', label: 'País', type: 'text' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'stock', label: 'Estoque', type: 'int', chip: true },
                { key: 'tasting_notes', label: 'Notas de degustação', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Rótulos', calc: (r) => r.length, fmt: 'int' },
                { label: 'Garrafas', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0), 0), fmt: 'int' },
                { label: 'Valor da adega', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
                { label: 'Ticket médio', calc: (r) => (r.length ? r.reduce((s, x) => s + Number(x.price || 0), 0) / r.length : 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        pairingTab(notify, { labelA: 'Vinho', labelB: 'Prato' }),
        supplierTab(notify),
      ]}
    />
  )
}
