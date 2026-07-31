import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const CATEGORY_LABELS = { opening:'Abertura', closing:'Fechamento', daily:'Diário', weekly:'Semanal', monthly:'Mensal', custom:'Personalizado' }

export function OperationsPanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('checklists')
  const [checklists, setChecklists] = useState([])
  const [incidents, setIncidents] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'daily', description: '' })
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', type: 'operational', severity: 'medium' })
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')

  const loadChecklists = async () => {
    setLoading(true)
    const { data } = await supabase.from('checklists').select('*').order('sort_order')
    setChecklists(data || [])
    setLoading(false)
  }

  const loadIncidents = async () => {
    setLoading(true)
    const { data } = await supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(50)
    setIncidents(data || [])
    setLoading(false)
  }

  const loadEquipment = async () => {
    setLoading(true)
    const { data } = await supabase.from('equipment').select('*').order('name')
    setEquipment(data || [])
    setLoading(false)
  }

  const loadItems = async (checklistId) => {
    const { data } = await supabase.from('checklist_items').select('*').eq('checklist_id', checklistId).order('sort_order')
    setItems(data || [])
  }

  useEffect(() => {
    if (tab === 'checklists') loadChecklists()
    else if (tab === 'incidents') loadIncidents()
    else if (tab === 'equipment') loadEquipment()
  }, [tab])

  useEffect(() => { if (selected) loadItems(selected.id) }, [selected])

  const saveChecklist = async () => {
    if (!form.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('checklists').insert({ ...form, tenant_id: profile?.tenant_id, created_by: profile?.user_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Checklist criado', 'success'); setShowForm(false); setForm({ title: '', category: 'daily', description: '' }); loadChecklists()
  }

  const addItem = async () => {
    if (!newItem.trim() || !selected) return
    const { data: existing } = await supabase.from('checklist_items').select('sort_order').eq('checklist_id', selected.id).order('sort_order', { ascending: false }).limit(1)
    const nextOrder = (existing?.[0]?.sort_order || 0) + 1
    await supabase.from('checklist_items').insert({ tenant_id: profile?.tenant_id, checklist_id: selected.id, title: newItem.trim(), sort_order: nextOrder })
    setNewItem(''); loadItems(selected.id)
  }

  const removeItem = async (id) => {
    await supabase.from('checklist_items').delete().eq('id', id)
    loadItems(selected.id)
  }

  const removeChecklist = async (id) => {
    if (!confirm('Remover checklist?')) return
    await supabase.from('checklists').delete().eq('id', id)
    notify('Removido', 'success'); setSelected(null); loadChecklists()
  }

  const saveIncident = async () => {
    if (!incidentForm.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('incidents').insert({ ...incidentForm, tenant_id: profile?.tenant_id, reported_by: profile?.user_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Ocorrência registrada', 'success'); setShowIncidentForm(false); setIncidentForm({ title: '', description: '', type: 'operational', severity: 'medium' }); loadIncidents()
  }

  const SEV_COLORS = { low:'text-admin-muted/50', medium:'text-admin-gold', high:'text-admin-rose', critical:'text-red-400' }
  const STATUS_COLORS = { open:'text-admin-rose', investigating:'text-admin-gold', resolved:'text-admin-sage', closed:'text-admin-muted/40' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Operações</h1>
          <p className="text-admin-muted/60 text-sm mt-1">Checklists, ocorrências e equipamentos</p>
        </div>
        <div className="flex gap-2">
          {tab === 'checklists' && <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo checklist</button>}
          {tab === 'incidents' && <button onClick={() => setShowIncidentForm(true)} className="flex items-center gap-2 bg-admin-rose/10 hover:bg-admin-rose/20 text-admin-rose px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Registrar ocorrência</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['checklists','Checklists'],['incidents','Ocorrências'],['equipment','Equipamentos']].map(([k,v]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            {v}
          </button>
        ))}
      </div>

      {/* CHECKLISTS */}
      {tab === 'checklists' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
              : checklists.length === 0
                ? <div className="glass rounded-2xl p-10 text-center"><Icon name="check" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum checklist</p></div>
                : <div className="space-y-2">
                    {checklists.map(c => (
                      <button key={c.id} onClick={() => setSelected(c)}
                        className={`w-full text-left glass rounded-xl px-4 py-3.5 transition-colors hover:bg-white/[0.04] group ${selected?.id === c.id ? 'border-admin-champ/30' : ''}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-admin-text text-sm font-medium">{c.title}</p>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); removeChecklist(c.id) }} className="p-1 text-admin-muted hover:text-admin-rose transition-colors"><Icon name="x" className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-admin-muted/40 text-xs mt-1">{CATEGORY_LABELS[c.category]} {c.description ? '· ' + c.description : ''}</p>
                      </button>
                    ))}
                  </div>
            }
          </div>
          {selected && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-serif text-xl text-admin-text mb-4">{selected.title}</h3>
              <div className="space-y-2 mb-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] group">
                    <Icon name="check" className="w-4 h-4 text-admin-champ/40 shrink-0" />
                    <span className="flex-1 text-admin-text text-sm">{item.title}</span>
                    <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-admin-muted hover:text-admin-rose transition-all"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-admin-muted/30 text-xs text-center py-3">Adicione itens abaixo</p>}
              </div>
              <div className="flex gap-2">
                <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()}
                  placeholder="Novo item…" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
                <button onClick={addItem} className="px-3 py-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ rounded-xl transition-colors"><Icon name="spark" className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCORRÊNCIAS */}
      {tab === 'incidents' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : incidents.length === 0
              ? <div className="glass rounded-2xl p-10 text-center"><Icon name="spark" className="w-10 h-10 text-admin-sage/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma ocorrência</p></div>
              : incidents.map(inc => (
                <div key={inc.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-admin-text text-sm font-medium truncate">{inc.title}</p>
                      <span className={`text-[10px] font-medium ${SEV_COLORS[inc.severity]}`}>{inc.severity?.toUpperCase()}</span>
                    </div>
                    <p className="text-admin-muted/40 text-xs">{inc.type} · <span className={STATUS_COLORS[inc.status]}>{inc.status}</span></p>
                  </div>
                  <p className="text-admin-muted/30 text-[10px] shrink-0">{new Date(inc.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))
          }
        </div>
      )}

      {/* EQUIPAMENTOS */}
      {tab === 'equipment' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p>
            : equipment.length === 0
              ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhum equipamento cadastrado</p></div>
              : equipment.map(eq => (
                <div key={eq.id} className="glass rounded-xl p-4">
                  <p className="text-admin-text text-sm font-medium mb-1">{eq.name}</p>
                  {eq.model && <p className="text-admin-muted/50 text-xs mb-2">{eq.model}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg ${eq.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : eq.status === 'maintenance' ? 'bg-admin-gold/10 text-admin-gold' : 'bg-white/[0.04] text-admin-muted/40'}`}>{eq.status}</span>
                    {eq.next_maintenance && <p className="text-[10px] text-admin-muted/40">Manutenção: {new Date(eq.next_maintenance).toLocaleDateString('pt-BR')}</p>}
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* Modal checklist */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo checklist</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Abertura da loja" />
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                  {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveChecklist} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ocorrência */}
      {showIncidentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Nova ocorrência</h2>
              <button onClick={() => setShowIncidentForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="O que aconteceu?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                  <select value={incidentForm.type} onChange={e => setIncidentForm(f => ({ ...f, type: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    {['operational','security','maintenance','quality','customer','other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Severidade</label>
                  <select value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label>
                <textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveIncident} className="flex-1 bg-admin-rose/10 hover:bg-admin-rose/20 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">Registrar</button>
              <button onClick={() => setShowIncidentForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
