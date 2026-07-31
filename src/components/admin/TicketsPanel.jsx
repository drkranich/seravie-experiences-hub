import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const PRIORITY_COLORS = { low:'text-admin-muted/50', normal:'text-admin-sage', high:'text-admin-gold', urgent:'text-admin-rose', critical:'text-red-400' }
const STATUS_LABELS = { open:'Aberto', pending:'Pendente', in_progress:'Em andamento', resolved:'Resolvido', closed:'Fechado', cancelled:'Cancelado' }
const TYPE_LABELS = { support:'Suporte', complaint:'Reclamação', exchange:'Troca', refund:'Reembolso', warranty:'Garantia', internal:'Interno', maintenance:'Manutenção' }

export function TicketsPanel({ notify }) {
  const { profile } = useTenant()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('open')
  const [filterPriority, setFilterPriority] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [form, setForm] = useState({ subject: '', description: '', type: 'support', priority: 'normal', category: '' })
  const [notes, setNotes] = useState([])

  const load = async () => {
    setLoading(true)
    let q = supabase.from('tickets').select('*, contacts(name, email)').order('created_at', { ascending: false }).limit(100)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterPriority) q = q.eq('priority', filterPriority)
    const { data } = await q
    setTickets(data || [])
    setLoading(false)
  }

  const loadNotes = async (ticketId) => {
    const { data } = await supabase.from('ticket_notes').select('*').eq('ticket_id', ticketId).order('created_at')
    setNotes(data || [])
  }

  useEffect(() => { load() }, [filterStatus, filterPriority])
  useEffect(() => { if (selected) loadNotes(selected.id) }, [selected])

  const create = async () => {
    if (!form.subject.trim()) { notify('Assunto obrigatório', 'error'); return }
    const { error } = await supabase.from('tickets').insert({ ...form, tenant_id: profile?.tenant_id })
    if (error) { notify('Erro ao criar ticket', 'error'); return }
    notify('Ticket criado', 'success'); setShowForm(false)
    setForm({ subject: '', description: '', type: 'support', priority: 'normal', category: '' })
    load()
  }

  const updateStatus = async (status) => {
    const updates = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    if (status === 'closed') updates.closed_at = new Date().toISOString()
    await supabase.from('tickets').update(updates).eq('id', selected.id)
    await supabase.from('ticket_history').insert({ tenant_id: profile?.tenant_id, ticket_id: selected.id, actor_id: profile?.user_id, action: 'status_changed', old_value: selected.status, new_value: status })
    setSelected(t => ({ ...t, status }))
    load(); notify('Status atualizado', 'success')
  }

  const addNote = async (isInternal = false) => {
    if (!note.trim()) return
    await supabase.from('ticket_notes').insert({ tenant_id: profile?.tenant_id, ticket_id: selected.id, author_id: profile?.user_id, content: note.trim(), is_internal: isInternal })
    setNote(''); loadNotes(selected.id); notify('Nota adicionada', 'success')
  }

  const priorityBadge = (p) => <span className={`text-[10px] font-medium ${PRIORITY_COLORS[p]}`}>{p?.toUpperCase()}</span>

  return (
    <div className="flex gap-0 h-[calc(100vh-64px)]">
      {/* Lista de tickets */}
      <div className="w-80 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-admin-text">Help Desk</h2>
            <button onClick={() => setShowForm(true)} className="text-admin-champ hover:bg-admin-champ/10 p-1.5 rounded-lg transition-colors">
              <Icon name="spark" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(STATUS_LABELS).slice(0,4).map(([k,v]) => (
              <button key={k} onClick={() => setFilterStatus(k === filterStatus ? '' : k)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${filterStatus === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/40 hover:text-admin-muted'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? <p className="text-admin-muted/30 text-sm p-4">Carregando…</p>
            : tickets.length === 0
              ? <div className="p-6 text-center"><Icon name="check" className="w-8 h-8 text-admin-champ/20 mx-auto mb-2" /><p className="text-admin-muted/40 text-xs">Nenhum ticket</p></div>
              : tickets.map(t => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${selected?.id === t.id ? 'bg-white/[0.05]' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-admin-text text-xs font-medium truncate flex-1">#{t.number} {t.subject}</p>
                    {priorityBadge(t.priority)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-admin-muted/40 text-[10px]">{TYPE_LABELS[t.type]}</span>
                    <span className="text-admin-muted/30 text-[10px]">·</span>
                    <span className="text-admin-muted/40 text-[10px]">{STATUS_LABELS[t.status]}</span>
                  </div>
                  {t.contacts?.name && <p className="text-admin-champ/50 text-[10px] mt-0.5">{t.contacts.name}</p>}
                </button>
              ))
          }
        </div>
      </div>

      {/* Detalhe do ticket */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-admin-text font-medium">#{selected.number} {selected.subject}</p>
                <div className="flex items-center gap-3 mt-1">
                  {priorityBadge(selected.priority)}
                  <span className="text-admin-muted/40 text-[10px]">{TYPE_LABELS[selected.type]}</span>
                  <span className="text-admin-muted/40 text-[10px]">{STATUS_LABELS[selected.status]}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {selected.status === 'open' && <button onClick={() => updateStatus('in_progress')} className="text-[10px] px-3 py-1.5 rounded-lg bg-admin-gold/10 text-admin-gold hover:bg-admin-gold/20 transition-colors">Iniciar</button>}
                {['open','in_progress','pending'].includes(selected.status) && <button onClick={() => updateStatus('resolved')} className="text-[10px] px-3 py-1.5 rounded-lg bg-admin-sage/10 text-admin-sage hover:bg-admin-sage/20 transition-colors">Resolver</button>}
                {selected.status === 'resolved' && <button onClick={() => updateStatus('closed')} className="text-[10px] px-3 py-1.5 rounded-lg text-admin-muted/50 hover:text-admin-muted hover:bg-white/[0.03] transition-colors">Fechar</button>}
              </div>
            </div>
            {selected.description && <p className="text-admin-muted/60 text-sm mt-3 bg-white/[0.02] rounded-xl px-4 py-3">{selected.description}</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-[10px] tracking-wider uppercase text-admin-muted/40 mb-3">Histórico</p>
            {notes.length === 0
              ? <p className="text-admin-muted/30 text-sm text-center py-4">Sem notas ainda</p>
              : notes.map(n => (
                <div key={n.id} className={`rounded-xl px-4 py-3 text-sm ${n.is_internal ? 'bg-admin-gold/8 border border-admin-gold/15 text-admin-gold/80 italic' : 'bg-white/[0.04] text-admin-text'}`}>
                  {n.is_internal && <span className="text-[9px] block mb-1 not-italic text-admin-gold/50">nota interna</span>}
                  <p>{n.content}</p>
                  <p className="text-[9px] opacity-40 mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))
            }
          </div>

          <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Adicionar nota…"
              className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={() => addNote(false)} disabled={!note.trim()}
                className="flex-1 text-[11px] py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors disabled:opacity-40">
                Resposta pública
              </button>
              <button onClick={() => addNote(true)} disabled={!note.trim()}
                className="flex-1 text-[11px] py-2 rounded-xl bg-admin-gold/10 hover:bg-admin-gold/20 text-admin-gold transition-colors disabled:opacity-40">
                Nota interna
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icon name="check" className="w-12 h-12 text-admin-champ/20 mx-auto mb-3" />
            <p className="text-admin-muted/40 text-sm">Selecione um ticket</p>
          </div>
        </div>
      )}

      {/* Modal novo ticket */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo ticket</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Assunto *</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Descreva o problema…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                  <GlassSelect value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
                    options={Object.entries(TYPE_LABELS).map(([value,label]) => ({value,label}))} />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Prioridade</label>
                  <GlassSelect value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
                    options={['low','normal','high','urgent','critical']} />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Detalhes…" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={create} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar ticket</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
