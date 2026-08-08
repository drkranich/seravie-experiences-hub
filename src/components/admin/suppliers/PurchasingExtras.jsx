import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { SUPPLIER_CATEGORIES, brl } from '../../../lib/suppliersMarket'

// ── Analytics de Compras ──────────────────────────────────────────────────────
export function PurchasingAnalytics({ suppliers }) {
  const [pos, setPos] = useState([])
  const [rfqs, setRfqs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('purchase_orders').select('*').limit(500),
        supabase.from('rfqs').select('*, rfq_suppliers(price,status)').limit(200),
      ])
      if (!alive) return
      setPos(p || []); setRfqs(r || []); setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const totalSpent = pos.reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const orderCount = pos.length

  // economia: soma (maior proposta - proposta vencedora) por RFQ com respostas
  const savings = useMemo(() => rfqs.reduce((acc, r) => {
    const prices = (r.rfq_suppliers || []).map((x) => Number(x.price)).filter((n) => n > 0)
    if (prices.length < 2) return acc
    const win = (r.rfq_suppliers || []).find((x) => x.status === 'awarded')
    const chosen = win?.price ? Number(win.price) : Math.min(...prices)
    return acc + (Math.max(...prices) - chosen)
  }, 0), [rfqs])

  // melhor fornecedor por volume de pedidos
  const topSupplier = useMemo(() => {
    const m = {}; pos.forEach((o) => { if (o.supplier_id) m[o.supplier_id] = (m[o.supplier_id] || 0) + (Number(o.amount) || 0) })
    const best = Object.entries(m).sort((a, b) => b[1] - a[1])[0]
    return best ? { name: supplierById[best[0]]?.name || 'Fornecedor', total: best[1] } : null
  }, [pos, supplierById])

  const Kpi = ({ label, value, sub }) => <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50">{label}</p><p className="text-admin-text text-2xl font-serif mt-1">{value}</p>{sub && <p className="text-admin-muted/40 text-xs mt-1">{sub}</p>}</div>

  if (loading) return <p className="text-admin-muted/40 text-sm py-12 text-center">Carregando analytics…</p>

  return (
    <div>
      <h1 className="font-serif text-2xl text-admin-text mb-1">Analytics de Compras</h1>
      <p className="text-admin-muted/50 text-sm mb-6">Seus indicadores de compras no marketplace.</p>
      {orderCount === 0 && rfqs.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="chart" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Ainda sem dados de compra.</p><p className="text-admin-muted/35 text-xs mt-1">Crie cotações e converta em pedidos para ver os indicadores.</p></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi label="Total comprado" value={brl(totalSpent)} sub={`${orderCount} pedidos`} />
            <Kpi label="Economia estimada" value={brl(savings)} sub="via cotações" />
            <Kpi label="Cotações" value={String(rfqs.length)} />
            <Kpi label="Melhor fornecedor" value={topSupplier?.name || '—'} sub={topSupplier ? brl(topSupplier.total) : ''} />
          </div>
          {pos.length > 0 && (
            <div className="glass-soft rounded-2xl p-5">
              <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-4">Pedidos recentes</h3>
              <div className="space-y-2">
                {pos.slice(0, 10).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-admin-text/80 truncate">{o.title || 'Pedido'} · <span className="text-admin-muted/40">{supplierById[o.supplier_id]?.name || '—'}</span></span>
                    <span className="text-admin-champ shrink-0 ml-3">{o.amount ? brl(o.amount) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── IA de Compras ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Qual o melhor fornecedor de iluminação para uma cafeteria?',
  'Compare prazo e homologação dos fornecedores de mobiliário.',
  'Onde tenho risco de ruptura nas minhas compras?',
  'Sugira fornecedores para montar uma chocolateria.',
]

export function PurchasingAI({ notify }) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [configured, setConfigured] = useState(null)

  const ask = async (question) => {
    const text = (question || q).trim()
    if (!text) return
    setLoading(true); setAnswer(null)
    try {
      const { data, error } = await supabase.functions.invoke('suppliers-ai', { body: { question: text } })
      if (error) { notify?.('IA indisponível: ' + error.message, 'error'); setLoading(false); return }
      setAnswer(data?.reply || 'Sem resposta.')
      setConfigured(data?.configured ?? null)
    } catch (e) { notify?.('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-admin-champ/12 flex items-center justify-center"><Icon name="sparkles" className="w-5 h-5 text-admin-champ" /></div>
        <div><h1 className="font-serif text-2xl text-admin-text">IA de Compras</h1><p className="text-admin-muted/50 text-sm">Pergunte o que comprar, de quem, melhor preço/prazo e risco de ruptura.</p></div>
      </div>

      <div className="glass rounded-2xl p-4 mt-5">
        <div className="flex items-end gap-2">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }} rows={2} placeholder="Ex.: Qual fornecedor de mobiliário tem melhor prazo e homologação?" className="flex-1 bg-transparent text-sm text-admin-text outline-none resize-none placeholder:text-admin-muted/40" />
          <button onClick={() => ask()} disabled={loading || !q.trim()} className="shrink-0 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2">{loading ? <Icon name="refresh" className="w-4 h-4 animate-spin" /> : <Icon name="spark" className="w-4 h-4" />}Perguntar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map((s, i) => <button key={i} onClick={() => { setQ(s); ask(s) }} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors">{s}</button>)}
      </div>

      {answer && (
        <div className="glass-soft rounded-2xl p-5 mt-5">
          {configured === false && <div className="flex items-center gap-2 text-[11px] text-admin-gold/80 mb-3"><Icon name="warning" className="w-3.5 h-3.5" />IA generativa não conectada — mostrando recomendação por dados. Configure a chave nos Secrets para respostas completas.</div>}
          <p className="text-admin-text/85 text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
