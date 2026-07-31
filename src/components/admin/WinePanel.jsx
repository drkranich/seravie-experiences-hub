import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const WINE_TYPES = { tinto: 'Tinto', branco: 'Branco', rose: 'Rosé', espumante: 'Espumante', sobremesa: 'Sobremesa', fortificado: 'Fortificado' }
const TABS = [['labels', 'Rótulos'], ['pairings', 'Harmonizações'], ['suppliers', 'Fornecedores']]

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[88vh] overflow-y-auto">
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

export function WinePanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('labels')
  const [labels, setLabels] = useState([])
  const [pairings, setPairings] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [l, p, s] = await Promise.all([
      supabase.from('wine_labels').select('*').order('name'),
      supabase.from('pairings').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setLabels(l.data || []); setPairings(p.data || []); setSuppliers(s.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])
  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  const saveLabel = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('wine_labels').insert({ name: form.name, producer: form.producer, region: form.region, country: form.country, vintage: form.vintage ? parseInt(form.vintage) : null, grape: form.grape, type: form.type || 'tinto', price: Number(form.price) || 0, stock: parseInt(form.stock) || 0, tasting_notes: form.tasting_notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Rótulo criado', 'success'); close(); loadAll()
  }
  const savePairing = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('pairings').insert({ title: form.title, item_a: form.item_a, item_b: form.item_b, notes: form.notes, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Harmonização criada', 'success'); close(); loadAll()
  }
  const saveSupplier = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('suppliers').insert({ name: form.name, category: form.category, contact: form.contact, phone: form.phone, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Fornecedor criado', 'success'); close(); loadAll()
  }

  const addBtn = { labels: () => open('label', { type: 'tinto' }), pairings: () => open('pairing'), suppliers: () => open('supplier') }[tab]
  const addLabel = { labels: 'Novo rótulo', pairings: 'Nova harmonização', suppliers: 'Novo fornecedor' }[tab]
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name="wine" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Vinhos</h1><p className="text-admin-muted/60 text-sm mt-1">{labels.length} rótulos na adega</p></div>
        {addBtn && <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>}
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'labels' && (labels.length === 0 ? <Empty t="Nenhum rótulo na adega" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{labels.map((l) => (
              <div key={l.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{l.name}{l.vintage ? ` ${l.vintage}` : ''}</p><p className="text-admin-gold text-sm">{brl(l.price)}</p></div>
                <div className="flex gap-2 flex-wrap mt-1"><span className="text-admin-champ/60 text-xs">{WINE_TYPES[l.type] || l.type}</span>{l.grape && <span className="text-admin-muted/40 text-xs">{l.grape}</span>}</div>
                {(l.producer || l.region) && <p className="text-admin-muted/40 text-xs mt-1">{[l.producer, l.region, l.country].filter(Boolean).join(' · ')}</p>}
                <p className="text-admin-muted/30 text-[10px] mt-1">Estoque: {l.stock ?? 0}</p>
              </div>
            ))}</div>
          ))}
          {tab === 'pairings' && (pairings.length === 0 ? <Empty t="Nenhuma harmonização" /> : (
            <div className="space-y-2">{pairings.map((p) => (
              <div key={p.id} className="glass rounded-xl px-5 py-3.5"><p className="text-admin-text text-sm font-medium">{p.title}</p>{(p.item_a || p.item_b) && <p className="text-admin-champ/60 text-xs mt-0.5">{p.item_a}{p.item_b ? ` + ${p.item_b}` : ''}</p>}{p.notes && <p className="text-admin-muted/40 text-xs mt-1">{p.notes}</p>}</div>
            ))}</div>
          ))}
          {tab === 'suppliers' && (suppliers.length === 0 ? <Empty t="Nenhum fornecedor" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{suppliers.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4"><p className="text-admin-text text-sm font-medium">{s.name}</p>{s.category && <p className="text-admin-champ/60 text-xs mt-0.5">{s.category}</p>}{(s.contact || s.phone) && <p className="text-admin-muted/40 text-xs mt-1">{[s.contact, s.phone].filter(Boolean).join(' · ')}</p>}</div>
            ))}</div>
          ))}
        </>
      )}

      {modal === 'label' && (
        <Modal title="Novo rótulo" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={Object.entries(WINE_TYPES).map(([value, label]) => ({ value, label }))} /></Fld><Fld label="Safra"><input type="number" value={form.vintage || ''} onChange={(e) => setForm((f) => ({ ...f, vintage: e.target.value }))} className={inputCls} placeholder="2020" /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Uva"><input value={form.grape || ''} onChange={(e) => setForm((f) => ({ ...f, grape: e.target.value }))} className={inputCls} placeholder="Malbec" /></Fld><Fld label="Produtor"><input value={form.producer || ''} onChange={(e) => setForm((f) => ({ ...f, producer: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Região"><input value={form.region || ''} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className={inputCls} /></Fld><Fld label="País"><input value={form.country || ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld><Fld label="Estoque"><input type="number" value={form.stock || ''} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Notas de degustação"><textarea value={form.tasting_notes || ''} onChange={(e) => setForm((f) => ({ ...f, tasting_notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <Actions onSave={saveLabel} onClose={close} label="Criar rótulo" />
        </Modal>
      )}
      {modal === 'pairing' && (
        <Modal title="Nova harmonização" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Malbec & Cordeiro" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Vinho"><input value={form.item_a || ''} onChange={(e) => setForm((f) => ({ ...f, item_a: e.target.value }))} className={inputCls} /></Fld><Fld label="Prato"><input value={form.item_b || ''} onChange={(e) => setForm((f) => ({ ...f, item_b: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Notas"><textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <Actions onSave={savePairing} onClose={close} label="Criar" />
        </Modal>
      )}
      {modal === 'supplier' && (
        <Modal title="Novo fornecedor" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="Importadora" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Contato"><input value={form.contact || ''} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} /></Fld><Fld label="Telefone"><input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></Fld></div>
          </div>
          <Actions onSave={saveSupplier} onClose={close} label="Criar fornecedor" />
        </Modal>
      )}
    </div>
  )
}
