import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const CATEGORIES = { bebida: 'Bebida', grao: 'Grão', metodo: 'Método', doce: 'Doçaria' }
const TABS = [['menu', 'Cardápio'], ['workshops', 'Workshops'], ['suppliers', 'Fornecedores']]

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

export function CoffeePanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('menu')
  const [menu, setMenu] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [m, w, s] = await Promise.all([
      supabase.from('coffee_menu').select('*').order('name'),
      supabase.from('events').select('*').eq('type', 'workshop').order('event_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setMenu(m.data || []); setWorkshops(w.data || []); setSuppliers(s.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])
  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }

  const saveMenu = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('coffee_menu').insert({ name: form.name, description: form.description, method: form.method, origin: form.origin, price: Number(form.price) || 0, category: form.category || 'bebida', is_active: form.is_active !== false, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Item criado', 'success'); close(); loadAll()
  }
  const saveWorkshop = async () => {
    if (!form.title?.trim()) return notify('Título obrigatório', 'error')
    const { error } = await supabase.from('events').insert({ title: form.title, type: 'workshop', event_date: form.event_date || null, guest_count: form.guest_count ? parseInt(form.guest_count) : null, status: 'confirmed', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Workshop criado', 'success'); close(); loadAll()
  }
  const saveSupplier = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('suppliers').insert({ name: form.name, category: form.category, contact: form.contact, phone: form.phone, email: form.email, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Fornecedor criado', 'success'); close(); loadAll()
  }

  const addBtn = { menu: () => open('menu', { category: 'bebida', is_active: true }), workshops: () => open('workshop'), suppliers: () => open('supplier') }[tab]
  const addLabel = { menu: 'Novo item', workshops: 'Novo workshop', suppliers: 'Novo fornecedor' }[tab]
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name="cup" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Cafeteria</h1><p className="text-admin-muted/60 text-sm mt-1">{menu.length} itens no cardápio · {workshops.length} workshops</p></div>
        {addBtn && <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'menu' && (menu.length === 0 ? <Empty t="Cardápio vazio" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{menu.map((m) => (
              <div key={m.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{m.name}</p><p className="text-admin-gold text-sm">{brl(m.price)}</p></div>
                <div className="flex gap-2 mt-1 flex-wrap"><span className="text-admin-champ/60 text-xs">{CATEGORIES[m.category] || m.category}</span>{m.method && <span className="text-admin-muted/40 text-xs">{m.method}</span>}{m.origin && <span className="text-admin-muted/40 text-xs">· {m.origin}</span>}</div>
                {m.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{m.description}</p>}
              </div>
            ))}</div>
          ))}

          {tab === 'workshops' && (workshops.length === 0 ? <Empty t="Nenhum workshop" /> : (
            <div className="space-y-2">{workshops.map((w) => (
              <div key={w.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{w.title}</p><div className="flex gap-3 mt-0.5">{w.event_date && <span className="text-admin-muted/40 text-xs">{new Date(w.event_date).toLocaleDateString('pt-BR')}</span>}{w.guest_count && <span className="text-admin-muted/40 text-xs">{w.guest_count} vagas</span>}</div></div>
              </div>
            ))}</div>
          ))}

          {tab === 'suppliers' && (suppliers.length === 0 ? <Empty t="Nenhum fornecedor" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{suppliers.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4">
                <p className="text-admin-text text-sm font-medium">{s.name}</p>
                {s.category && <p className="text-admin-champ/60 text-xs mt-0.5">{s.category}</p>}
                {(s.contact || s.phone) && <p className="text-admin-muted/40 text-xs mt-1">{[s.contact, s.phone].filter(Boolean).join(' · ')}</p>}
              </div>
            ))}</div>
          ))}
        </>
      )}

      {modal === 'menu' && (
        <Modal title="Novo item do cardápio" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Espresso Duplo" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Categoria"><GlassSelect value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} /></Fld><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Método"><input value={form.method || ''} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className={inputCls} placeholder="Ex: Hario V60" /></Fld><Fld label="Origem"><input value={form.origin || ''} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} className={inputCls} placeholder="Ex: Cerrado MG" /></Fld></div>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
          </div>
          <Actions onSave={saveMenu} onClose={close} label="Criar item" />
        </Modal>
      )}

      {modal === 'workshop' && (
        <Modal title="Novo workshop" onClose={close}>
          <div className="space-y-4">
            <Fld label="Título *"><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Ex: Introdução ao Barismo" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Data"><GlassDate value={form.event_date || ''} onChange={(v) => setForm((f) => ({ ...f, event_date: v }))} /></Fld><Fld label="Vagas"><input type="number" value={form.guest_count || ''} onChange={(e) => setForm((f) => ({ ...f, guest_count: e.target.value }))} className={inputCls} /></Fld></div>
          </div>
          <Actions onSave={saveWorkshop} onClose={close} label="Criar workshop" />
        </Modal>
      )}

      {modal === 'supplier' && (
        <Modal title="Novo fornecedor" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="Ex: Torrefação, Laticínios" /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Contato"><input value={form.contact || ''} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} /></Fld><Fld label="Telefone"><input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} /></Fld></div>
          </div>
          <Actions onSave={saveSupplier} onClose={close} label="Criar fornecedor" />
        </Modal>
      )}
    </div>
  )
}
