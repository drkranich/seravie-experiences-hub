import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const SEASONS = { year_round: 'Ano todo', easter: 'Páscoa', christmas: 'Natal', mothers_day: 'Dia das Mães', fathers_day: 'Dia dos Pais', valentines: 'Namorados', childrens: 'Dia das Crianças' }
const OCCASIONS = { none: 'Sem ocasião', birthday: 'Aniversário', wedding: 'Casamento', corporate: 'Corporativo', christmas: 'Natal', easter: 'Páscoa', valentines: 'Namorados', mothers_day: 'Dia das Mães' }
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const TABS = [['lines', 'Linhas'], ['kits', 'Kits'], ['gifts', 'Presentes'], ['seasonal', 'Sazonalidade']]

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[92vh] overflow-y-auto">
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

export function ChocolatePanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('lines')
  const [lines, setLines] = useState([])
  const [kits, setKits] = useState([])
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const loadAll = async () => {
    setLoading(true)
    const [l, k, g] = await Promise.all([
      supabase.from('chocolate_lines').select('*').order('sort_order'),
      supabase.from('chocolate_kits').select('*').order('created_at', { ascending: false }),
      supabase.from('gift_items').select('*').order('name'),
    ])
    setLines(l.data || []); setKits(k.data || []); setGifts(g.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  const open = (m, init = {}) => { setForm(init); setModal(m) }
  const close = () => { setModal(null); setForm({}) }
  const lineName = (id) => lines.find((l) => l.id === id)?.name || '—'

  const saveLine = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('chocolate_lines').insert({ name: form.name, description: form.description, season: form.season || 'year_round', is_active: form.is_active !== false, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Linha criada', 'success'); close(); loadAll()
  }
  const saveKit = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('chocolate_kits').insert({ name: form.name, description: form.description, line_id: form.line_id || null, price: Number(form.price) || 0, occasion: form.occasion || 'none', is_corporate: !!form.is_corporate, is_customizable: !!form.is_customizable, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Kit criado', 'success'); close(); loadAll()
  }
  const saveGift = async () => {
    if (!form.name?.trim()) return notify('Nome obrigatório', 'error')
    const { error } = await supabase.from('gift_items').insert({ name: form.name, description: form.description, price: Number(form.price) || 0, occasion: form.occasion || 'none', category: form.category, is_personalizable: !!form.is_personalizable, status: 'active', tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error'); notify('Presente criado', 'success'); close(); loadAll()
  }

  const addBtn = { lines: () => open('line', { season: 'year_round', is_active: true }), kits: () => open('kit', { occasion: 'none' }), gifts: () => open('gift', { occasion: 'none' }), seasonal: null }[tab]
  const addLabel = { lines: 'Nova linha', kits: 'Novo kit', gifts: 'Novo presente' }[tab]
  const Empty = ({ t }) => <div className="glass rounded-2xl p-12 text-center"><Icon name="gift" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{t}</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Chocolateria</h1><p className="text-admin-muted/60 text-sm mt-1">{lines.length} linhas · {kits.length} kits · {gifts.length} presentes</p></div>
        {addBtn && <button onClick={addBtn} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />{addLabel}</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'lines' && (lines.length === 0 ? <Empty t="Nenhuma linha criada" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{lines.map((l) => (
              <div key={l.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{l.name}</p>{!l.is_active && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-admin-muted/40">inativa</span>}</div>
                <p className="text-admin-champ/60 text-xs">{SEASONS[l.season] || 'Ano todo'}</p>
                {l.description && <p className="text-admin-muted/40 text-xs mt-1 line-clamp-2">{l.description}</p>}
              </div>
            ))}</div>
          ))}

          {tab === 'kits' && (kits.length === 0 ? <Empty t="Nenhum kit criado" /> : (
            <div className="space-y-2">{kits.map((k) => (
              <div key={k.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{k.name}</p><div className="flex gap-3 mt-0.5">{k.line_id && <span className="text-admin-muted/40 text-xs">{lineName(k.line_id)}</span>}<span className="text-admin-muted/40 text-xs">{OCCASIONS[k.occasion] || k.occasion}</span>{k.is_corporate && <span className="text-admin-gold text-xs">Corporativo</span>}{k.is_customizable && <span className="text-admin-champ/60 text-xs">Personalizável</span>}</div></div>
                <p className="text-admin-gold text-sm shrink-0">{brl(k.price)}</p>
              </div>
            ))}</div>
          ))}

          {tab === 'gifts' && (gifts.length === 0 ? <Empty t="Nenhum presente cadastrado" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{gifts.map((g) => (
              <div key={g.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-1"><p className="text-admin-text text-sm font-medium">{g.name}</p><p className="text-admin-gold text-sm">{brl(g.price)}</p></div>
                <div className="flex gap-2 mt-1">{g.category && <span className="text-admin-muted/40 text-xs">{g.category}</span>}<span className="text-admin-champ/60 text-xs">{OCCASIONS[g.occasion] || g.occasion}</span>{g.is_personalizable && <span className="text-admin-champ/60 text-xs">· Personalizável</span>}</div>
              </div>
            ))}</div>
          ))}

          {tab === 'seasonal' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(SEASONS).filter(([k]) => k !== 'year_round').map(([key, label]) => {
                const ls = lines.filter((l) => l.season === key)
                const ks = kits.filter((k) => k.occasion === key)
                return (
                  <div key={key} className="glass rounded-2xl p-5">
                    <p className="font-serif text-xl text-admin-text mb-1">{label}</p>
                    <p className="text-admin-muted/50 text-xs mb-3">{ls.length} linhas · {ks.length} kits</p>
                    <div className="space-y-1">{ls.slice(0, 4).map((l) => <p key={l.id} className="text-admin-champ/70 text-xs">• {l.name}</p>)}{ls.length === 0 && <p className="text-admin-muted/30 text-xs">Sem linhas sazonais</p>}</div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {modal === 'line' && (
        <Modal title="Nova linha" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Coleção Trufas" /></Fld>
            <Fld label="Sazonalidade"><GlassSelect value={form.season} onChange={(v) => setForm((f) => ({ ...f, season: v }))} options={Object.entries(SEASONS).map(([value, label]) => ({ value, label }))} /></Fld>
            <Fld label="Descrição"><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Fld>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Linha ativa</span></label>
          </div>
          <Actions onSave={saveLine} onClose={close} label="Criar linha" />
        </Modal>
      )}

      {modal === 'kit' && (
        <Modal title="Novo kit" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Linha"><GlassSelect value={form.line_id || ''} onChange={(v) => setForm((f) => ({ ...f, line_id: v }))} options={[{ value: '', label: 'Sem linha' }, ...lines.map((l) => ({ value: l.id, label: l.name }))]} /></Fld><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Ocasião"><GlassSelect value={form.occasion} onChange={(v) => setForm((f) => ({ ...f, occasion: v }))} options={Object.entries(OCCASIONS).map(([value, label]) => ({ value, label }))} /></Fld>
            <div className="flex gap-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.is_corporate} onChange={(e) => setForm((f) => ({ ...f, is_corporate: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Corporativo</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.is_customizable} onChange={(e) => setForm((f) => ({ ...f, is_customizable: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Personalizável</span></label></div>
          </div>
          <Actions onSave={saveKit} onClose={close} label="Criar kit" />
        </Modal>
      )}

      {modal === 'gift' && (
        <Modal title="Novo presente" onClose={close}>
          <div className="space-y-4">
            <Fld label="Nome *"><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></Fld>
            <div className="grid grid-cols-2 gap-3"><Fld label="Categoria"><input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="Ex: Cesta" /></Fld><Fld label="Preço (R$)"><input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} /></Fld></div>
            <Fld label="Ocasião"><GlassSelect value={form.occasion} onChange={(v) => setForm((f) => ({ ...f, occasion: v }))} options={Object.entries(OCCASIONS).map(([value, label]) => ({ value, label }))} /></Fld>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!!form.is_personalizable} onChange={(e) => setForm((f) => ({ ...f, is_personalizable: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Personalizável</span></label>
          </div>
          <Actions onSave={saveGift} onClose={close} label="Criar presente" />
        </Modal>
      )}
    </div>
  )
}
