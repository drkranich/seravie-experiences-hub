import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { fmtMin } from '../../../lib/flowEngine'

// Barra de ranking animada (reutiliza o padrão do Flow).
function RankRow({ label, value, max, display, accent = 'champ' }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setW(max > 0 ? Math.max(4, (value / max) * 100) : 0)); return () => cancelAnimationFrame(id) }, [value, max])
  const bar = { champ: 'bg-admin-champ/50', gold: 'bg-admin-gold/50', sage: 'bg-admin-sage/50', rose: 'bg-admin-rose/50', copper: 'bg-admin-copper/50' }[accent]
  const txt = { champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', rose: 'text-admin-rose', copper: 'text-admin-copper' }[accent]
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-admin-text text-sm truncate">{label}</span>
        <span className={`text-sm shrink-0 ${txt}`}>{display != null ? display : value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden"><div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${w}%` }} /></div>
    </div>
  )
}

const PERIODS = [
  { value: '1', label: 'Hoje' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
]

export function KdsAnalytics({ kind = 'kitchen' }) {
  const [days, setDays] = useState('7')
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - (Number(days) - 1)); since.setHours(0, 0, 0, 0)
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').eq('kind', kind).gte('created_at', since.toISOString()),
      supabase.from('kds_stations').select('id, name').order('sort_order'),
    ])
    setRows(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load() }, [days, kind])

  const a = useMemo(() => {
    const done = rows.filter((t) => t.delivered_at || t.ready_at)
    const cancelled = rows.filter((t) => t.status === 'cancelled')
    const durations = done.map((t) => {
      const end = t.delivered_at || t.ready_at
      return { t, sec: (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000 }
    })
    const avg = durations.length ? durations.reduce((s, d) => s + d.sec, 0) / durations.length : 0
    const max = durations.length ? Math.max(...durations.map((d) => d.sec)) : 0
    // produtos
    const byProduct = {}
    rows.forEach((t) => (t.items || []).forEach((it) => { byProduct[it.name] = (byProduct[it.name] || 0) + (it.qty || 1) }))
    const topProducts = Object.entries(byProduct).sort((x, y) => y[1] - x[1]).slice(0, 6)
    // produtos "problemáticos": maior tempo médio de produção
    const prodTimes = {}
    durations.forEach((d) => (d.t.items || []).forEach((it) => {
      prodTimes[it.name] = prodTimes[it.name] || { sum: 0, n: 0 }
      prodTimes[it.name].sum += d.sec; prodTimes[it.name].n++
    }))
    const slowest = Object.entries(prodTimes).map(([n, v]) => [n, v.sum / v.n]).sort((x, y) => y[1] - x[1]).slice(0, 5)
    // estações
    const byStation = stations.map((s) => [s.name, rows.filter((t) => t.station_id === s.id).length]).sort((x, y) => y[1] - x[1])
    // canais
    const byChannel = {}
    rows.forEach((t) => { byChannel[t.channel || 'manual'] = (byChannel[t.channel || 'manual'] || 0) + 1 })
    // heatmap dia x hora (0..6 x 0..23)
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0))
    rows.forEach((t) => { const d = new Date(t.created_at); heat[d.getDay()][d.getHours()]++ })
    return { total: rows.length, done: done.length, cancelled: cancelled.length, avg, max, topProducts, slowest, byStation, byChannel, heat }
  }, [rows, stations])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando analytics…</p>
  const maxProd = Math.max(1, ...a.topProducts.map((x) => x[1]))
  const maxSlow = Math.max(1, ...a.slowest.map((x) => x[1]))
  const maxStation = Math.max(1, ...a.byStation.map((x) => x[1]))
  const heatMax = Math.max(1, ...a.heat.flat())
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const eff = a.total ? Math.round((a.done / (a.done + a.cancelled || 1)) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">Análise de produção</p>
        <div className="w-48"><GlassSelect value={days} onChange={setDays} options={PERIODS} /></div>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Pedidos', a.total, 'champ'], ['Finalizados', a.done, 'sage'], ['Cancelados', a.cancelled, 'rose'], ['Tempo médio', fmtMin(a.avg), 'gold'], ['Tempo máximo', fmtMin(a.max), 'copper']].map(([l, v, c]) => (
          <div key={l} className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{l}</p>
            <p className={`text-2xl font-medium tabular-nums ${{ champ: 'text-admin-champ', sage: 'text-admin-sage', rose: 'text-admin-rose', gold: 'text-admin-gold', copper: 'text-admin-copper' }[c]}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Produtos mais produzidos</p>
          {a.topProducts.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem dados no período.</p> : a.topProducts.map(([n, v]) => <RankRow key={n} label={n} value={v} max={maxProd} display={`${v} un`} accent="champ" />)}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-rose/70 mb-3">Mais lentos (tempo médio)</p>
          {a.slowest.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem dados no período.</p> : a.slowest.map(([n, v]) => <RankRow key={n} label={n} value={v} max={maxSlow} display={fmtMin(v)} accent="rose" />)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Carga por estação</p>
          {a.byStation.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem estações.</p> : a.byStation.map(([n, v]) => <RankRow key={n} label={n} value={v} max={maxStation} display={`${v}`} accent="gold" />)}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Origem dos pedidos</p>
          {Object.entries(a.byChannel).map(([c, v]) => <RankRow key={c} label={{ pdv: 'PDV', flow: 'Flow QR', delivery: 'Delivery', manual: 'Manual' }[c] || c} value={v} max={Math.max(1, ...Object.values(a.byChannel))} display={`${v}`} accent="sage" />)}
        </div>
      </div>

      {/* Heatmap de produção (dia da semana x hora) */}
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Heatmap de produção · dia × hora</p>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="flex gap-0.5 mb-1 pl-10">
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="flex-1 text-center text-[8px] text-admin-muted/30">{h % 3 === 0 ? `${h}h` : ''}</div>)}
            </div>
            {a.heat.map((row, d) => (
              <div key={d} className="flex gap-0.5 items-center mb-0.5">
                <div className="w-10 text-[10px] text-admin-muted/50 shrink-0">{DOW[d]}</div>
                {row.map((v, h) => {
                  const intensity = v / heatMax
                  return <div key={h} className="flex-1 aspect-square rounded-sm" title={`${DOW[d]} ${h}h · ${v} pedido(s)`} style={{ background: v === 0 ? 'rgba(255,255,255,0.03)' : `rgba(220,203,167,${0.15 + intensity * 0.7})` }} />
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
