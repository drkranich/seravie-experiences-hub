import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Icon, GlassSelect } from '../../ui'
import { brl, methodLabel, printReceipt } from './pdvLib'

const PERIODS = [{ value: '1', label: 'Hoje' }, { value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]

// Histórico e relatório de vendas do PDV.
export function KdsPDVHistory({ kind = 'kitchen' }) {
  const [days, setDays] = useState('1')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - (Number(days) - 1)); since.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('kds_sales').select('*').eq('kind', kind).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(300)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [days, kind])

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.status === 'paid')
    const total = paid.reduce((s, r) => s + Number(r.total), 0)
    const byMethod = {}, byOp = {}
    paid.forEach((r) => {
      (r.payments || []).forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount) })
      const op = r.operator || 'Sem operador'; byOp[op] = (byOp[op] || 0) + Number(r.total)
    })
    return { count: paid.length, total, ticket: paid.length ? total / paid.length : 0, byMethod, byOp }
  }, [rows])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando vendas…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{stats.count} venda(s)</p>
        <div className="w-40"><GlassSelect value={days} onChange={setDays} options={PERIODS} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vendas" value={stats.count} />
        <Kpi label="Faturamento" value={brl(stats.total)} accent="champ" />
        <Kpi label="Ticket médio" value={brl(stats.ticket)} accent="gold" />
        <Kpi label="Formas" value={Object.keys(stats.byMethod).length} accent="sage" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Por forma de pagamento</p>
          {Object.keys(stats.byMethod).length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas.</p> : Object.entries(stats.byMethod).map(([m, v]) => <div key={m} className="flex justify-between py-1 text-sm"><span className="text-admin-muted/70">{methodLabel(m)}</span><span className="text-admin-text">{brl(v)}</span></div>)}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Por operador</p>
          {Object.keys(stats.byOp).length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas.</p> : Object.entries(stats.byOp).sort((a, b) => b[1] - a[1]).map(([o, v]) => <div key={o} className="flex justify-between py-1 text-sm"><span className="text-admin-muted/70">{o}</span><span className="text-admin-text">{brl(v)}</span></div>)}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((s) => (
          <div key={s.id} className="glass rounded-xl p-3.5 flex items-center gap-4 hover:bg-white/[0.03]">
            <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><span className="text-admin-champ text-xs font-medium">#{s.number}</span></div>
            <div className="min-w-0 flex-1">
              <p className="text-admin-text text-sm truncate">{(s.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
              <p className="text-admin-muted/50 text-[11px]">{new Date(s.created_at).toLocaleString('pt-BR')}{s.operator ? ` · ${s.operator}` : ''}{s.table_label ? ` · ${s.table_label}` : ''} · {(s.payments || []).map((p) => methodLabel(p.method)).join(', ')}</p>
            </div>
            <span className="text-admin-gold text-sm shrink-0">{brl(s.total)}</span>
            <button onClick={() => printReceipt(s)} className="p-2 rounded-lg text-admin-muted/50 hover:text-admin-champ shrink-0" title="Reimprimir"><Icon name="download" className="w-4 h-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/40 text-sm">Nenhuma venda no período.</div>}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent = 'text' }) {
  const tone = { text: 'text-admin-text', champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage' }[accent]
  return <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{label}</p><p className={`text-2xl font-medium tabular-nums ${tone}`}>{value}</p></div>
}
