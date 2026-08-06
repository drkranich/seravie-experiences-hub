import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

const PERIODS = [{ value: '1', label: 'Hoje' }, { value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]

// Dashboard de Equipe — performance por operador (assignee): finalizados,
// tempo médio, eficiência, fila atual e comparativos. Genérico para qualquer Flow.
export function KdsTeam({ kind = 'kitchen' }) {
  const [days, setDays] = useState('7')
  const [rows, setRows] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - (Number(days) - 1)); since.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('kds_tickets').select('*').eq('kind', kind).gte('created_at', since.toISOString())
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [days, kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(iv) }, [])

  const team = useMemo(() => {
    const byOp = {}
    rows.forEach((t) => {
      const op = t.assignee || 'Sem responsável'
      byOp[op] = byOp[op] || { op, done: 0, cancelled: 0, active: 0, durSum: 0, durN: 0 }
      const b = byOp[op]
      if (t.status === 'delivered') b.done++
      else if (t.status === 'cancelled') b.cancelled++
      else b.active++
      const end = t.delivered_at || t.ready_at
      if (end) { b.durSum += (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000; b.durN++ }
    })
    return Object.values(byOp).map((b) => ({
      ...b,
      avg: b.durN ? b.durSum / b.durN : 0,
      eff: (b.done + b.cancelled) ? Math.round((b.done / (b.done + b.cancelled)) * 100) : 100,
    })).sort((a, b) => b.done - a.done)
  }, [rows])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando equipe…</p>
  const maxDone = Math.max(1, ...team.map((t) => t.done))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">Performance da equipe</p>
        <div className="w-40"><GlassSelect value={days} onChange={setDays} options={PERIODS} /></div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {team.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Sem dados no período. Atribua responsáveis aos pedidos para medir performance.</p>}
        {team.map((m) => (
          <div key={m.op} className="glass rounded-2xl p-5 animate-[fadeUp_0.4s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name="user" className="w-5 h-5 text-admin-champ" /></div>
              <div className="min-w-0">
                <p className="text-admin-text font-medium truncate">{m.op}</p>
                <p className="text-admin-muted/50 text-[11px]">{m.active} na fila agora</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Finalizados</p><p className="text-admin-sage text-lg font-medium tabular-nums">{m.done}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Tempo médio</p><p className="text-admin-gold text-lg font-medium tabular-nums">{m.avg ? fmtMin(m.avg) : '—'}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Eficiência</p><p className="text-admin-champ text-lg font-medium tabular-nums">{m.eff}%</p></div>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full bg-admin-champ/50 transition-[width] duration-700" style={{ width: `${(m.done / maxDone) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
