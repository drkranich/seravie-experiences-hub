import { ResourceTabs, ResourcePanel } from './ResourcePanel'
import { KanbanBoard } from './Kanban'

// Catálogo Oficial da Rede — marketplace interno.
// HQ publica itens oficiais; as unidades pedem esses itens (kanban por status).
const CAT = {
  materia_prima: 'Matéria-prima',
  embalagem: 'Embalagem',
  produto_pronto: 'Produto pronto',
  visual_merch: 'Visual Merchandising',
  uniforme: 'Uniformes',
  mobiliario: 'Mobiliário',
  material_mkt: 'Material de Marketing',
  equipamento: 'Equipamentos',
  insumo: 'Insumos',
}
const STATUS = { draft: 'Rascunho', active: 'Publicado', archived: 'Arquivado' }

function CatalogTab({ notify }) {
  return (
    <ResourcePanel notify={notify} module="catalogo_oficial" table="network_catalog" embedded
      icon="box" exportName="catalogo-oficial" newLabel="Novo item"
      inject={{ status: 'active' }}
      fields={[
        { key: 'name', label: 'Item', type: 'text', primary: true, required: true, full: true, search: true },
        { key: 'category', label: 'Categoria', type: 'select', options: CAT, chip: true, filter: true },
        { key: 'sku', label: 'SKU / Código', type: 'text', chip: true, search: true },
        { key: 'ref_price', label: 'Preço de referência', type: 'currency' },
        { key: 'min_order', label: 'Pedido mínimo', type: 'int', default: 1 },
        { key: 'lead_time_days', label: 'Prazo de entrega (dias)', type: 'int' },
        { key: 'supplier', label: 'Fornecedor oficial', type: 'text', chip: true },
        { key: 'image_url', label: 'Imagem (URL)', type: 'text', full: true },
        { key: 'status', label: 'Publicação', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'description', label: 'Especificação', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Itens no catálogo', calc: (r) => r.length, fmt: 'int' },
        { label: 'Publicados', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Categorias', calc: (r) => new Set(r.map((x) => x.category).filter(Boolean)).size, fmt: 'int' },
        { label: 'Ticket médio', calc: (r) => { const v = r.filter((x) => x.ref_price > 0); return v.length ? v.reduce((s, x) => s + Number(x.ref_price), 0) / v.length : 0 }, fmt: 'currency' },
      ]}
    />
  )
}

function OrdersTab({ notify }) {
  return (
    <KanbanBoard notify={notify} module="catalogo_oficial" table="network_orders"
      title="" subtitle="pedidos das unidades ao catálogo oficial" icon="cart"
      stageField="status" stageLabel="Status" primary="item_name" valueField="total"
      stages={[
        ['submitted', 'Solicitado', 'border-admin-muted/30'],
        ['approved', 'Aprovado', 'border-admin-champ/40'],
        ['shipped', 'Enviado', 'border-admin-gold/40'],
        ['received', 'Recebido', 'border-admin-sage/50'],
        ['cancelled', 'Cancelado', 'border-admin-rose/40'],
      ]}
      chips={['unit_id', 'quantity', 'order_date']}
      fields={[
        { key: 'item_name', label: 'Item pedido', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Caixa de bombons 12un' },
        { key: 'item_id', label: 'Item do catálogo', type: 'ref', refTable: 'network_catalog', refLabel: 'name', placeholder: '— vincular ao catálogo —' },
        { key: 'unit_id', label: 'Unidade', type: 'ref', refTable: 'units', refLabel: 'name', placeholder: '— unidade solicitante —' },
        { key: 'quantity', label: 'Quantidade', type: 'int', default: 1 },
        { key: 'unit_price', label: 'Preço unitário', type: 'currency' },
        { key: 'total', label: 'Total do pedido', type: 'currency' },
        { key: 'order_date', label: 'Data do pedido', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Pedidos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Aguardando', calc: (r) => r.filter((x) => x.status === 'submitted').length, fmt: 'int' },
        { label: 'Em trânsito', calc: (r) => r.filter((x) => x.status === 'shipped').length, fmt: 'int' },
        { label: 'Volume (aberto)', calc: (r) => r.filter((x) => !['cancelled', 'received'].includes(x.status)).reduce((s, x) => s + Number(x.total || 0), 0), fmt: 'currency' },
      ]}
    />
  )
}

export function OfficialCatalogPanel({ notify }) {
  return (
    <ResourceTabs title="Catálogo Oficial" subtitle="marketplace interno da rede — itens oficiais e pedidos das unidades"
      tabs={[
        { key: 'catalog', label: 'Catálogo', render: () => <CatalogTab notify={notify} /> },
        { key: 'orders', label: 'Pedidos da Rede', render: () => <OrdersTab notify={notify} /> },
      ]}
    />
  )
}
