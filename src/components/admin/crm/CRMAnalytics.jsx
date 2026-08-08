import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { DEFAULT_STAGES } from '../../../lib/pipeline'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`
const BAR = ['bg-admin-champ', 'bg-admin-sage', 'bg-admin-gold', 'bg-admin-copper', 'bg-admin-rose']

function BarList({ rows, fmt = brl, color = 0 }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="text-admin-muted/40 text-sm py-3">Sem dados.</p>
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label + i}>
          <div className="flex justify-between text-xs mb-1"><span className="text-admin-muted/70 truncate">{r.label}</span><span className="text-admin-text shrink-0 ml-2">{fmt(r.value)}</span></div>
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden"><div className={`h-full ${BAR[(color + i) % BAR.length]} rounded-full`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

// CRM Analytics — dashboards de vendas e relacionamento sobre dados reais.
export function CRMAnalytics({ notify }) {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState([])
  const [contacts, setContacts] = useState([])
  const [stages, setStages] = useState(DEFAULT_STAGES)

  useEffect(() => { (async () => {
    setLoading(true)
    try {
      const [dRes, cRes, sRes] = await Promise.all([
        supabase.from('deals').select('id, title, value, stage, status, source, segment, owner_id, contact_id, created_at, closed_at').limit(4000),
        supabase.from('contacts').select('id, segment, source, city').limit(6000),
        supabase.from('pipeline_stages').select('key, label, sort_order').order('sort_order'),
      ])
      setDeals(dRes.data || [])
      setContacts(cRes.data || [])
      setStages(sRes.data && sRes.data.length ? sRes.data : DEFAULT_STAGES)
    } catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  })() }, [])

  const a = useMemo(() => {
    const won = deals.filter((d) => d.status === 'won')
    const lost = deals.filter((d) => d.status === 'lost')
    const open = deals.filter((d) => d.status !== 'won' && d.status !== 'lost')
    // origem do contato p/ cruzar cidade/segmento
    const cSeg = {}, cSrc = {}, cCity = {}
    contacts.forEach((c) => { cSeg[c.id] = c.segment; cSrc[c.id] = c.source; cCity[c.id] = c.city })

    const sumBy = (list, keyFn) => {
      const m = {}
      list.forEach((d) => { const k = keyFn(d) || '—'; m[k] = (m[k] || 0) + Number(d.value || 0) })
      return Object.entries(m).map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 8)
    }
    const countBy = (list, keyFn) => {
      const m = {}
      list.forEach((d) => { const k = keyFn(d) || '—'; m[k] = (m[k] || 0) + 1 })
      return m
    }

    // funil por etapa (contagem de negócios em cada etapa, ordem do funil)
    const stageOrder = (stages.length ? stages : DEFAULT_STAGES)
    const funnelCounts = countBy(deals.filter((d) => d.status !== 'lost'), (d) => d.stage)
    const funnel = stageOrder.filter((s) => !s.is_lost).map((s) => ({ key: s.key, label: s.label, count: funnelCounts[s.key] || 0 }))

    const winRate = (won.length + lost.length) ? (won.length / (won.length + lost.length)) * 100 : 0
    // ciclo médio de vendas (dias entre criação e fechamento dos ganhos)
    const cycles = won.filter((d) => d.closed_at).map((d) => (new Date(d.closed_at) - new Date(d.created_at)) / 86400000)
    const avgCycle = cycles.length ? cycles.reduce((s, x) => s + x, 0) / cycles.length : 0

    return {
      totalDeals: deals.length, wonValue: won.reduce((s, d) => s + Number(d.value || 0), 0),
      openValue: open.reduce((s, d) => s + Number(d.value || 0), 0), winRate, avgCycle,
      bySource: sumBy(deals, (d) => d.source === 'manual' ? 'Manual' : d.source === 'flow' ? 'Formulário' : (d.source || '—')),
      bySegment: sumBy(deals, (d) => d.segment || cSeg[d.contact_id] || 'sem segmento'),
      byCity: sumBy(deals, (d) => cCity[d.contact_id] || 'sem cidade'),
      wonBySource: sumBy(won, (d) => d.source === 'manual' ? 'Manual' : (d.source || '—')),
      funnel,
    }
  }, [deals, contacts, stages])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Calculando analytics do CRM…</p>

  const funnelMax = Math.max(1, ...a.funnel.map((f) => f.count))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Negócios" value={a.totalDeals} icon="chart" />
        <Stat label="Ganho (fechado)" value={brl(a.wonValue)} icon="check" />
        <Stat label="Win rate" value={pct(a.winRate)} icon="star" />
        <Stat label="Ciclo médio" value={`${Math.round(a.avgCycle)} dias`} icon="clock" />
      </div>

      {/* Funil de conversão */}
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Funil de conversão</p>
        <div className="space-y-2">
          {a.funnel.map((f, i) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-admin-muted/60 text-xs w-36 shrink-0 truncate">{f.label}</span>
              <div className="flex-1 h-7 rounded-lg bg-white/[0.03] overflow-hidden"><div className={`h-full ${BAR[i % BAR.length]} rounded-lg flex items-center justify-end pr-2`} style={{ width: `${Math.max(5, (f.count / funnelMax) * 100)}%` }}><span className="text-[10px] text-admin-bg font-medium">{f.count}</span></div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Valor por origem"><BarList rows={a.bySource} color={0} /></Card>
        <Card title="Valor por segmento"><BarList rows={a.bySegment} color={1} /></Card>
        <Card title="Valor por cidade"><BarList rows={a.byCity} color={2} /></Card>
        <Card title="Ganho por origem"><BarList rows={a.wonBySource} color={3} /></Card>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-3.5 h-3.5 text-admin-champ/50" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-2xl font-serif">{value}</p>
    </div>
  )
}
function Card({ title, children }) {
  return <div className="glass rounded-2xl p-5"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">{title}</p>{children}</div>
}
