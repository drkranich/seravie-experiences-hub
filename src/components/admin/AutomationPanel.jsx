import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const TRIGGERS = { new_order: 'Nova venda', new_appointment: 'Novo agendamento', new_reservation: 'Nova reserva', new_subscription: 'Nova assinatura (clube)', new_customer: 'Novo cliente', low_stock: 'Estoque baixo', birthday: 'Aniversário do cliente', ticket_created: 'Novo chamado', checklist_done: 'Checklist concluído', nps_low: 'NPS baixo', daily: 'Diariamente' }
const ACTIONS = { send_message: 'Enviar mensagem', create_task: 'Criar tarefa', notify_team: 'Notificar equipe', apply_tag: 'Aplicar etiqueta', send_coupon: 'Enviar cupom', webhook: 'Chamar webhook' }
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

export function AutomationPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', trigger_type: 'new_order', actions: [] })

  const load = async () => { setLoading(true); const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false }); setItems(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', trigger_type: 'new_order', actions: [{ type: 'send_message', value: '' }] }); setModal(true) }
  const openEdit = (a) => { setEditing(a.id); setForm({ name: a.name, description: a.description || '', trigger_type: a.trigger_type || 'new_order', actions: Array.isArray(a.actions) ? a.actions : [] }); setModal(true) }

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type: 'send_message', value: '' }] }))
  const setAction = (i, patch) => setForm((f) => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, ...patch } : a) }))
  const removeAction = (i) => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))

  const save = async () => {
    if (!form.name.trim()) return notify('Nome obrigatório', 'error')
    const payload = { name: form.name, description: form.description, trigger_type: form.trigger_type, actions: form.actions.filter((a) => a.type), tenant_id: tenantId }
    const { error } = editing
      ? await supabase.from('automations').update(payload).eq('id', editing)
      : await supabase.from('automations').insert({ ...payload, is_active: true, created_by: profile?.user_id })
    if (error) return notify('Erro ao salvar', 'error')
    notify('Automação salva', 'success'); setModal(false); load()
  }
  const toggle = async (a) => { await supabase.from('automations').update({ is_active: !a.is_active }).eq('id', a.id); load() }
  const del = async (id) => { if (!confirm('Remover automação?')) return; await supabase.from('automations').delete().eq('id', id); load() }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Automation Studio</h1><p className="text-admin-muted/60 text-sm mt-1">Crie fluxos: quando algo acontece → execute ações, sem código</p></div>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo fluxo</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : items.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="spark" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm mb-4">Nenhum fluxo criado</p><button onClick={openNew} className="text-admin-champ text-sm hover:underline">Criar primeiro fluxo</button></div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="glass rounded-xl px-5 py-4 group">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-admin-text text-sm font-medium">{a.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                    <span className="text-admin-champ/70">Quando: {TRIGGERS[a.trigger_type] || a.trigger_type}</span>
                    <Icon name="external" className="w-3 h-3 text-admin-muted/30" />
                    <span className="text-admin-muted/50">{(a.actions || []).length} ação(ões)</span>
                    {a.run_count > 0 && <span className="text-admin-muted/30">· {a.run_count} execuções</span>}
                  </div>
                  {(a.actions || []).length > 0 && <p className="text-admin-muted/40 text-xs mt-1.5 truncate">→ {(a.actions || []).map((x) => ACTIONS[x.type] || x.type).join(' · ')}</p>}
                </div>
                <button onClick={() => toggle(a)} className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors shrink-0 ${a.is_active ? 'bg-admin-sage/10 text-admin-sage hover:bg-admin-rose/10 hover:text-admin-rose' : 'bg-white/[0.04] text-admin-muted/40 hover:bg-admin-sage/10 hover:text-admin-sage'}`}>{a.is_active ? 'ativo' : 'inativo'}</button>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(a)} className="p-1.5 text-admin-muted hover:text-admin-champ rounded-lg hover:bg-white/[0.05]"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(a.id)} className="p-1.5 text-admin-muted hover:text-admin-rose rounded-lg hover:bg-white/[0.05]"><Icon name="x" className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar fluxo' : 'Novo fluxo'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Boas-vindas ao novo cliente" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Gatilho — quando acontecer</label><GlassSelect value={form.trigger_type} onChange={(v) => setForm((f) => ({ ...f, trigger_type: v }))} options={Object.entries(TRIGGERS).map(([value, label]) => ({ value, label }))} /></div>

              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60">Ações — o que executar</label><button onClick={addAction} className="text-admin-champ text-xs hover:underline">+ ação</button></div>
                <div className="space-y-2">
                  {form.actions.map((a, i) => (
                    <div key={i} className="glass-soft rounded-xl p-2.5 flex items-center gap-2">
                      <span className="text-admin-champ/50 text-xs w-5 text-center shrink-0">{i + 1}</span>
                      <div className="w-40 shrink-0"><GlassSelect value={a.type} onChange={(v) => setAction(i, { type: v })} options={Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))} /></div>
                      <input value={a.value || ''} onChange={(e) => setAction(i, { value: e.target.value })} placeholder="detalhe (mensagem, tarefa, etiqueta…)" className="flex-1 glass-input rounded-lg px-3 py-2 text-sm text-admin-text outline-none" />
                      <button onClick={() => removeAction(i)} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {form.actions.length === 0 && <p className="text-admin-muted/30 text-xs">Adicione ao menos uma ação.</p>}
                </div>
              </div>

              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Criar fluxo'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
