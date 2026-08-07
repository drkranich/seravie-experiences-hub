import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { getPreset, stageByStatus, elapsedSeconds } from '../../../lib/flowEngine'
import { playSound, DEFAULT_SOUND } from '../../../lib/kdsSound'
import { TicketCard } from './KdsTicketCard'
import { KdsTicketEditor } from './KdsTicketEditor'

// Hook: relógio compartilhado de 1s para todos os cronômetros da tela.
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  return now
}


// Tela de Produção (Kanban 7 colunas, drag&drop, timers).
// tv=true entra no modo TV (sem ações, layout de tela cheia).
export function KdsBoard({ kind = 'kitchen', tv = false, touch = false, soundOn = true, sound, stationFilter = '', onCounts, notify, registerNew }) {
  const preset = getPreset(kind)
  const now = useClock()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(null)
  const [editor, setEditor] = useState(null) // { } novo | ticket editar
  const prevCount = useRef(0)
  // Config de som: usa `sound` (config granular) quando fornecida; senão o toggle simples.
  const soundCfg = sound || { ...DEFAULT_SOUND, enabled: soundOn }
  const chime = (type) => playSound(type, soundCfg)

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

  // Permite o componente-pai abrir o "novo pedido" a partir de um botão externo.
  useEffect(() => { if (registerNew) registerNew(() => setEditor({})) }, [registerNew])

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
    <div className={`grid gap-2.5 ${tv ? 'grid-cols-7' : 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-7'}`}>
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
                <TicketCard key={t.id} t={t} now={now} stage={stage} onAdvance={advance} onCancel={cancel} onEdit={tv ? null : setEditor} onDragStart={tv || touch ? null : onDragStart} tv={tv} touch={touch} />
              ))}
            </div>
          </div>
        )
      })}
      {editor && <KdsTicketEditor ticket={editor.id ? editor : null} kind={kind} notify={notify} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }} />}
    </div>
  )
}
