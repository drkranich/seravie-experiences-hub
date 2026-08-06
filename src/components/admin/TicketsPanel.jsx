import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { FlowImageField } from './FlowImageField'
import { AttachButton, PendingAttachments, AttachmentList } from './AttachmentField'
import { exportPdf } from '../../lib/export'
import { logAudit } from '../../lib/audit'

const PRIORITY = { low: ['Baixa', 'text-admin-muted/50', 'bg-white/[0.06]'], normal: ['Normal', 'text-admin-sage', 'bg-admin-sage/10'], high: ['Alta', 'text-admin-gold', 'bg-admin-gold/10'], urgent: ['Urgente', 'text-admin-rose', 'bg-admin-rose/10'], critical: ['Crítica', 'text-red-400', 'bg-red-500/10'] }
const STATUS = { open: 'Aberto', pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado', cancelled: 'Cancelado' }
const TYPE = { support: 'Suporte', complaint: 'Reclamação', exchange: 'Troca', refund: 'Reembolso', warranty: 'Garantia', internal: 'Interno', maintenance: 'Manutenção' }
const STATUS_STYLE = { open: 'text-admin-champ', pending: 'text-admin-gold', in_progress: 'text-admin-champ', resolved: 'text-admin-sage', closed: 'text-admin-muted/50', cancelled: 'text-admin-rose' }

// Filas (como as do Chat): cada uma é um filtro pré-definido
const QUEUES = [
  ['open', 'Abertos', 'open'],
  ['in_progress', 'Em andamento', 'in_progress'],
  ['pending', 'Pendentes', 'pending'],
  ['urgent', 'Urgentes', 'urgent'],
  ['unassigned', 'Sem atribuição', 'unassigned'],
  ['mine', 'Meus tickets', 'mine'],
  ['breached', 'SLA estourado', 'breached'],
  ['resolved', 'Resolvidos', 'resolved'],
]
const QUEUE_DOT = { open: 'bg-admin-champ', in_progress: 'bg-admin-champ', pending: 'bg-admin-gold', urgent: 'bg-admin-rose', unassigned: 'bg-admin-muted/50', mine: 'bg-admin-sage', breached: 'bg-red-400', resolved: 'bg-admin-sage' }

const timeAgo = (d) => { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return 'agora'; if (s < 3600) return `${Math.floor(s / 60)}min`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d` }
const dueLabel = (due) => {
  if (!due) return null
  const ms = new Date(due).getTime() - Date.now()
  const abs = Math.abs(ms); const h = Math.floor(abs / 3600000); const m = Math.floor((abs % 3600000) / 60000)
  const txt = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
  return ms < 0 ? { over: true, txt: `estourou há ${txt}` } : { over: false, txt: `faltam ${txt}` }
}

export function TicketsPanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('helpdesk') : true
  const [tickets, setTickets] = useState([])
  const [counts, setCounts] = useState({})
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState('open')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState([])
  const [history, setHistory] = useState([])
  const [note, setNote] = useState('')
  const [noteFiles, setNoteFiles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', type: 'support', priority: 'normal', category: '' })
  const [ctxOpen, setCtxOpen] = useState(true)

  const load = async () => {
    setLoading(true)
    let q = supabase.from('tickets').select('*, contacts(name, email, phone)').order('created_at', { ascending: false }).limit(200)
    const active = ['resolved'].includes(queue) ? null : ['resolved', 'closed', 'cancelled']
    if (queue === 'resolved') q = q.eq('status', 'resolved')
    else if (queue === 'urgent') q = q.in('priority', ['urgent', 'critical']).not('status', 'in', '(resolved,closed,cancelled)')
    else if (queue === 'unassigned') q = q.is('assigned_to', null).is('assigned_team', null).not('status', 'in', '(resolved,closed,cancelled)')
    else if (queue === 'mine') q = q.eq('assigned_to', profile?.user_id).not('status', 'in', '(resolved,closed,cancelled)')
    else if (queue === 'breached') q = q.eq('sla_breached', true).not('status', 'in', '(resolved,closed,cancelled)')
    else if (STATUS[queue]) q = q.eq('status', queue)
    const { data } = await q
    let rows = data || []
    if (search.trim()) { const s = search.toLowerCase(); rows = rows.filter((t) => `${t.number} ${t.subject} ${t.contacts?.name || ''}`.toLowerCase().includes(s)) }
    setTickets(rows); setLoading(false)
  }
  const loadCounts = async () => { const { data } = await supabase.rpc('ticket_queue_counts'); setCounts(data || {}) }
  const loadMembers = async () => { const { data } = await supabase.from('memberships').select('user_id, email').eq('status', 'active'); setMembers(data || []) }

  useEffect(() => { load() }, [queue, search])
  useEffect(() => { loadCounts(); loadMembers() }, [])
  useEffect(() => {
    if (!selected) return
    supabase.from('ticket_notes').select('*').eq('ticket_id', selected.id).order('created_at').then(({ data }) => setNotes(data || []))
    supabase.from('ticket_history').select('*').eq('ticket_id', selected.id).order('created_at', { ascending: false }).then(({ data }) => setHistory(data || []))
  }, [selected?.id])

  const patchTicket = async (patch, historyAction) => {
    const old = selected
    const { error } = await supabase.from('tickets').update(patch).eq('id', selected.id)
    if (error) return notify('Erro: ' + error.message, 'error')
    if (historyAction) await supabase.from('ticket_history').insert({ tenant_id: tenantId, ticket_id: selected.id, actor_id: profile?.user_id, action: historyAction.action, old_value: historyAction.old, new_value: historyAction.new })
    logAudit({ action: 'update', resource_type: 'tickets', resource_id: selected.id, new_data: patch }, tenantId)
    setSelected((t) => ({ ...t, ...patch }))
    setTickets((xs) => xs.map((x) => x.id === selected.id ? { ...x, ...patch } : x))
    loadCounts()
    if (historyAction) supabase.from('ticket_history').select('*').eq('ticket_id', old.id).order('created_at', { ascending: false }).then(({ data }) => setHistory(data || []))
  }

  const setStatus = (status) => {
    const patch = { status }
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    if (status === 'closed') patch.closed_at = new Date().toISOString()
    patchTicket(patch, { action: 'status_changed', old: selected.status, new: status })
    notify('Status atualizado', 'success')
  }
  const setPriority = (priority) => patchTicket({ priority }, { action: 'priority_changed', old: selected.priority, new: priority })
  const setAssignee = (uid) => patchTicket({ assigned_to: uid || null }, { action: 'assigned', old: selected.assigned_to, new: uid })
  const setTeam = (team) => patchTicket({ assigned_team: team || null }, { action: 'team_changed', old: selected.assigned_team, new: team })

  const create = async () => {
    if (!form.subject.trim()) return notify('Assunto obrigatório', 'error')
    const { error } = await supabase.from('tickets').insert({ ...form, tenant_id: tenantId })
    if (error) return notify('Erro ao criar ticket', 'error')
    notify('Ticket criado', 'success'); setShowForm(false); setForm({ subject: '', description: '', type: 'support', priority: 'normal', category: '' }); load(); loadCounts()
  }

  const addNote = async (isInternal) => {
    if (!note.trim() && noteFiles.length === 0) return
    const { data, error } = await supabase.from('ticket_notes').insert({ tenant_id: tenantId, ticket_id: selected.id, author_id: profile?.user_id, content: note.trim(), is_internal: isInternal, attachments: noteFiles }).select('*').single()
    if (error) return notify('Erro ao adicionar', 'error')
    setNotes((n) => [...n, data]); setNote(''); setNoteFiles([])
  }

  const linkDeal = async () => {
    // cria um negócio no pipeline a partir do ticket (Spine)
    if (selected.deal_id) return notify('Este ticket já tem um negócio vinculado', 'info')
    const { data, error } = await supabase.from('deals').insert({
      tenant_id: tenantId, title: selected.subject || `Ticket #${selected.number}`, contact_id: selected.contact_id,
      stage: 'new', source: 'helpdesk', notes: selected.description,
    }).select('id').single()
    if (error) return notify('Erro ao criar negócio: ' + error.message, 'error')
    await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: data.id, type: 'system', title: 'Criado a partir de um chamado', meta: { ticket_id: selected.id } })
    await patchTicket({ deal_id: data.id }, { action: 'deal_linked', old: null, new: data.id })
    notify('Negócio criado no pipeline', 'success')
  }

  const exportTicketPdf = () => {
    const rows = [
      { campo: 'Número', valor: `#${selected.number}` },
      { campo: 'Assunto', valor: selected.subject },
      { campo: 'Cliente', valor: selected.contacts?.name || '—' },
      { campo: 'Prioridade', valor: PRIORITY[selected.priority]?.[0] },
      { campo: 'Status', valor: STATUS[selected.status] },
      { campo: 'Tipo', valor: TYPE[selected.type] },
      { campo: 'Descrição', valor: selected.description || '—' },
      { campo: 'Resolução', valor: selected.resolution || '—' },
      ...notes.filter((n) => !n.is_internal).map((n, i) => ({ campo: `Resposta ${i + 1}`, valor: n.content })),
    ]
    exportPdf(`Chamado #${selected.number}`, rows, selected.subject)
  }

  const PBadge = ({ p }) => { const x = PRIORITY[p] || PRIORITY.normal; return <span className={`text-[9px] px-1.5 py-0.5 rounded ${x[1]} ${x[2]}`}>{x[0]}</span> }
  const teams = ['Suporte', 'Financeiro', 'Trocas & Devoluções', 'Técnico', 'Comercial']

  return (
    <div className="flex gap-0 h-[calc(100vh-64px)]">
      {/* Coluna 1 — Filas */}
      <div className="w-48 shrink-0 border-r border-white/[0.06] flex flex-col bg-white/[0.01]">
        <div className="p-4">
          {mayEdit && <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm mb-4 transition-colors"><Icon name="plus" className="w-4 h-4" />Novo chamado</button>}
          <p className="text-[10px] tracking-wider uppercase text-admin-muted/40 mb-2 px-1">Filas</p>
          <div className="space-y-0.5">
            {QUEUES.map(([key, label]) => {
              const n = counts[key]
              return (
                <button key={key} onClick={() => { setQueue(key); setSelected(null) }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${queue === key ? 'bg-admin-champ/12 text-admin-champ' : 'text-admin-muted/70 hover:bg-white/[0.03] hover:text-admin-text'}`}>
                  <span className={`w-2 h-2 rounded-full ${QUEUE_DOT[key]}`} />
                  <span className="flex-1 text-left truncate">{label}</span>
                  {n > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded ${key === 'urgent' || key === 'breached' ? 'bg-admin-rose/15 text-admin-rose' : 'bg-white/[0.06] text-admin-muted/60'}`}>{n}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Coluna 2 — Lista */}
      <div className="w-80 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar chamado…" className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-sm text-admin-text outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="text-admin-muted/30 text-sm p-4">Carregando…</p> : tickets.length === 0 ? (
            <div className="p-8 text-center"><Icon name="check" className="w-8 h-8 text-admin-champ/20 mx-auto mb-2" /><p className="text-admin-muted/40 text-xs">Nenhum chamado nesta fila</p></div>
          ) : tickets.map((t) => {
            const due = ['open', 'in_progress', 'pending'].includes(t.status) ? dueLabel(t.sla_due_at) : null
            return (
              <button key={t.id} onClick={() => setSelected(t)} className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${selected?.id === t.id ? 'bg-white/[0.05]' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-admin-muted/30 text-[10px]">#{t.number}</span>
                  <p className="text-admin-text text-sm font-medium truncate flex-1">{t.subject}</p>
                  <PBadge p={t.priority} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {t.contacts?.name && <span className="text-admin-champ/60 text-[10px]">{t.contacts.name}</span>}
                  <span className={`text-[10px] ${STATUS_STYLE[t.status]}`}>{STATUS[t.status]}</span>
                  <span className="text-admin-muted/30 text-[10px]">· {timeAgo(t.created_at)}</span>
                  {t.sla_breached && <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 rounded">SLA</span>}
                  {due && <span className={`text-[9px] px-1.5 rounded ${due.over ? 'text-red-400 bg-red-500/10' : 'text-admin-gold/70 bg-admin-gold/10'}`}>{due.txt}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Coluna 3 — Detalhe */}
      {selected ? (
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {/* header */}
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-admin-text font-medium truncate">#{selected.number} · {selected.subject}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <PBadge p={selected.priority} />
                    <span className="text-admin-muted/40 text-[11px]">{TYPE[selected.type]}</span>
                    <span className={`text-[11px] ${STATUS_STYLE[selected.status]}`}>{STATUS[selected.status]}</span>
                    <span className="text-admin-muted/30 text-[11px]">aberto há {timeAgo(selected.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={exportTicketPdf} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ transition-colors">PDF</button>
                  {mayEdit && <button onClick={linkDeal} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ transition-colors">{selected.deal_id ? '✓ Negócio' : 'Pipeline'}</button>}
                  {mayEdit && selected.status === 'open' && <button onClick={() => setStatus('in_progress')} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-gold/10 text-admin-gold hover:bg-admin-gold/20 transition-colors">Iniciar</button>}
                  {mayEdit && ['open', 'in_progress', 'pending'].includes(selected.status) && <button onClick={() => setStatus('resolved')} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-sage/12 text-admin-sage hover:bg-admin-sage/20 transition-colors">Resolver</button>}
                  {mayEdit && selected.status === 'resolved' && <button onClick={() => setStatus('closed')} className="text-[11px] px-3 py-1.5 rounded-lg text-admin-muted/50 hover:text-admin-muted transition-colors">Fechar</button>}
                  <button onClick={() => setCtxOpen((o) => !o)} className="text-[11px] px-2 py-1.5 rounded-lg text-admin-muted/50 hover:text-admin-champ transition-colors lg:hidden"><Icon name="layout" className="w-4 h-4" /></button>
                </div>
              </div>
              {selected.description && <p className="text-admin-muted/60 text-sm mt-3 bg-white/[0.02] rounded-xl px-4 py-3 whitespace-pre-wrap">{selected.description}</p>}
            </div>

            {/* conversa / notas + histórico */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {notes.length === 0 && history.length === 0 ? <p className="text-admin-muted/30 text-sm text-center py-6">Sem interações ainda.</p> : (
                <>
                  {notes.map((n) => (
                    <div key={n.id} className={`rounded-xl px-4 py-3 text-sm ${n.is_internal ? 'bg-admin-gold/[0.07] border border-admin-gold/15' : 'bg-white/[0.04]'}`}>
                      {n.is_internal && <span className="text-[9px] block mb-1 text-admin-gold/60 uppercase tracking-wider">Nota interna</span>}
                      {n.content && <p className={`whitespace-pre-wrap ${n.is_internal ? 'text-admin-gold/90' : 'text-admin-text'}`}>{n.content}</p>}
                      <AttachmentList items={n.attachments} compact />
                      <p className="text-[9px] opacity-40 mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                  {history.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] tracking-wider uppercase text-admin-muted/40 mb-2">Histórico</p>
                      {history.map((h) => (
                        <p key={h.id} className="text-admin-muted/50 text-xs py-0.5">· {h.action === 'status_changed' ? `Status → ${STATUS[h.new_value] || h.new_value}` : h.action === 'priority_changed' ? `Prioridade → ${PRIORITY[h.new_value]?.[0] || h.new_value}` : h.action === 'assigned' ? 'Atribuído' : h.action === 'deal_linked' ? 'Vinculado a negócio' : h.action} <span className="opacity-40">{timeAgo(h.created_at)}</span></p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* compositor */}
            {mayEdit && (
              <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
                <PendingAttachments items={noteFiles} onRemove={(i) => setNoteFiles((a) => a.filter((_, j) => j !== i))} />
                <div className="flex gap-2 items-start">
                  <AttachButton onAdd={(a) => setNoteFiles((xs) => [...xs, a])} folder="tickets" notify={notify} />
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Escreva uma resposta ou nota interna… (imagem, vídeo ou PDF pelo clipe)" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addNote(false)} disabled={!note.trim() && noteFiles.length === 0} className="flex-1 text-[11px] py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors disabled:opacity-40">Resposta ao cliente</button>
                  <button onClick={() => addNote(true)} disabled={!note.trim() && noteFiles.length === 0} className="flex-1 text-[11px] py-2 rounded-xl bg-admin-gold/10 hover:bg-admin-gold/20 text-admin-gold transition-colors disabled:opacity-40">Nota interna</button>
                </div>
              </div>
            )}
          </div>

          {/* Painel de Contexto */}
          <div className={`${ctxOpen ? 'w-72' : 'w-0'} shrink-0 border-l border-white/[0.06] overflow-y-auto transition-all hidden lg:block`}>
            <div className="p-5 space-y-5">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Contexto</p>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Prioridade</label>
                <GlassSelect value={selected.priority} onChange={setPriority} options={Object.entries(PRIORITY).map(([value, x]) => ({ value, label: x[0] }))} disabled={!mayEdit} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Atendente</label>
                <GlassSelect value={selected.assigned_to || ''} onChange={setAssignee} options={[{ value: '', label: '— sem atribuição —' }, ...members.map((m) => ({ value: m.user_id, label: m.email || m.user_id?.slice(0, 8) }))]} disabled={!mayEdit} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Equipe</label>
                <GlassSelect value={selected.assigned_team || ''} onChange={setTeam} options={[{ value: '', label: '— nenhuma —' }, ...teams.map((t) => ({ value: t, label: t }))]} disabled={!mayEdit} />
              </div>

              {/* SLA */}
              {selected.sla_due_at && (() => { const d = dueLabel(selected.sla_due_at); return (
                <div className={`rounded-xl px-3 py-2.5 ${d?.over ? 'bg-red-500/10' : 'bg-admin-gold/8'}`}>
                  <p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Prazo de resolução (SLA)</p>
                  <p className={`text-sm mt-0.5 ${d?.over ? 'text-red-400' : 'text-admin-gold'}`}>{d?.txt}</p>
                </div>
              ) })()}

              {/* Cliente 360 */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Cliente</label>
                {selected.contacts?.name ? (
                  <div className="glass-soft rounded-xl p-3">
                    <p className="text-admin-text text-sm">{selected.contacts.name}</p>
                    {selected.contacts.email && <p className="text-admin-muted/50 text-xs mt-0.5">{selected.contacts.email}</p>}
                    {selected.contacts.phone && <p className="text-admin-muted/50 text-xs">{selected.contacts.phone}</p>}
                  </div>
                ) : <p className="text-admin-muted/40 text-xs">Nenhum cliente vinculado.</p>}
              </div>

              {/* Resolução */}
              {['resolved', 'closed'].includes(selected.status) && mayEdit && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Resolução</label>
                  <textarea defaultValue={selected.resolution || ''} onBlur={(e) => patchTicket({ resolution: e.target.value })} rows={2} placeholder="Como foi resolvido…" className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none resize-none" />
                </div>
              )}

              <div className="text-admin-muted/30 text-[10px] pt-2 border-t border-white/[0.05]">
                <p>Tipo: {TYPE[selected.type]}</p>
                {selected.category && <p>Categoria: {selected.category}</p>}
                <p>Criado: {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><Icon name="check" className="w-12 h-12 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Selecione um chamado</p></div>
        </div>
      )}

      {/* Modal novo chamado */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Novo chamado</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Assunto *</label><input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Resumo do chamado…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={Object.entries(TYPE).map(([value, label]) => ({ value, label }))} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Prioridade</label><GlassSelect value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={Object.entries(PRIORITY).map(([value, x]) => ({ value, label: x[0] }))} /></div>
              </div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label><input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Entrega, Produto, Pagamento…" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Detalhes…" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={create} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar chamado</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
