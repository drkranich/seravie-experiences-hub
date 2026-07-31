import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const OCCASIONS = { none: 'Sem ocasião', corporate: 'Corporativo', christmas: 'Natal', birthday: 'Aniversário', wedding: 'Casamento', valentines: 'Namorados' }
const TABS = [['products', 'Produtos'], ['hampers', 'Cestas & Kits'], ['pairings', 'Harmonizações'], ['suppliers', 'Fornecedores']]

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
const Actions = ({ onSave, onClose, label }) => (
  <div className="flex gap-3 mt-6"><button onClick={onSave} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{label}</button><button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button></div>
)

export function EmporioPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [hampers, setHampers] = useState([])
  const [pairings, setPairings] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [p, h, pa, s] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('hampers').select('*').order('created_at', { ascending: false }),
      supabase.from('pairings').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setProducts(p.data || []); setHampers(h.data || []); setPairings(pa.data || []); setSuppliers(s.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])
  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  const saveProduct = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('products').insert({ name: form.name, price: Number(form.price) || 0, stock: parseInt(form.stock) || 0, sku: form.sku, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Produto criado', 'success'); close(); loadAll()
  }
  const saveHamper = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('hampers').insert({ name: form.name, type: form.type || 'cesta', description: form.description, price: Number(form.price) || 0, occasion: form.occasion || 'none', status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Item criado', 'success'); close(); loadAll()
  }
  const savePairing = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('pairings').insert({ title: form.title, item_a: form.item_a, item_b: form.item_b, notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Harmonização criada', 'success'); close(); loadAll()
  }
  const saveSupplier = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('suppliers').insert({ name: form.name, category: form.category, contact: form.contact, phone: form.phone, email: form.email, notes: form.notes, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Fornecedor criado', 'success'); close(); loadAll()
  }

  const addBtn = { products: () => open('product'), hampers: () => open('hamper', { type: 'cesta', occasion: 'none' }), pairings: () => open('pairing'), suppliers: () => open('supplier') }[tab]
  const addLabel = { products: 'Novo produto', hampers: 'Nova cesta/kit', pairings: 'Nova harmonização', suppliers: 'Novo fornecedor' }[tab]
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name="cup" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Empório Gourmet</h1><p className="text-admin-muted/60 text-sm mt-1">{products.length} produtos · {hampers.length} cestas · {suppliers.length} fornecedores</p></div>
        {addBtn && <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'products' && (products.length === 0 ? <Empty t="Nenhum produto. Cadastre aqui ou no Catálogo." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{products.map((p) => (
              <div key={p.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{p.name}</p><p className="text-admin-gold text-sm">{brl(p.price)}</p></div>
                <div className="flex justify-between mt-1"><span className="text-admin-muted/40 text-xs">{p.sku || '—'}</span><span className="text-admin-muted/40 text-xs">Estoque: {p.stock ?? 0}</span></div>
              </div>
            ))}</div>
          ))}

          {tab === 'hampers' && (hampers.length === 0 ? <Empty t="Nenhuma cesta ou kit" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{hampers.map((h) => (
              <div key={h.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{h.name}</p><p className="text-admin-gold text-sm">{brl(h.price)}</p></div>
                <div className="flex gap-2 mt-1"><span className="text-admin-champ/60 text-xs capitalize">{h.type}</span><span className="text-admin-muted/40 text-xs">{OCCASIONS[h.occasion] || h.occasion}</span></div>
                {h.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{h.description}</p>}
              </div>
            ))}</div>
          ))}

          {tab === 'pairings' && (pairings.length === 0 ? <Empty t="Nenhuma harmonização" /> : (
            <div className="space-y-2">{pairings.map((p) => (
              <div key={p.id} className="glass rounded-xl px-5 py-3.5">
                <p className="text-admin-text text-sm font-medium">{p.title}</p>
                {(p.item_a || p.item_b) && <p className="text-admin-champ/60 text-xs mt-0.5">{p.item_a} {p.item_b ? `+ ${p.item_b}` : ''}</p>}
                {p.notes && <p className="text-admin-muted/40 text-xs mt-1">{p.notes}</p>}
              </div>
            ))}</div>
          ))}

          {tab === 'suppliers' && (suppliers.length === 0 ? <Empty t="Nenhum fornecedor" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{suppliers.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4">
                <p className="text-admin-text text-sm font-medium">{s.name}</p>
                {s.category && <p className="text-admin-champ/60 text-xs mt-0.5">{s.category}</p>}
                {(s.contact || s.phone) && <p className="text-admin-muted/40 text-xs mt-1">{[s.contact, s.phone].filter(Boolean).join(' · ')}</p>}
                {s.email && <p className="text-admin-muted/40 text-xs">{s.email}</p>}
              </div>
            ))}</div>
          ))}
        </>
      )}

      {modal === 'product' && (
        <Modal title="Novo produto" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld><Fld label="Estoque"><input type="number" value={form.stock || ''} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="SKU"><input value={form.sku || ''} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className={inputCls} /></Fld>
          </div>
          <Actions onSave={saveProduct} onClose={close} label="Criar produto" />
        </Modal>
      )}

      {modal === 'hamper' && (
        <Modal title="Nova cesta / kit" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Cesta Café da Manhã" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'cesta', label: 'Cesta' }, { value: 'kit', label: 'Kit' }]} /></Fld><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Ocasião"><GlassSelect value={form.occasion} onChange={(v) => setForm((f) => ({ ...f, occasion: v }))} options={Object.entries(OCCASIONS).map(([value, label]) => ({ value, label }))} /></Fld>
            <Fld label="Descrição / itens"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <Actions onSave={saveHamper} onClose={close} label="Criar" />
        </Modal>
      )}

      {modal === 'pairing' && (
        <Modal title="Nova harmonização" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Queijo & Vinho" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Item A"><input value={form.item_a || ''} onChange={(e) => setForm((f) => ({ ...f, item_a: e.target.value }))} className={inputCls} /></Fld><Fld label="Item B"><input value={form.item_b || ''} onChange={(e) => setForm((f) => ({ ...f, item_b: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Notas"><textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <Actions onSave={savePairing} onClose={close} label="Criar harmonização" />
        </Modal>
      )}

      {modal === 'supplier' && (
        <Modal title="Novo fornecedor" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="Ex: Queijos, Vinhos" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Contato"><input value={form.contact || ''} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} /></Fld><Fld label="Telefone"><input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="E-mail"><input value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} /></Fld>
          </div>
          <Actions onSave={saveSupplier} onClose={close} label="Criar fornecedor" />
        </Modal>
      )}
    </div>
  )
}
