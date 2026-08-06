import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { getPreset, elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

// Mapa da Cozinha — "Digital Twin": a produção representada como um fluxo de
// blocos conectados (Entrada → estágios → Entrega). Cada bloco muda de cor
// conforme a carga/tempo e mostra quantidade, fila, tempo e eficiência.
// Genérico: os blocos vêm dos estágios do preset do motor.

// Cor do bloco por nível de carga (0..1). Verde musgo (tranquilo) → laranja → vermelho.
function loadTone(ratio) {
  if (ratio >= 0.85) return { bg: 'rgba(183,116,94,0.18)', border: '#B7745E', text: 'text-admin-rose', label: 'congestionado' }
  if (ratio >= 0.5) return { bg: 'rgba(208,138,62,0.16)', border: '#D08A3E', text: 'text-[#D08A3E]', label: 'carregado' }
  if (ratio > 0) return { bg: 'rgba(85,99,77,0.18)', border: '#55634D', text: 'text-admin-sage', label: 'fluindo' }
  return { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.10)', text: 'text-admin-muted/50', label: 'ocioso' }
}

export function KdsKitchenMap({ kind = 'kitchen' }) {
  const preset = getPreset(kind)
  const [tickets, setTickets] = useState([])
  const [stations, setStations] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').eq('kind', kind).gte('created_at', since.toISOString()),
      supabase.from('kds_stations').select('*').eq('active', true).order('sort_order'),
    ])
    setTickets(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])

  // Estatística por estágio do fluxo (bloco do mapa).
  const blocks = useMemo(() => {
    const workStages = preset.stages // todos os estágios formam o fluxo visual
    // capacidade de referência: média das estações ativas (fallback 10)
    const capRef = stations.length ? Math.round(stations.reduce((a, s) => a + (s.capacity || 0), 0) / stations.length) : 10
    return workStages.map((stage) => {
      const list = tickets.filter((t) => t.status === stage.status)
      const active = list.length
      const late = list.filter((t) => t.sla_seconds && elapsedSeconds(t.created_at, now) >= t.sla_seconds).length
      const avgWait = active ? list.reduce((a, t) => a + elapsedSeconds(t.created_at, now), 0) / active : 0
      const ratio = stage.terminal ? 0 : Math.min(1, active / Math.max(1, capRef))
      return { stage, active, late, avgWait, ratio, tone: loadTone(ratio) }
    })
  }, [tickets, stations, now, preset])

  const totalActive = tickets.filter((t) => !['delivered', 'cancelled'].includes(t.status)).length
  const throughput = tickets.filter((t) => t.status === 'delivered').length

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando mapa da cozinha…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2"><Icon name="bolt" className="w-4 h-4 text-admin-champ" /><span className="text-sm text-admin-text">{totalActive}</span><span className="text-admin-muted/50 text-xs">em fluxo</span></div>
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2"><Icon name="truck" className="w-4 h-4 text-admin-sage" /><span className="text-sm text-admin-text">{throughput}</span><span className="text-admin-muted/50 text-xs">entregues hoje</span></div>
        <p className="text-admin-muted/40 text-xs ml-auto">atualização em tempo real · cores por carga</p>
      </div>

      {/* Fluxo horizontal de blocos (Digital Twin) */}
      <div className="glass rounded-2xl p-6 overflow-x-auto">
        <div className="flex items-stretch gap-2 min-w-[900px]">
          {/* Entrada */}
          <FlowNode entry label="Entrada" icon="grid" sub={`${totalActive} ativos`} />
          <Connector />
          {blocks.map((b, i) => (
            <div key={b.stage.key} className="flex items-stretch gap-2">
              <FlowBlock block={b} />
              {i < blocks.length - 1 && <Connector highlight={b.active > 0} />}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-admin-muted/60">
        {[['#55634D', 'fluindo'], ['#D08A3E', 'carregado'], ['#B7745E', 'congestionado'], ['rgba(255,255,255,0.2)', 'ocioso']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: c }} />{l}</span>
        ))}
      </div>
    </div>
  )
}

// Bloco de estágio (nó do fluxo) — muda de cor por carga, mostra métricas.
function FlowBlock({ block }) {
  const { stage, active, late, avgWait, tone } = block
  return (
    <div className="rounded-2xl border p-4 w-[150px] shrink-0 transition-all duration-500 flex flex-col" style={{ background: tone.bg, borderColor: tone.border }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon name={stage.icon} className={`w-4 h-4 ${tone.text}`} />
        <p className="text-[10px] uppercase tracking-wider text-admin-muted/70 leading-tight">{stage.label}</p>
      </div>
      <p className={`text-3xl font-medium tabular-nums leading-none ${tone.text}`}>{active}</p>
      <p className="text-[10px] text-admin-muted/50 mt-1">{tone.label}</p>
      <div className="mt-auto pt-3 space-y-0.5">
        {avgWait > 0 && <p className="text-[10px] text-admin-muted/60">⌀ {fmtMin(avgWait)}</p>}
        {late > 0 && <p className="text-[10px] text-admin-rose">{late} atrasado(s)</p>}
      </div>
    </div>
  )
}

function FlowNode({ label, icon, sub }) {
  return (
    <div className="rounded-2xl border border-admin-champ/25 bg-admin-champ/[0.06] p-4 w-[130px] shrink-0 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-4 h-4 text-admin-champ" /><p className="text-[10px] uppercase tracking-wider text-admin-champ/80">{label}</p></div>
      <p className="text-admin-muted/50 text-[11px]">{sub}</p>
    </div>
  )
}

function Connector({ highlight }) {
  return (
    <div className="flex items-center px-0.5 shrink-0">
      <div className={`h-0.5 w-4 rounded ${highlight ? 'bg-admin-champ/60' : 'bg-white/10'}`} />
      <Icon name="down" className={`w-4 h-4 -rotate-90 ${highlight ? 'text-admin-champ/60' : 'text-white/15'}`} />
    </div>
  )
}
