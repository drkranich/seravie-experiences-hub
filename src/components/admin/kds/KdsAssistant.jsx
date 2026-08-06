import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

// IA operacional do KDS — RECOMENDA, nunca executa automaticamente.
// Gera sugestões a partir de heurísticas sobre os dados em tempo real:
// congestionamento, redistribuição, produtos problemáticos, previsão e eficiência.

const SEVERITY = {
  high: { icon: 'warning', tone: 'text-admin-rose', ring: 'border-admin-rose/30', chip: 'bg-admin-rose/15 text-admin-rose', label: 'Crítico' },
  medium: { icon: 'bolt', tone: 'text-[#D08A3E]', ring: 'border-[#D08A3E]/30', chip: 'bg-[#D08A3E]/15 text-[#D08A3E]', label: 'Atenção' },
  info: { icon: 'sparkles', tone: 'text-admin-champ', ring: 'border-admin-champ/25', chip: 'bg-admin-champ/15 text-admin-champ', label: 'Insight' },
}

function buildRecommendations({ tickets, stations, now }) {
  const recs = []
  const active = tickets.filter((t) => !['delivered', 'cancelled'].includes(t.status))
  const late = active.filter((t) => t.sla_seconds && elapsedSeconds(t.created_at, now) >= t.sla_seconds)

  // 1) Atrasos acima do SLA
  if (late.length > 0) {
    recs.push({
      severity: 'high', title: `${late.length} pedido(s) acima do SLA`,
      body: `Priorize agora: ${late.slice(0, 3).map((t) => t.reference).join(', ')}${late.length > 3 ? '…' : ''}. Considere puxar um operador para a estação mais carregada.`,
      tag: 'Redistribuição',
    })
  }

  // 2) Congestionamento por estação (carga > 85% da capacidade)
  stations.forEach((s) => {
    const q = active.filter((t) => t.station_id === s.id).length
    if (s.capacity && q / s.capacity >= 0.85 && q > 0) {
      recs.push({
        severity: 'medium', title: `Estação "${s.name}" congestionada`,
        body: `${q}/${s.capacity} em fila. Redistribua parte dos pedidos para uma estação ociosa ou adicione reforço.`,
        tag: 'Capacidade',
      })
    }
  })

  // 3) Pedidos sem estação atribuída
  const unassigned = active.filter((t) => !t.station_id)
  if (unassigned.length >= 3) {
    recs.push({
      severity: 'medium', title: `${unassigned.length} pedidos sem estação`,
      body: 'Atribua-os a estações para equilibrar a carga e medir o tempo por posto.',
      tag: 'Roteamento',
    })
  }

  // 4) Previsão de congestionamento (taxa de chegada na última janela)
  const last15 = tickets.filter((t) => elapsedSeconds(t.created_at, now) <= 15 * 60).length
  const capTotal = stations.reduce((a, s) => a + (s.capacity || 0), 0)
  if (last15 >= Math.max(4, capTotal * 0.5) && capTotal > 0) {
    recs.push({
      severity: 'medium', title: 'Pico de entrada detectado',
      body: `${last15} pedidos nos últimos 15 min. Nesse ritmo a capacidade (${capTotal}) satura em breve — prepare reforço.`,
      tag: 'Previsão',
    })
  }

  // 5) Produtos problemáticos (tempo médio alto)
  const done = tickets.filter((t) => t.delivered_at || t.ready_at)
  const prodTimes = {}
  done.forEach((t) => {
    const end = t.delivered_at || t.ready_at
    const sec = (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000
      ; (t.items || []).forEach((it) => { prodTimes[it.name] = prodTimes[it.name] || { s: 0, n: 0 }; prodTimes[it.name].s += sec; prodTimes[it.name].n++ })
  })
  const slow = Object.entries(prodTimes).map(([n, v]) => [n, v.s / v.n]).sort((a, b) => b[1] - a[1])[0]
  if (slow && slow[1] > 12 * 60) {
    recs.push({
      severity: 'info', title: `"${slow[0]}" está lento`,
      body: `Tempo médio de ${fmtMin(slow[1])}. Reavalie a ficha técnica, pré-preparo ou a estação responsável.`,
      tag: 'Produto',
    })
  }

  // 6) Tudo sob controle
  if (recs.length === 0) {
    recs.push({ severity: 'info', title: 'Produção sob controle', body: 'Nenhum gargalo detectado. Fluxo dentro dos tempos previstos.', tag: 'Status' })
  }
  return recs
}

export function KdsAssistant({ kind = 'kitchen' }) {
  const [tickets, setTickets] = useState([])
  const [stations, setStations] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').eq('kind', kind).gte('created_at', since.toISOString()),
      supabase.from('kds_stations').select('*').eq('active', true),
    ])
    setTickets(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(iv) }, [])

  const recs = useMemo(() => buildRecommendations({ tickets, stations, now }), [tickets, stations, now])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Analisando produção…</p>

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center"><Icon name="sparkles" className="w-5 h-5 text-admin-champ" /></div>
        <div>
          <p className="text-admin-text font-medium">Assistente de produção</p>
          <p className="text-admin-muted/50 text-sm">Recomendações em tempo real. As decisões são sempre suas — nada é executado automaticamente.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {recs.map((r, i) => {
          const s = SEVERITY[r.severity]
          return (
            <div key={i} className={`glass rounded-2xl p-4 border ${s.ring} animate-[fadeUp_0.4s_ease-out]`}>
              <div className="flex items-start gap-3">
                <Icon name={s.icon} className={`w-5 h-5 shrink-0 mt-0.5 ${s.tone}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-admin-text text-sm font-medium">{r.title}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg ${s.chip}`}>{r.tag}</span>
                  </div>
                  <p className="text-admin-muted/70 text-[13px] leading-snug">{r.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
