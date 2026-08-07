import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { getPreset, stageByStatus, elapsedSeconds } from '../../../lib/flowEngine'
import { KdsTimer } from './KdsTicketCard'

// Filas por estação — cada estação como uma coluna com sua fila de pedidos,
// ordenada por prioridade/tempo. Ação rápida de avançar direto na fila.
export function KdsQueues({ kind = 'kitchen' }) {
  const preset = getPreset(kind)
  const [tickets, setTickets] = useState([])
  const [stations, setStations] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').eq('kind', kind).not('status', 'in', '("delivered","cancelled")').order('priority', { ascending: false }).order('created_at'),
      supabase.from('kds_stations').select('*').eq('active', true).order('sort_order'),
    ])
    setTickets(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 6000); return () => clearInterval(iv) }, [kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])

  const advance = async (t) => {
    const st = stageByStatus(preset, t.status)
    const idx = preset.stages.findIndex((s) => s.status === st.status)
    const next = preset.stages[idx + 1]
    if (!next) return
    setTickets((l) => l.map((x) => x.id === t.id ? { ...x, status: next.status } : x))
    await supabase.rpc('kds_advance_ticket', { p_ticket_id: t.id, p_status: next.status })
    load()
  }

  // agrupa por estação (+ coluna "sem estação")
  const columns = useMemo(() => {
    const cols = stations.map((s) => ({ station: s, list: tickets.filter((t) => t.station_id === s.id) }))
    const unassigned = tickets.filter((t) => !t.station_id)
    if (unassigned.length) cols.push({ station: { id: '__none', name: 'Sem estação', color: '#B7745E', capacity: null }, list: unassigned })
    return cols
  }, [stations, tickets])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando filas…</p>

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {columns.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhuma estação ativa.</p>}
      {columns.map(({ station, list }) => {
        const loadPct = station.capacity ? Math.min(100, Math.round((list.length / station.capacity) * 100)) : 0
        return (
          <div key={station.id} className="glass rounded-2xl p-3 flex flex-col">
            <div className="flex items-center justify-between px-1 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: station.color || '#B89C61' }} />
                <p className="text-admin-text text-sm font-medium">{station.name}</p>
              </div>
              <span className="text-[10px] text-admin-muted/50 bg-white/[0.05] rounded-full px-2 py-0.5">{list.length}{station.capacity ? `/${station.capacity}` : ''}</span>
            </div>
            {station.capacity != null && (
              <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden mb-2.5 mx-1">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${loadPct}%`, background: loadPct >= 90 ? '#B7745E' : loadPct >= 60 ? '#D08A3E' : '#55634D' }} />
              </div>
            )}
            <div className="space-y-2 flex-1">
              {list.length === 0 && <p className="text-admin-muted/20 text-xs text-center py-6">fila vazia</p>}
              {list.map((t) => {
                const stage = stageByStatus(preset, t.status)
                return (
                  <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-serif text-base text-admin-text">{t.reference || '—'}</span>
                      <KdsTimer since={t.created_at} slaSec={t.sla_seconds} now={now} />
                    </div>
                    <p className="text-[11px] text-admin-muted/60 mb-1.5">{stage.label}{t.assignee ? ` · ${t.assignee}` : ''}</p>
                    <p className="text-xs text-admin-text/80 truncate mb-2">{(t.items || []).map((i) => `${i.qty || 1}× ${i.name}`).join(', ')}</p>
                    {!stage.terminal && <button onClick={() => advance(t)} className="w-full text-[11px] py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">{stage.key === 'queued' ? 'Iniciar' : stage.key === 'ready' ? 'Entregar' : 'Avançar'}</button>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
