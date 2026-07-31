import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { exportCsv, exportPdf } from '../../lib/export'

const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' }
const ORDER_STATUS_COLORS = { pending: 'text-admin-gold', confirmed: 'text-admin-champ', processing: 'text-admin-gold', ready: 'text-admin-sage', delivered: 'text-admin-muted/40', cancelled: 'text-admin-rose', refunded: 'text-admin-rose/50' }

function OrdersView({ notify }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('orders').select('*, contacts(name)').order('created_at', { ascending: false }).limit(100)
      setOrders(data || []); setLoading(false)
    })()
  }, [])
  const exportRows = () => orders.map((o) => ({ Pedido: `#${o.number}`, Cliente: o.contacts?.name || 'Sem cliente', Data: o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '', Total: `R$ ${parseFloat(o.total || 0).toFixed(2)}`, Status: o.status }))
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-admin-muted/50 text-sm">{orders.length} pedidos</p>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('pedidos.csv', exportRows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('Pedidos', exportRows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
        : orders.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum pedido</p></div>
        : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3"><p className="text-admin-text text-sm">#{o.number}</p><p className="text-admin-muted/60 text-sm truncate">{o.contacts?.name || 'Sem cliente'}</p></div>
                  <p className="text-admin-muted/40 text-xs mt-0.5">{o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : ''}</p>
                </div>
                <p className="text-admin-gold text-sm shrink-0">R$ {parseFloat(o.total || 0).toFixed(2)}</p>
                <span className={`text-[10px] font-medium shrink-0 ${ORDER_STATUS_COLORS[o.status]}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

export function CatalogPanel({ notify }) {
  return (
    <ResourceTabs
      title="Catálogo"
      subtitle="Produtos e pedidos"
      tabs={[
        {
          key: 'products', label: 'Produtos',
          render: () => (
            <ResourcePanel
              embedded notify={notify} table="products" title="Produtos" subtitle="produtos" icon="box" newLabel="Novo produto" exportName="produtos"
              orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
              fields={[
                { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
                { key: 'sku', label: 'SKU', type: 'text', chip: true },
                { key: 'barcode', label: 'Código de barras', type: 'text', placeholder: 'Bipe aqui ou digite' },
                { key: 'price', label: 'Preço (R$)', type: 'currency' },
                { key: 'cost', label: 'Custo (R$)', type: 'currency' },
                { key: 'stock', label: 'Estoque', type: 'int', chip: true },
                { key: 'min_stock', label: 'Estoque mínimo', type: 'int' },
                { key: 'unit', label: 'Unidade', type: 'text', placeholder: 'un, kg, cx' },
                { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
                { key: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              kpis={[
                { label: 'Produtos', calc: (r) => r.length, fmt: 'int' },
                { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
                { label: 'Estoque baixo', calc: (r) => r.filter((x) => x.min_stock != null && Number(x.stock) <= Number(x.min_stock)).length, fmt: 'int' },
                { label: 'Valor em estoque', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
              ]}
            />
          ),
        },
        { key: 'orders', label: 'Pedidos', render: () => <OrdersView notify={notify} /> },
      ]}
    />
  )
}
