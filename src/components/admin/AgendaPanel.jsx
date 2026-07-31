import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const KIND = {
  appointment: { label: 'Agendamento', tone: 'text-admin-champ', dot: 'bg-admin-champ', route: 'spa' },
  event: { label: 'Evento', tone: 'text-admin-sage', dot: 'bg-admin-sage', route: 'events' },
  workshop: { label: 'Workshop', tone: 'text-admin-gold', dot: 'bg-admin-gold', route: 'coffee' },
  project: { label: 'Prazo de projeto', tone: 'text-admin-rose', dot: 'bg-admin-rose', route: 'architecture' },
  audit: { label: 'Auditoria', tone: 'text-admin-champ/70', dot: 'bg-admin-champ/50', route: 'franchise' },
}

export function AgendaPanel({ notify }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(new Date())
  const [selected, setSelected] = useState(ymd(new Date()))

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
      setItems(list); setLoading(false)
    })()
  }, [])

  const byDay = useMemo(() => {
    const m = {}
    items.forEach((it) => { (m[it.date] = m[it.date] || []).push(it) })
    return m
  }, [items])

  const y = view.getFullYear(), mo = view.getMonth()
  const firstDay = new Date(y, mo, 1).getDay()
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(y, mo, i + 1))]
  const monthLabel = view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const todayStr = ymd(new Date())

  const upcoming = useMemo(() => items.filter((it) => it.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12), [items, todayStr])
  const dayItems = byDay[selected] || []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Agenda</h1><p className="text-admin-muted/60 text-sm mt-1">Agendamentos, eventos, workshops, prazos e auditorias — tudo em um lugar</p></div>
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
                const isSel = k === selected
                const isToday = k === todayStr
                return (
                  <button key={i} onClick={() => setSelected(k)}
                    className={`min-h-[68px] rounded-lg p-1.5 text-left transition-colors border ${isSel ? 'border-admin-champ/40 bg-admin-champ/[0.06]' : 'border-transparent hover:bg-white/[0.03]'}`}>
                    <span className={`text-xs ${isToday ? 'text-admin-champ font-medium' : 'text-admin-text'}`}>{d.getDate()}</span>
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
            </div>
          </div>

          {/* Dia selecionado + próximos */}
          <div className="space-y-5">
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">{new Date(selected + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
              {dayItems.length === 0 ? <p className="text-admin-muted/40 text-xs">Nada agendado neste dia</p> : (
                <div className="space-y-2">{dayItems.map((it, i) => (
                  <div key={i} className="flex items-start gap-2"><span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${KIND[it.kind].dot}`} /><div className="min-w-0"><p className="text-admin-text text-sm truncate">{it.title}</p><p className={`text-[10px] ${KIND[it.kind].tone}`}>{KIND[it.kind].label}{it.extra ? ` · ${it.extra}` : ''}</p></div></div>
                ))}</div>
              )}
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
