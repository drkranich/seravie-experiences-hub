import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassMonth } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const todayStr = () => new Date().toISOString().slice(0, 10)

// ---------------- Contas a Pagar / Receber ----------------
export function PayablesPanel({ notify }) {
  const { profile, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayManage = canManage ? canManage('finance') : true
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('receivable') // receivable | payable

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('financial_entries').select('*').eq('status', 'pending').order('due_date', { ascending: true })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const settle = async (e) => {
    const { error } = await supabase.from('financial_entries').update({ status: 'paid', date: todayStr() }).eq('id', e.id)
    if (error) return notify('Erro ao baixar: ' + error.message, 'error')
    logAudit({ action: 'update', resource_type: 'financial_entries', resource_id: e.id, new_data: { settled: true } }, tenantId)
    notify(e.type === 'revenue' ? 'Recebimento baixado' : 'Pagamento baixado', 'success'); load()
  }

  const isRev = tab === 'receivable'
  const list = rows.filter((e) => (isRev ? e.type === 'revenue' : e.type === 'expense'))
  const total = list.reduce((s, e) => s + Number(e.amount || 0), 0)
  const overdue = list.filter((e) => e.due_date && e.due_date < todayStr())
  const overdueTotal = overdue.reduce((s, e) => s + Number(e.amount || 0), 0)
  const next7 = list.filter((e) => e.due_date && e.due_date >= todayStr() && e.due_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10))

  const exportRows = () => list.map((e) => ({ Vencimento: e.due_date ? new Date(e.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—', Descrição: e.description || e.category, Categoria: e.category, Valor: brl(e.amount) }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Contas</h1><p className="text-admin-muted/60 text-sm mt-1">A receber e a pagar — vencimentos e baixas</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(`contas-${tab}.csv`, exportRows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(isRev ? 'Contas a receber' : 'Contas a pagar', exportRows(), `Total ${brl(total)}`) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['receivable', 'A receber'], ['payable', 'A pagar']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total {isRev ? 'a receber' : 'a pagar'}</p><p className={`text-2xl font-medium ${isRev ? 'text-admin-sage' : 'text-admin-rose'}`}>{brl(total)}</p><p className="text-admin-muted/40 text-xs mt-1">{list.length} títulos</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Vencidas</p><p className="text-admin-rose text-2xl font-medium">{brl(overdueTotal)}</p><p className="text-admin-muted/40 text-xs mt-1">{overdue.length} títulos</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Próx. 7 dias</p><p className="text-admin-gold text-2xl font-medium">{next7.length}</p></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="chart" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum título {isRev ? 'a receber' : 'a pagar'}. Lance com situação "{isRev ? 'A receber' : 'A pagar'}" no Financeiro.</p></div>
      ) : (
        <div className="space-y-2">{list.map((e) => {
          const isOverdue = e.due_date && e.due_date < todayStr()
          return (
            <div key={e.id} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
              <div className={`w-1.5 h-8 rounded-full shrink-0 ${isOverdue ? 'bg-admin-rose' : isRev ? 'bg-admin-sage/60' : 'bg-admin-gold/60'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-admin-text text-sm truncate">{e.description || e.category}</p>
                <div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs capitalize">{e.category}</span>{e.due_date && <span className={`text-xs ${isOverdue ? 'text-admin-rose' : 'text-admin-muted/40'}`}>vence {new Date(e.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}{isOverdue ? ' · vencida' : ''}</span>}</div>
              </div>
              <p className={`text-sm font-medium shrink-0 ${isRev ? 'text-admin-sage' : 'text-admin-rose'}`}>{brl(e.amount)}</p>
              <button onClick={() => settle(e)} className="text-xs text-admin-champ hover:underline shrink-0">{isRev ? 'receber' : 'pagar'} ✓</button>
            </div>
          )
        })}</div>
      )}
    </div>
  )
}

// ---------------- DRE (Demonstrativo simples) ----------------
export function DrePanel({ notify }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(ym(new Date()))

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('financial_entries').select('*').eq('status', 'paid').order('date', { ascending: false }).limit(2000)
      setEntries(data || []); setLoading(false)
    })()
  }, [])

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => (e.date || '').slice(0, 7)).filter(Boolean))
    set.add(ym(new Date()))
    return [...set].sort().reverse()
  }, [entries])

  const mEntries = entries.filter((e) => (e.date || '').slice(0, 7) === month)
  const catAgg = (type) => {
    const m = {}
    mEntries.filter((e) => e.type === type).forEach((e) => { m[e.category || 'outro'] = (m[e.category || 'outro'] || 0) + Number(e.amount || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const revenue = mEntries.filter((e) => e.type === 'revenue').reduce((s, e) => s + Number(e.amount || 0), 0)
  const expense = mEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0)
  const result = revenue - expense
  const margin = revenue ? Math.round((result / revenue) * 100) : 0

  const exportRows = () => [
    ...catAgg('revenue').map(([c, v]) => ({ Grupo: 'Receita', Categoria: c, Valor: brl(v) })),
    { Grupo: '', Categoria: 'RECEITA TOTAL', Valor: brl(revenue) },
    ...catAgg('expense').map(([c, v]) => ({ Grupo: 'Despesa', Categoria: c, Valor: brl(v) })),
    { Grupo: '', Categoria: 'DESPESA TOTAL', Valor: brl(expense) },
    { Grupo: '', Categoria: 'RESULTADO', Valor: brl(result) },
  ]

  const Line = ({ label, value, tone = 'text-admin-text', bold }) => (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'border-t border-white/[0.08] mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${bold ? 'font-medium ' + tone : 'text-admin-muted/70'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-medium ' + tone : tone}`}>{value}</span>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">DRE</h1><p className="text-admin-muted/60 text-sm mt-1">Demonstrativo de resultado do mês (regime de caixa)</p></div>
        <div className="flex items-center gap-2">
          <GlassMonth value={month} onChange={setMonth} />
          <button onClick={() => exportCsv(`dre-${month}.csv`, exportRows()) || notify('Sem dados', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(`DRE ${month}`, exportRows(), `Resultado ${brl(result)}`) || notify('Sem dados', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Receita</p><p className="text-admin-sage text-2xl font-medium">{brl(revenue)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Despesa</p><p className="text-admin-rose text-2xl font-medium">{brl(expense)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Resultado</p><p className={`text-2xl font-medium ${result >= 0 ? 'text-admin-champ' : 'text-admin-rose'}`}>{brl(result)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Margem</p><p className={`text-2xl font-medium ${margin >= 0 ? 'text-admin-champ' : 'text-admin-rose'}`}>{margin}%</p></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <div className="glass rounded-2xl p-6 max-w-2xl">
          <p className="text-[11px] tracking-wider uppercase text-admin-sage/70 mb-2">Receitas</p>
          {catAgg('revenue').length === 0 ? <p className="text-admin-muted/40 text-xs mb-2">Sem receitas</p> : catAgg('revenue').map(([c, v]) => <Line key={c} label={<span className="capitalize">{c}</span>} value={brl(v)} tone="text-admin-sage/90" />)}
          <Line label="Receita total" value={brl(revenue)} tone="text-admin-sage" bold />

          <p className="text-[11px] tracking-wider uppercase text-admin-rose/70 mb-2 mt-5">Despesas</p>
          {catAgg('expense').length === 0 ? <p className="text-admin-muted/40 text-xs mb-2">Sem despesas</p> : catAgg('expense').map(([c, v]) => <Line key={c} label={<span className="capitalize">{c}</span>} value={brl(v)} tone="text-admin-rose/90" />)}
          <Line label="Despesa total" value={brl(expense)} tone="text-admin-rose" bold />

          <div className="mt-4 pt-3 border-t border-white/[0.1] flex items-center justify-between">
            <span className="text-admin-text font-medium">Resultado líquido</span>
            <span className={`font-serif text-2xl ${result >= 0 ? 'text-admin-champ' : 'text-admin-rose'}`}>{brl(result)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
