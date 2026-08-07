import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

// Chat conversacional com a IA de produção (edge function cuisine-ai).
function AssistantChat({ kind }) {
  const [msgs, setMsgs] = useState([])       // { role, content }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const SUGGESTIONS = [
    'Analise a produção agora e dê 3 recomendações',
    'Onde está o gargalo?',
    'Como reduzir o tempo médio?',
    'Que produtos estão atrasando a cozinha?',
  ]

  const ask = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    const history = msgs.slice(-6)
    setMsgs((m) => [...m, { role: 'user', content: q }]); setInput(''); setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('cuisine-ai', { body: { message: q, kind, history } })
      if (error) throw error
      if (data?.configured === false) setWarn(data.reply)
      setMsgs((m) => [...m, { role: 'assistant', content: data?.reply || 'Não consegui responder agora.' }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Erro ao consultar a IA. Tente novamente.' }])
    }
    setBusy(false)
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col" style={{ minHeight: 340 }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="sparkles" className="w-4 h-4 text-admin-champ" />
        <p className="text-admin-text text-sm font-medium">Converse com a IA</p>
        <span className="text-[10px] text-admin-muted/40">contexto da produção em tempo real</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 max-h-[46vh] pr-1">
        {msgs.length === 0 && (
          <div className="text-center py-6">
            <p className="text-admin-muted/40 text-sm mb-3">Pergunte sobre a operação. Sugestões:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-champ/80 hover:bg-admin-champ/15">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-admin-champ/15 text-admin-text' : 'bg-white/[0.05] text-admin-muted'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-white/[0.05] rounded-2xl px-3.5 py-2.5 text-sm text-admin-muted/60">pensando…</div></div>}
        <div ref={endRef} />
      </div>

      {warn && <p className="text-[11px] text-admin-gold/80 mb-2">{warn}</p>}
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Pergunte à IA da produção…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
        <button onClick={() => ask()} disabled={busy} className="px-4 rounded-xl bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ text-sm disabled:opacity-50"><Icon name="up" className="w-4 h-4 rotate-45" /></button>
      </div>
    </div>
  )
}

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
          <p className="text-admin-text font-medium">Assistente de produção · IA</p>
          <p className="text-admin-muted/50 text-sm">Recomendações automáticas + converse com a IA (respostas reais com o contexto da sua produção). As decisões são sempre suas.</p>
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

      {/* Chat com a IA (respostas reais com contexto da produção) */}
      <AssistantChat kind={kind} />
    </div>
  )
}
