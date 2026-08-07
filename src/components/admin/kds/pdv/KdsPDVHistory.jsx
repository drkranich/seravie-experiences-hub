import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Icon, GlassSelect, GlassMonth, matchPeriod } from '../../ui'
import { brl, methodLabel, printReceipt, cancelSale, PAYMENT_METHODS } from './pdvLib'
import { printSalesReport } from './pdvReport'

const pad2 = (n) => String(n).padStart(2, '0')
const todayMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }

// Histórico, relatórios e cancelamento de vendas do PDV.
export function KdsPDVHistory({ kind = 'kitchen', notify }) {
  const [period, setPeriod] = useState(todayMonth()) // GlassMonth: 'YYYY-MM' ou 'YYYY-MM-DD'
  const [operator, setOperator] = useState('')
  const [method, setMethod] = useState('')
  const [rows, setRows] = useState([])
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // venda a cancelar

  // Carrega um range amplo (o mês/dia é filtrado no cliente via matchPeriod).
  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - 90); since.setHours(0, 0, 0, 0)
    const [{ data }, { data: ops }] = await Promise.all([
      supabase.from('kds_sales').select('*').eq('kind', kind).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(1000),
      supabase.from('kds_operators').select('name').eq('kind', kind).order('sort_order'),
    ])
    setRows(data || []); setOperators(ops || []); setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  const filtered = useMemo(() => rows.filter((r) => {
    if (!matchPeriod(r.created_at, period)) return false
    if (operator && (r.operator || '') !== operator) return false
    if (method && !(r.payments || []).some((p) => p.method === method)) return false
    return true
  }), [rows, period, operator, method])

  const stats = useMemo(() => {
    const paid = filtered.filter((r) => r.status !== 'void')
    const total = paid.reduce((s, r) => s + Number(r.total), 0)
    const byMethod = {}, byOp = {}
    paid.forEach((r) => {
      (r.payments || []).forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount) })
      const op = r.operator || 'Sem operador'; byOp[op] = (byOp[op] || 0) + Number(r.total)
    })
    return { count: paid.length, total, ticket: paid.length ? total / paid.length : 0, voided: filtered.length - paid.length, byMethod, byOp }
  }, [filtered])

  const rangeLabel = () => (String(period).length === 10
    ? new Date(period + 'T00:00:00').toLocaleDateString('pt-BR')
    : new Date(period + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

  const doCancel = async () => {
    const res = await cancelSale(confirm, { reason: 'cancelado no PDV' })
    setConfirm(null)
    if (res.error) return notify?.('Erro ao cancelar: ' + res.error, 'error')
    notify?.(`Venda #${confirm.number} cancelada`, 'success'); load()
  }
  const genPdf = () => { if (!printSalesReport(filtered, { rangeLabel: rangeLabel(), operator, method })) notify?.('Permita pop-ups para gerar o PDF', 'error') }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando vendas…</p>

  return (
    <div className="space-y-4">
      {/* Filtros: calendário glassmorphism + operador + pagamento + PDF */}
      <div className="glass rounded-2xl p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Período</label>
          <GlassMonth value={period} onChange={(v) => setPeriod(v)} />
        </div>
        <div className="min-w-40">
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Operador</label>
          <GlassSelect value={operator} onChange={setOperator} options={[{ value: '', label: 'Todos' }, ...operators.map((o) => ({ value: o.name, label: o.name }))]} />
        </div>
        <div className="min-w-36">
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Pagamento</label>
          <GlassSelect value={method} onChange={setMethod} options={[{ value: '', label: 'Todos' }, ...PAYMENT_METHODS.map((p) => ({ value: p.value, label: p.label }))]} />
        </div>
        <button onClick={genPdf} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2.5 rounded-xl text-sm ml-auto"><Icon name="download" className="w-4 h-4" />Relatório PDF</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vendas" value={stats.count} />
        <Kpi label="Faturamento" value={brl(stats.total)} accent="champ" />
        <Kpi label="Ticket médio" value={brl(stats.ticket)} accent="gold" />
        <Kpi label="Canceladas" value={stats.voided} accent="rose" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/40 text-sm">Nenhuma venda no filtro.</div>}
        {filtered.map((s) => {
          const voided = s.status === 'void'
          return (
            <div key={s.id} className={`glass rounded-xl p-3.5 flex items-center gap-4 hover:bg-white/[0.03] ${voided ? 'opacity-55' : ''}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${voided ? 'bg-admin-rose/10' : 'bg-admin-champ/10'}`}><span className={`text-xs font-medium ${voided ? 'text-admin-rose' : 'text-admin-champ'}`}>#{s.number}</span></div>
              <div className="min-w-0 flex-1">
                <p className={`text-admin-text text-sm truncate ${voided ? 'line-through' : ''}`}>{(s.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                <p className="text-admin-muted/50 text-[11px]">{new Date(s.created_at).toLocaleString('pt-BR')}{s.operator ? ` · ${s.operator}` : ''}{s.table_label ? ` · ${s.table_label}` : ''} · {(s.payments || []).map((p) => methodLabel(p.method)).join(', ')}{voided ? ' · CANCELADA' : ''}</p>
              </div>
              <span className={`text-sm shrink-0 ${voided ? 'text-admin-muted/50' : 'text-admin-gold'}`}>{brl(s.total)}</span>
              <button onClick={() => printReceipt(s)} className="p-2 rounded-lg text-admin-muted/50 hover:text-admin-champ shrink-0" title="Reimprimir"><Icon name="download" className="w-4 h-4" /></button>
              {!voided && <button onClick={() => setConfirm(s)} className="p-2 rounded-lg text-admin-muted/50 hover:text-admin-rose shrink-0" title="Cancelar venda"><Icon name="x" className="w-4 h-4" /></button>}
            </div>
          )
        })}
      </div>

      {/* Confirmação de cancelamento */}
      {confirm && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-admin-text mb-2">Cancelar venda #{confirm.number}?</h3>
            <p className="text-admin-muted/70 text-sm mb-1">Total: {brl(confirm.total)}</p>
            <p className="text-admin-muted/50 text-[13px] mb-6">Isto estorna o caixa, cancela o pedido na cozinha (se enviado) e devolve o estoque. Não pode ser desfeito.</p>
            <div className="flex gap-3">
              <button onClick={doCancel} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm">Cancelar venda</button>
              <button onClick={() => setConfirm(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, accent = 'text' }) {
  const tone = { text: 'text-admin-text', champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', rose: 'text-admin-rose' }[accent]
  return <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{label}</p><p className={`text-2xl font-medium tabular-nums ${tone}`}>{value}</p></div>
}
