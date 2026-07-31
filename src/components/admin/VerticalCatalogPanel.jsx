import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

// Frentes baseadas em catálogo próprio (produtos escopados por tag) + fornecedores.
export const VERTICAL_CATALOGS = {
  brewery: { title: 'Cervejaria', icon: 'cup', item: 'Rótulos', itemSing: 'rótulo' },
  bakery: { title: 'Padaria', icon: 'cup', item: 'Produtos', itemSing: 'produto' },
  floriculture: { title: 'Floricultura', icon: 'leaf', item: 'Arranjos', itemSing: 'arranjo' },
  beauty: { title: 'Beauty', icon: 'heart', item: 'Produtos', itemSing: 'produto' },
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function VerticalCatalogPanel({ vertical, notify }) {
  const cfg = VERTICAL_CATALOGS[vertical] || { title: 'Catálogo', icon: 'box', item: 'Itens', itemSing: 'item' }
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [p, s] = await Promise.all([
      supabase.from('products').select('*').contains('tags', [vertical]).order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setItems(p.data || []); setSuppliers(s.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [vertical])
  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  const saveItem = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('products').insert({ name: form.name, description: form.description, price: Number(form.price) || 0, stock: parseInt(form.stock) || 0, sku: form.sku, tags: [vertical], status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify(`${cfg.itemSing} criado`, 'success'); close(); loadAll()
  }
  const saveSupplier = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('suppliers').insert({ name: form.name, category: form.category, contact: form.contact, phone: form.phone, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Fornecedor criado', 'success'); close(); loadAll()
  }

  const addBtn = tab === 'items' ? () => open('item') : () => open('supplier')
  const addLabel = tab === 'items' ? `Novo ${cfg.itemSing}` : 'Novo fornecedor'
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name={cfg.icon} className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">{cfg.title}</h1><p className="text-admin-muted/60 text-sm mt-1">{items.length} {cfg.item.toLowerCase()} · {suppliers.length} fornecedores</p></div>
        <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['items', cfg.item], ['suppliers', 'Fornecedores']].map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'items' && (items.length === 0 ? <Empty t={`Nenhum ${cfg.itemSing} cadastrado`} /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map((p) => (
              <div key={p.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{p.name}</p><p className="text-admin-gold text-sm">{brl(p.price)}</p></div>
                <div className="flex justify-between mt-1"><span className="text-admin-muted/40 text-xs">{p.sku || '—'}</span><span className="text-admin-muted/40 text-xs">Estoque: {p.stock ?? 0}</span></div>
                {p.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{p.description}</p>}
              </div>
            ))}</div>
          ))}
          {tab === 'suppliers' && (suppliers.length === 0 ? <Empty t="Nenhum fornecedor" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{suppliers.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4"><p className="text-admin-text text-sm font-medium">{s.name}</p>{s.category && <p className="text-admin-champ/60 text-xs mt-0.5">{s.category}</p>}{(s.contact || s.phone) && <p className="text-admin-muted/40 text-xs mt-1">{[s.contact, s.phone].filter(Boolean).join(' · ')}</p>}</div>
            ))}</div>
          ))}
        </>
      )}

      {modal === 'item' && (
        <Modal title={`Novo ${cfg.itemSing}`} onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld><Fld label="Estoque"><input type="number" value={form.stock || ''} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="SKU"><input value={form.sku || ''} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveItem} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={close} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
      {modal === 'supplier' && (
        <Modal title="Novo fornecedor" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Contato"><input value={form.contact || ''} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} /></Fld><Fld label="Telefone"><input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></Fld></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveSupplier} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={close} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
