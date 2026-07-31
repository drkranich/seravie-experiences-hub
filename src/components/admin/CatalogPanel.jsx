import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

export function CatalogPanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', cost: '', stock: '', sku: '', barcode: '', status: 'active' })

  const loadProducts = async () => { setLoading(true); const { data } = await supabase.from('products').select('*').order('name'); setProducts(data || []); setLoading(false) }
  const loadOrders = async () => { setLoading(true); const { data } = await supabase.from('orders').select('*, contacts(name)').order('created_at', { ascending: false }).limit(50); setOrders(data || []); setLoading(false) }

  useEffect(() => { tab === 'products' ? loadProducts() : loadOrders() }, [tab])

  const save = async () => {
    if (!form.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const { error } = await supabase.from('products').insert({ ...form, price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || null, stock: parseInt(form.stock) || 0, tenant_id: profile?.tenant_id })
    if (error) { notify('Erro', 'error'); return }
    notify('Produto criado', 'success'); setShowForm(false); setForm({ name: '', description: '', price: '', cost: '', stock: '', sku: '', barcode: '', status: 'active' }); loadProducts()
  }

  const STATUS_COLORS = { pending:'text-admin-gold', confirmed:'text-admin-champ', processing:'text-admin-gold', ready:'text-admin-sage', delivered:'text-admin-muted/40', cancelled:'text-admin-rose', refunded:'text-admin-rose/50' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Catálogo</h1><p className="text-admin-muted/60 text-sm mt-1">{products.length} produtos</p></div>
        {tab === 'products' && <div className="flex gap-2">
          <button onClick={() => exportCsv('produtos.csv', products.map((p) => ({ nome: p.name, sku: p.sku, codigo_barras: p.barcode, preco: p.price, custo: p.cost, estoque: p.stock, status: p.status }))) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('Catálogo de produtos', products.map((p) => ({ nome: p.name, sku: p.sku, codigo_barras: p.barcode, preco: `R$ ${parseFloat(p.price || 0).toFixed(2)}`, custo: p.cost != null ? `R$ ${parseFloat(p.cost).toFixed(2)}` : '', estoque: p.stock, status: p.status })), 'Catálogo') || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo produto</button>
        </div>}
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['products','Produtos'],['orders','Pedidos']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>
      {tab === 'products' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p>
            : products.length === 0 ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhum produto</p></div>
            : products.map(p => (
              <div key={p.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-2"><p className="text-admin-text text-sm font-medium">{p.name}</p><span className={`text-[9px] px-2 py-0.5 rounded-lg ${p.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{p.status}</span></div>
                {p.sku && <p className="text-admin-muted/40 text-xs mb-2">SKU: {p.sku}</p>}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-admin-gold text-sm font-medium">R$ {parseFloat(p.price).toFixed(2)}</p>
                  <p className="text-admin-muted/40 text-xs">Estoque: {p.stock}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}
      {tab === 'orders' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : orders.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum pedido</p></div>
            : orders.map(o => (
              <div key={o.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3"><p className="text-admin-text text-sm">#{o.number}</p><p className="text-admin-muted/60 text-sm truncate">{o.contacts?.name || 'Sem cliente'}</p></div>
                  <p className="text-admin-muted/40 text-xs mt-0.5">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-admin-gold text-sm shrink-0">R$ {parseFloat(o.total).toFixed(2)}</p>
                <span className={`text-[10px] font-medium shrink-0 ${STATUS_COLORS[o.status]}`}>{o.status}</span>
              </div>
            ))
          }
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Novo produto</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Preço (R$)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Estoque</label><input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">SKU</label><input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Código de barras</label><input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Bipe aqui ou digite" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              </div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar produto</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
