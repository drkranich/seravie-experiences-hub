import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon, GlassSelect } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const SOURCE = {
  pdv: { label: 'PDV', tone: 'text-admin-champ' },
  store: { label: 'Loja online', tone: 'text-admin-sage' },
  mercado_livre: { label: 'Mercado Livre', tone: 'text-admin-gold' },
  magalu: { label: 'Magalu', tone: 'text-admin-gold' },
  amazon: { label: 'Amazon', tone: 'text-admin-gold' },
  shopee: { label: 'Shopee', tone: 'text-admin-gold' },
  tiktok_shop: { label: 'TikTok Shop', tone: 'text-admin-gold' },
  instagram_shop: { label: 'Instagram', tone: 'text-admin-gold' },
}
const srcLabel = (k) => SOURCE[k]?.label || k

export function ReceivablesPanel({ notify }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [month, setMonth] = useState(ym(new Date()))

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [ord, sord] = await Promise.all([
        supabase.from('orders').select('total, payment_status, channel, customer_name, created_at').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(1000),
        supabase.from('store_orders').select('total, payment_status, channel, customer_name, created_at').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(1000),
      ])
      const list = []
      ;(ord.data || []).forEach((o) => list.push({ source: o.channel === 'pdv' || !o.channel ? 'pdv' : o.channel, customer: o.customer_name, total: Number(o.total || 0), date: o.created_at }))
      ;(sord.data || []).forEach((o) => list.push({ source: o.channel && o.channel !== 'store' ? o.channel : 'store', customer: o.customer_name, total: Number(o.total || 0), date: o.created_at }))
      setRows(list); setLoading(false)
    })()
  }, [])

  const months = useMemo(() => {
    const set = new Set(rows.map((r) => (r.date || '').slice(0, 7)).filter(Boolean))
    set.add(ym(new Date()))
    return [...set].sort().reverse()
  }, [rows])

  const monthRows = rows.filter((r) => (r.date || '').slice(0, 7) === month)
  const total = monthRows.reduce((s, r) => s + r.total, 0)
  const byChannel = () => {
    const m = {}
    monthRows.forEach((r) => { m[r.source] = (m[r.source] || 0) + r.total })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const pdvTotal = monthRows.filter((r) => r.source === 'pdv').reduce((s, r) => s + r.total, 0)
  const onlineTotal = monthRows.filter((r) => r.source === 'store').reduce((s, r) => s + r.total, 0)
  const mktTotal = monthRows.filter((r) => !['pdv', 'store'].includes(r.source)).reduce((s, r) => s + r.total, 0)

  const exportRows = () => monthRows.map((r) => ({ Data: r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '', Origem: srcLabel(r.source), Cliente: r.customer || '—', Valor: brl(r.total) }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Recebíveis</h1><p className="text-admin-muted/60 text-sm mt-1">O que você recebe pelas vendas — PDV, loja online e marketplaces</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }))} /></div>
          <button onClick={() => exportCsv(`recebiveis-${month}.csv`, exportRows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(`Recebíveis ${month}`, exportRows(), `Total ${brl(total)}`) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total recebido</p><p className="text-admin-sage text-2xl font-medium">{brl(total)}</p><p className="text-admin-muted/40 text-xs mt-1">{monthRows.length} vendas</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">PDV</p><p className="text-admin-champ text-2xl font-medium">{brl(pdvTotal)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Loja online</p><p className="text-admin-champ text-2xl font-medium">{brl(onlineTotal)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Marketplaces</p><p className="text-admin-champ text-2xl font-medium">{brl(mktTotal)}</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Recebimentos do mês</p>
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : monthRows.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center"><Icon name="chart" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum recebimento neste mês</p></div>
          ) : (
            <div className="space-y-2">{monthRows.slice(0, 200).map((r, i) => (
              <div key={i} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{r.customer || 'Cliente'}</p><p className={`text-[10px] ${SOURCE[r.source]?.tone || 'text-admin-muted/50'}`}>{srcLabel(r.source)}{r.date ? ` · ${new Date(r.date).toLocaleDateString('pt-BR')}` : ''}</p></div>
                <p className="text-admin-sage text-sm font-medium shrink-0">+ {brl(r.total)}</p>
              </div>
            ))}</div>
          )}
        </div>
        <div>
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Por canal</p>
          <div className="glass rounded-2xl p-5">
            {byChannel().length === 0 ? <p className="text-admin-muted/40 text-xs">Sem recebimentos</p> : byChannel().map(([k, v]) => (
              <div key={k} className="flex items-center justify-between mb-2"><span className={`text-sm ${SOURCE[k]?.tone || 'text-admin-text'}`}>{srcLabel(k)}</span><span className="text-admin-muted/70 text-sm">{brl(v)}</span></div>
            ))}
          </div>
          <p className="text-admin-muted/40 text-[11px] mt-3 leading-relaxed">Valores brutos das vendas pagas. A conciliação de taxas por adquirente/marketplace e o líquido a receber entram junto com a integração de pagamento.</p>
        </div>
      </div>
    </div>
  )
}
