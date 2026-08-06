import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { getPreset, elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

// Card de métrica premium (glassmorphism fumê, número grande, ícone elegante).
function StatCard({ label, value, icon, accent = 'champ', hint }) {
  const tone = {
    champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage',
    rose: 'text-admin-rose', copper: 'text-admin-copper', muted: 'text-admin-muted',
  }[accent] || 'text-admin-champ'
  const ring = {
    champ: 'bg-admin-champ/10', gold: 'bg-admin-gold/10', sage: 'bg-admin-sage/10',
    rose: 'bg-admin-rose/10', copper: 'bg-admin-copper/10', muted: 'bg-white/[0.05]',
  }[accent] || 'bg-admin-champ/10'
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-colors animate-[fadeUp_0.5s_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">{label}</p>
          <p className={`text-3xl font-medium ${tone} tabular-nums leading-none`}>{value}</p>
          {hint && <p className="text-admin-muted/40 text-[11px] mt-1.5">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${ring} flex items-center justify-center shrink-0`}><Icon name={icon} className={`w-5 h-5 ${tone}`} /></div>
      </div>
    </div>
  )
}

// Barra horizontal elegante (usada em fila por estação e pedidos por hora).
function Meter({ label, value, max, sub, accent = 'champ' }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0
  const bar = { champ: 'bg-admin-champ/50', gold: 'bg-admin-gold/50', sage: 'bg-admin-sage/50', rose: 'bg-admin-rose/50', copper: 'bg-admin-copper/50' }[accent] || 'bg-admin-champ/50'
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-admin-text truncate">{label}</span>
        <span className="text-admin-muted/60 tabular-nums text-xs">{sub}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function KdsDashboard({ kind = 'kitchen' }) {
  const preset = getPreset(kind)
  const [tickets, setTickets] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').eq('kind', kind).gte('created_at', since.toISOString()).order('created_at'),
      supabase.from('kds_stations').select('*').eq('active', true).order('sort_order'),
    ])
    setTickets(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])

  const s = useMemo(() => {
    const all = tickets
    const active = all.filter((t) => !['delivered', 'cancelled'].includes(t.status))
    const done = all.filter((t) => t.status === 'delivered')
    const cancelled = all.filter((t) => t.status === 'cancelled')
    const inProd = all.filter((t) => ['preparing', 'waiting', 'assembly', 'review'].includes(t.status))
    const late = active.filter((t) => t.sla_seconds && elapsedSeconds(t.created_at, now) >= t.sla_seconds)
    // tempo médio de produção (entrada -> pronto/entregue)
    const times = done.map((t) => {
      const end = t.delivered_at || t.ready_at
      return end ? (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000 : null
    }).filter(Boolean)
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
    const maxWait = active.length ? Math.max(...active.map((t) => elapsedSeconds(t.created_at, now))) : 0
    const eff = all.length ? Math.round((done.length / (done.length + cancelled.length || 1)) * 100) : 0
    // fila por estação
    const byStation = stations.map((st) => ({ st, n: active.filter((t) => t.station_id === st.id).length }))
    const unassigned = active.filter((t) => !t.station_id).length
    // pedidos por hora
    const byHour = Array(24).fill(0); all.forEach((t) => { byHour[new Date(t.created_at).getHours()]++ })
    const capUsed = active.length
    const capTotal = stations.reduce((a, st) => a + (st.capacity || 0), 0) || 1
    return { total: all.length, active: active.length, inProd: inProd.length, done: done.length, cancelled: cancelled.length, late: late.length, avg, maxWait, eff, byStation, unassigned, byHour, capUsed, capTotal }
  }, [tickets, stations, now])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando dashboard…</p>
  const maxHour = Math.max(1, ...s.byHour)
  const peak = s.byHour.indexOf(Math.max(...s.byHour))
  const maxStationQ = Math.max(1, ...s.byStation.map((x) => x.n), s.unassigned)

  return (
    <div className="space-y-5">
      {/* Alertas em destaque */}
      {(s.late > 0 || s.unassigned > 0) && (
        <div className="glass rounded-2xl p-4 border border-admin-rose/25 flex flex-wrap items-center gap-4">
          <Icon name="warning" className="w-5 h-5 text-admin-rose" />
          {s.late > 0 && <span className="text-admin-rose text-sm">{s.late} pedido(s) acima do tempo (SLA)</span>}
          {s.unassigned > 0 && <span className="text-admin-gold text-sm">{s.unassigned} sem estação atribuída</span>}
        </div>
      )}

      {/* KPIs premium */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pedidos hoje" value={s.total} icon="grid" accent="champ" />
        <StatCard label="Em produção" value={s.inProd} icon="flame" accent="copper" />
        <StatCard label="Finalizados" value={s.done} icon="sparkles" accent="sage" />
        <StatCard label="Atrasados" value={s.late} icon="warning" accent="rose" />
        <StatCard label="Tempo médio" value={fmtMin(s.avg)} icon="clock" accent="gold" hint="entrada → pronto" />
        <StatCard label="Maior espera" value={fmtMin(s.maxWait)} icon="bolt" accent="rose" />
        <StatCard label="Eficiência" value={`${s.eff}%`} icon="chart" accent="sage" hint="finalizados / total" />
        <StatCard label="Capacidade" value={`${s.capUsed}/${s.capTotal}`} icon="layers" accent="champ" hint="em produção / total" />
      </div>

      {/* Fila por estação + Pedidos por hora */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Fila por estação</p>
          {s.byStation.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhuma estação ativa.</p> : (
            <>
              {s.byStation.map(({ st, n }) => (
                <Meter key={st.id} label={st.name} value={n} max={maxStationQ} sub={`${n} na fila · cap. ${st.capacity || '—'}`} accent="champ" />
              ))}
              {s.unassigned > 0 && <Meter label="Sem estação" value={s.unassigned} max={maxStationQ} sub={`${s.unassigned} aguardando`} accent="gold" />}
            </>
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Pedidos por hora</p>
            {s.total > 0 && <p className="text-admin-muted/40 text-xs">Pico às {String(peak).padStart(2, '0')}h</p>}
          </div>
          <div className="flex items-end gap-1 h-32">
            {s.byHour.map((v, h) => (
              <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}h · ${v} pedido(s)`}>
                <div className="w-full rounded-t bg-admin-champ/50 transition-[height] duration-700 ease-out" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v > 0 ? 3 : 0 }} />
                {h % 6 === 0 && <span className="text-[8px] text-admin-muted/30 mt-1">{h}h</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
