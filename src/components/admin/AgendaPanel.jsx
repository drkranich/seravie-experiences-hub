import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'
import { logAudit } from '../../lib/audit'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const KIND = {
  appointment: { label: 'Agendamento', tone: 'text-admin-champ', dot: 'bg-admin-champ', route: 'spa' },
  event: { label: 'Evento', tone: 'text-admin-sage', dot: 'bg-admin-sage', route: 'events' },
  workshop: { label: 'Workshop', tone: 'text-admin-gold', dot: 'bg-admin-gold', route: 'coffee' },
  project: { label: 'Prazo de projeto', tone: 'text-admin-rose', dot: 'bg-admin-rose', route: 'architecture' },
  audit: { label: 'Auditoria', tone: 'text-admin-champ/70', dot: 'bg-admin-champ/50', route: 'franchise' },
}

export function AgendaPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(new Date())
  const [selected, setSelected] = useState(ymd(new Date()))
  const [noteInput, setNoteInput] = useState('')
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const loadNotes = async () => {
    const { data } = await supabase.from('agenda_notes').select('*').order('created_at', { ascending: true })
    setNotes(data || [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [ap, ev, pr, au] = await Promise.all([
        supabase.from('appointments').select('date, customer_name, service, time, status').limit(500),
        supabase.from('events').select('event_date, title, type, status').limit(500),
        supabase.from('projects').select('deadline, name, status').limit(500),
        supabase.from('audits').select('scheduled_at, title, status').limit(500),
      ])
      const list = []
      ;(ap.data || []).forEach((a) => a.date && list.push({ date: a.date, kind: 'appointment', title: `${a.service || 'Atendimento'} — ${a.customer_name || ''}`, extra: a.time }))
      ;(ev.data || []).forEach((e) => e.event_date && list.push({ date: e.event_date, kind: e.type === 'workshop' ? 'workshop' : 'event', title: e.title }))
      ;(pr.data || []).forEach((p) => p.deadline && list.push({ date: p.deadline, kind: 'project', title: p.name }))
      ;(au.data || []).forEach((a) => a.scheduled_at && list.push({ date: String(a.scheduled_at).slice(0, 10), kind: 'audit', title: a.title }))
      setItems(list)
      await loadNotes()
      setLoading(false)
    })()
  }, [])

  const byDay = useMemo(() => {
    const m = {}
    items.forEach((it) => { (m[it.date] = m[it.date] || []).push(it) })
    return m
  }, [items])
  const notesByDay = useMemo(() => {
    const m = {}
    notes.filter((n) => n.status === 'active').forEach((n) => { (m[n.date] = m[n.date] || []).push(n) })
    return m
  }, [notes])

  const y = view.getFullYear(), mo = view.getMonth()
  const firstDay = new Date(y, mo, 1).getDay()
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(y, mo, i + 1))]
  const monthLabel = view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const todayStr = ymd(new Date())

  const upcoming = useMemo(() => items.filter((it) => it.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12), [items, todayStr])
  const dayItems = byDay[selected] || []
  const dayNotes = notes.filter((n) => n.date === selected && (showArchived || n.status === 'active'))
  const archivedCount = notes.filter((n) => n.date === selected && n.status === 'archived').length

  // ---- Ações de observação ----
  const addNote = async () => {
    const c = noteInput.trim()
    if (!c) return
    const { data, error } = await supabase.from('agenda_notes').insert({ tenant_id: tenantId, date: selected, content: c, status: 'active' }).select().single()
    if (error) return notify('Erro ao salvar observação', 'error')
    setNoteInput(''); loadNotes(); notify('Observação adicionada', 'success')
    logAudit({ action: 'create', resource_type: 'agenda_notes', resource_id: data?.id, new_data: { date: selected, content: c } }, tenantId)
  }
  const startEdit = (n) => { setEditing(n.id); setEditText(n.content) }
  const saveEdit = async (n) => {
    const c = editText.trim(); if (!c) return
    const { error } = await supabase.from('agenda_notes').update({ content: c, updated_at: new Date().toISOString() }).eq('id', n.id)
    if (error) return notify('Erro ao editar', 'error')
    setEditing(null); loadNotes(); notify('Observação atualizada', 'success')
    logAudit({ action: 'update', resource_type: 'agenda_notes', resource_id: n.id, old_data: { content: n.content }, new_data: { content: c } }, tenantId)
  }
  const removeNote = async (n) => {
    const { error } = await supabase.from('agenda_notes').delete().eq('id', n.id)
    if (error) return notify('Erro ao excluir', 'error')
    loadNotes(); notify('Observação excluída', 'success')
    logAudit({ action: 'delete', resource_type: 'agenda_notes', resource_id: n.id, old_data: n }, tenantId)
  }
  const setStatus = async (n, status) => {
    await supabase.from('agenda_notes').update({ status }).eq('id', n.id)
    loadNotes(); notify(status === 'archived' ? 'Observação arquivada' : 'Observação restaurada', 'success')
  }
  const share = async (n) => {
    const text = `${new Date(n.date + 'T00:00:00').toLocaleDateString('pt-BR')} — ${n.content}`
    if (navigator.share) { try { await navigator.share({ title: 'Observação da agenda', text }) } catch { /* cancelado */ } }
    else if (navigator.clipboard) { navigator.clipboard.writeText(text); notify('Copiado para compartilhar', 'success') }
    else notify('Compartilhamento não suportado neste navegador', 'error')
  }

  const NoteBtn = ({ icon, label, onClick, tone = 'text-admin-muted' }) => (
    <button onClick={onClick} title={label} className={`p-1.5 rounded-lg ${tone} hover:bg-white/[0.06] transition-colors`}><Icon name={icon} className="w-3.5 h-3.5" /></button>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Agenda</h1><p className="text-admin-muted/60 text-sm mt-1">Agendamentos, eventos, workshops, prazos e auditorias — clique num dia para anotar</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(new Date(y, mo - 1, 1))} className="w-8 h-8 rounded-lg glass hover:bg-white/[0.06] flex items-center justify-center text-admin-muted"><Icon name="up" className="w-4 h-4 -rotate-90" /></button>
          <span className="text-admin-champ text-sm font-medium capitalize w-40 text-center">{monthLabel}</span>
          <button onClick={() => setView(new Date(y, mo + 1, 1))} className="w-8 h-8 rounded-lg glass hover:bg-white/[0.06] flex items-center justify-center text-admin-muted"><Icon name="down" className="w-4 h-4 -rotate-90" /></button>
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando agenda…</p> : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Calendário */}
          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => <div key={i} className="text-center text-[10px] text-admin-muted/40 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const k = ymd(d)
                const its = byDay[k] || []
                const nts = notesByDay[k] || []
                const isSel = k === selected
                const isToday = k === todayStr
                return (
                  <button key={i} onClick={() => setSelected(k)}
                    className={`min-h-[68px] rounded-lg p-1.5 text-left transition-colors border ${isSel ? 'border-admin-champ/40 bg-admin-champ/[0.06]' : 'border-transparent hover:bg-white/[0.03]'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isToday ? 'text-admin-champ font-medium' : 'text-admin-text'}`}>{d.getDate()}</span>
                      {nts.length > 0 && <Icon name="pen" className="w-3 h-3 text-admin-gold/70" />}
                    </div>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {its.slice(0, 4).map((it, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full ${KIND[it.kind].dot}`} />)}
                      {its.length > 4 && <span className="text-[8px] text-admin-muted/40">+{its.length - 4}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Legenda */}
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/[0.06]">
              {Object.entries(KIND).map(([k, v]) => <span key={k} className="flex items-center gap-1.5 text-[10px] text-admin-muted/50"><span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />{v.label}</span>)}
              <span className="flex items-center gap-1.5 text-[10px] text-admin-muted/50"><Icon name="pen" className="w-3 h-3 text-admin-gold/70" />Observação</span>
            </div>
          </div>

          {/* Dia selecionado + observações + próximos */}
          <div className="space-y-5">
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">{new Date(selected + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
              {dayItems.length === 0 ? <p className="text-admin-muted/40 text-xs mb-3">Nada agendado neste dia</p> : (
                <div className="space-y-2 mb-3">{dayItems.map((it, i) => (
                  <div key={i} className="flex items-start gap-2"><span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${KIND[it.kind].dot}`} /><div className="min-w-0"><p className="text-admin-text text-sm truncate">{it.title}</p><p className={`text-[10px] ${KIND[it.kind].tone}`}>{KIND[it.kind].label}{it.extra ? ` · ${it.extra}` : ''}</p></div></div>
                ))}</div>
              )}

              {/* Observações do dia */}
              <div className="pt-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Observações</p>
                  {archivedCount > 0 && <button onClick={() => setShowArchived((s) => !s)} className="text-[10px] text-admin-champ/70 hover:text-admin-champ">{showArchived ? 'ocultar arquivadas' : `arquivadas (${archivedCount})`}</button>}
                </div>
                {dayNotes.length === 0 ? <p className="text-admin-muted/30 text-xs mb-3">Nenhuma observação. Anote algo abaixo.</p> : (
                  <div className="space-y-2 mb-3">
                    {dayNotes.map((n) => (
                      <div key={n.id} className={`glass-soft rounded-xl px-3 py-2.5 ${n.status === 'archived' ? 'opacity-50' : ''}`}>
                        {editing === n.id ? (
                          <div>
                            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-admin-text outline-none resize-none mb-2" />
                            <div className="flex gap-2"><button onClick={() => saveEdit(n)} className="bg-admin-champ/15 text-admin-champ px-3 py-1 rounded-lg text-xs">Salvar</button><button onClick={() => setEditing(null)} className="text-admin-muted text-xs px-2">Cancelar</button></div>
                          </div>
                        ) : (
                          <>
                            <p className="text-admin-text text-sm whitespace-pre-wrap">{n.content}{n.status === 'archived' && <span className="text-admin-muted/40 text-[10px]"> · arquivada</span>}</p>
                            <div className="flex gap-0.5 mt-1.5 -ml-1.5">
                              <NoteBtn icon="pen" label="Editar" onClick={() => startEdit(n)} tone="text-admin-muted hover:text-admin-champ" />
                              {n.status === 'active'
                                ? <NoteBtn icon="folder" label="Arquivar" onClick={() => setStatus(n, 'archived')} tone="text-admin-muted hover:text-admin-gold" />
                                : <NoteBtn icon="up" label="Restaurar" onClick={() => setStatus(n, 'active')} tone="text-admin-muted hover:text-admin-sage" />}
                              <NoteBtn icon="link" label="Compartilhar" onClick={() => share(n)} tone="text-admin-muted hover:text-admin-champ" />
                              <NoteBtn icon="trash" label="Excluir" onClick={() => removeNote(n)} tone="text-admin-muted hover:text-admin-rose" />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }} rows={2} placeholder="Adicionar observação para este dia…" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none resize-none placeholder-admin-muted/30" />
                  <button onClick={addNote} disabled={!noteInput.trim()} className="shrink-0 self-stretch px-3 rounded-xl bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ text-sm transition-colors disabled:opacity-40" title="Adicionar (Ctrl+Enter)"><Icon name="plus" className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Próximos</p>
              {upcoming.length === 0 ? <p className="text-admin-muted/40 text-xs">Sem compromissos futuros</p> : (
                <div className="space-y-2">{upcoming.map((it, i) => (
                  <button key={i} onClick={() => { setSelected(it.date); setView(new Date(it.date + 'T00:00:00')) }} className="w-full text-left flex items-center gap-2.5 hover:bg-white/[0.03] rounded-lg px-1 py-1 transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND[it.kind].dot}`} />
                    <span className="text-admin-muted/50 text-[10px] w-12 shrink-0">{new Date(it.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span className="text-admin-text text-xs flex-1 truncate">{it.title}</span>
                  </button>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
