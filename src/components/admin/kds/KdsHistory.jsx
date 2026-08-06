import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { channelMeta, fmtMin } from '../../../lib/flowEngine'

const PERIODS = [{ value: '1', label: 'Hoje' }, { value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]
const FILTERS = [{ value: '', label: 'Todos' }, { value: 'delivered', label: 'Entregues' }, { value: 'cancelled', label: 'Cancelados' }]

// Histórico de produção — pedidos finalizados/cancelados, com filtro e busca.
export function KdsHistory({ kind = 'kitchen' }) {
  const [days, setDays] = useState('7')
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - (Number(days) - 1)); since.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('kds_tickets').select('*').eq('kind', kind)
      .in('status', ['delivered', 'cancelled']).gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }).limit(300)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [days, kind])

  const shown = useMemo(() => {
    let out = rows
    if (filter) out = out.filter((t) => t.status === filter)
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((t) => `${t.reference} ${t.customer_name} ${t.table_label}`.toLowerCase().includes(q)) }
    return out
  }, [rows, filter, search])

  const durOf = (t) => { const end = t.delivered_at || t.ready_at; return end ? (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000 : null }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando histórico…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido, mesa, cliente…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
        </div>
        <div className="w-40"><GlassSelect value={filter} onChange={setFilter} options={FILTERS} /></div>
        <div className="w-36"><GlassSelect value={days} onChange={setDays} options={PERIODS} /></div>
      </div>

      <p className="text-admin-muted/50 text-sm">{shown.length} registro(s)</p>

      <div className="space-y-2">
        {shown.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/40 text-sm">Nenhum registro no período.</div>}
        {shown.map((t) => {
          const ch = channelMeta(t.channel)
          const dur = durOf(t)
          const cancelled = t.status === 'cancelled'
          return (
            <div key={t.id} className="glass rounded-xl p-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cancelled ? 'bg-admin-rose/10' : 'bg-admin-sage/10'}`}>
                <Icon name={cancelled ? 'x' : 'check'} className={`w-4 h-4 ${cancelled ? 'text-admin-rose' : 'text-admin-sage'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base text-admin-text">{t.reference || '—'}</span>
                  <span className="flex items-center gap-1 text-[10px] text-admin-muted/50 uppercase tracking-wider"><Icon name={ch.icon} className="w-3 h-3" />{ch.label}</span>
                </div>
                <p className="text-admin-muted/50 text-xs truncate">{[t.table_label, t.customer_name].filter((x) => x && x !== '—').join(' · ')} · {(t.items || []).map((i) => `${i.qty || 1}× ${i.name}`).join(', ')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs ${cancelled ? 'text-admin-rose' : 'text-admin-sage'}`}>{cancelled ? 'Cancelado' : 'Entregue'}</p>
                {!cancelled && dur != null && <p className="text-admin-muted/40 text-[11px]">{fmtMin(dur)}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
