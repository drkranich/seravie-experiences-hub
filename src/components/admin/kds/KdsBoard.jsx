import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { getPreset, stageByStatus, elapsedSeconds } from '../../../lib/flowEngine'
import { TicketCard } from './KdsTicketCard'

// Hook: relógio compartilhado de 1s para todos os cronômetros da tela.
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  return now
}

// Sons discretos via WebAudio (sem assets). Configuráveis (liga/desliga).
function useChime(enabled) {
  const ctxRef = useRef(null)
  return (type = 'new') => {
    if (!enabled) return
    try {
      ctxRef.current = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current
      const o = ctx.createOscillator(), g = ctx.createGain()
      const freq = type === 'urgent' ? 880 : type === 'ready' ? 660 : type === 'cancel' ? 220 : 520
      o.frequency.value = freq; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36)
    } catch { /* silêncio se o browser bloquear áudio */ }
  }
}

// Tela de Produção (Kanban 7 colunas, drag&drop, timers).
// tv=true entra no modo TV (sem ações, layout de tela cheia).
export function KdsBoard({ kind = 'kitchen', tv = false, soundOn = true, stationFilter = '', onCounts }) {
  const preset = getPreset(kind)
  const now = useClock()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(null)
  const prevCount = useRef(0)
  const chime = useChime(soundOn)

  const load = async () => {
    let q = supabase.from('kds_tickets').select('*').eq('kind', kind)
      .not('status', 'in', '("cancelled")')
      .order('priority', { ascending: false }).order('created_at', { ascending: true })
    const { data } = await q
    const rows = data || []
    // som ao chegar pedido novo
    if (rows.length > prevCount.current && prevCount.current !== 0) {
      const urgent = rows.some((r) => (r.tags || []).some((t) => /URGENTE|ATRASADO|ALERGIA/i.test(t)))
      chime(urgent ? 'urgent' : 'new')
    }
    prevCount.current = rows.length
    setTickets(rows); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 6000); return () => clearInterval(iv) }, [kind])

  // realtime: recarrega ao inserir/atualizar tickets
  useEffect(() => {
    const ch = supabase.channel('kds_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [kind])

  const shown = useMemo(() => stationFilter ? tickets.filter((t) => t.station_id === stationFilter) : tickets, [tickets, stationFilter])

  useEffect(() => {
    if (!onCounts) return
    const active = shown.filter((t) => !['delivered'].includes(t.status)).length
    const late = shown.filter((t) => t.sla_seconds && elapsedSeconds(t.created_at, now) >= t.sla_seconds && t.status !== 'delivered').length
    onCounts({ active, late, total: shown.length })
  }, [shown, now])

  const move = async (t, status) => {
    if (t.status === status) return
    setTickets((list) => list.map((x) => (x.id === t.id ? { ...x, status } : x))) // otimista
    if (status === 'ready') chime('ready')
    await supabase.rpc('kds_advance_ticket', { p_ticket_id: t.id, p_status: status })
    load()
  }
  const advance = (t) => {
    const st = stageByStatus(preset, t.status)
    const idx = preset.stages.findIndex((s) => s.status === st.status)
    const next = preset.stages[idx + 1]
    if (next) move(t, next.status)
  }
  const cancel = async (t) => {
    setTickets((list) => list.filter((x) => x.id !== t.id))
    chime('cancel')
    await supabase.rpc('kds_advance_ticket', { p_ticket_id: t.id, p_status: 'cancelled' })
    load()
  }

  const onDragStart = (e, t) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }
  const onDrop = (e, status) => {
    e.preventDefault(); setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const t = tickets.find((x) => x.id === id)
    if (t) move(t, status)
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando produção…</p>

  return (
    <div className={`grid gap-3 ${tv ? 'grid-cols-7' : 'grid-flow-col auto-cols-[minmax(240px,1fr)] overflow-x-auto pb-3'}`} style={tv ? {} : { scrollbarWidth: 'thin' }}>
      {preset.stages.map((stage) => {
        const list = shown.filter((t) => t.status === stage.status)
        const isOver = dragOver === stage.status
        const accentText = {
          champ: 'text-admin-champ', copper: 'text-admin-copper', gold: 'text-admin-gold',
          sage: 'text-admin-sage', rose: 'text-admin-rose', muted: 'text-admin-muted/60',
        }[stage.accent] || 'text-admin-champ'
        return (
          <div
            key={stage.key}
            onDragOver={(e) => { e.preventDefault(); setDragOver(stage.status) }}
            onDragLeave={() => setDragOver((s) => (s === stage.status ? null : s))}
            onDrop={(e) => onDrop(e, stage.status)}
            className={`glass rounded-2xl p-2.5 flex flex-col min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-admin-champ/50 bg-admin-champ/[0.04]' : ''}`}
          >
            <div className="flex items-center justify-between px-1.5 pb-2.5 sticky top-0">
              <div className="flex items-center gap-1.5">
                <Icon name={stage.icon} className={`w-3.5 h-3.5 ${accentText}`} />
                <p className={`text-[10px] uppercase tracking-wider ${accentText} ${tv ? 'text-xs' : ''}`}>{stage.label}</p>
              </div>
              <span className="text-[10px] text-admin-muted/40 tabular-nums bg-white/[0.05] rounded-full px-2 py-0.5">{list.length}</span>
            </div>
            <div className={`space-y-2.5 flex-1 ${tv ? 'overflow-y-auto' : ''}`}>
              {list.length === 0 && <div className="text-admin-muted/20 text-xs text-center py-6 border border-dashed border-white/[0.05] rounded-xl">solte aqui</div>}
              {list.map((t) => (
                <TicketCard key={t.id} t={t} now={now} stage={stage} onAdvance={advance} onCancel={cancel} onDragStart={tv ? null : onDragStart} tv={tv} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
