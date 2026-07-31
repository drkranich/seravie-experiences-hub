import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const OCCASIONS = { none: 'Sem ocasião', birthday: 'Aniversário', wedding: 'Casamento', corporate: 'Corporativo', christmas: 'Natal', valentines: 'Namorados', mothers_day: 'Dia das Mães', fathers_day: 'Dia dos Pais' }

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

export function GiftPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [occ, setOcc] = useState('')

  const load = async () => { setLoading(true); const { data } = await supabase.from('gift_items').select('*').order('name'); setGifts(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('gift_items').insert({ name: form.name, description: form.description, price: Number(form.price) || 0, occasion: form.occasion || 'none', category: form.category, is_personalizable: !!form.is_personalizable, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Presente criado', 'success'); setModal(false); setForm({}); load()
  }
  const shown = occ ? gifts.filter((g) => g.occasion === occ) : gifts

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Presentes</h1><p className="text-admin-muted/60 text-sm mt-1">{gifts.length} itens no catálogo de presentes</p></div>
        <button onClick={() => { setForm({ occasion: 'none' }); setModal(true) }} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="gift" className="w-4 h-4" />Novo presente</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setOcc('')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${!occ ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todas ocasiões</button>
        {Object.entries(OCCASIONS).filter(([k]) => k !== 'none').map(([k, v]) => (
          <button key={k} onClick={() => setOcc(k)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${occ === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : shown.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="gift" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum presente</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{shown.map((g) => (
          <div key={g.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{g.name}</p><p className="text-admin-gold text-sm">{brl(g.price)}</p></div>
            <div className="flex gap-2 mt-1 flex-wrap">{g.category && <span className="text-admin-muted/40 text-xs">{g.category}</span>}<span className="text-admin-champ/60 text-xs">{OCCASIONS[g.occasion] || g.occasion}</span>{g.is_personalizable && <span className="text-admin-champ/60 text-xs">· Personalizável</span>}</div>
            {g.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{g.description}</p>}
          </div>
        ))}</div>
      )}

      {modal && (
        <Modal title="Novo presente" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="Ex: Cesta, Kit" /></Fld><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Ocasião"><GlassSelect value={form.occasion} onChange={(v) => setForm((f) => ({ ...f, occasion: v }))} options={Object.entries(OCCASIONS).map(([value, label]) => ({ value, label }))} /></Fld>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!!form.is_personalizable} onChange={(e) => setForm((f) => ({ ...f, is_personalizable: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Personalizável</span></label>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar presente</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
