import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { networkPrice, summarizeTiers, brl } from '../../lib/networkPricing'

// Painel consolidado da rede — todas as unidades numa conta só.
// "Toda a rede" soma os KPIs de todas as units; selecionar uma unidade filtra.
// Inclui um simulador de preço (base + escada por unidade) para o dono/vendedor.

const VALID_SALE = ['confirmed', 'processing', 'ready', 'delivered'] // não conta pending/cancelled
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString() }

function Kpi({ label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[10px] tracking-wider uppercase text-admin-muted/50">{label}</p>
      <p className="text-admin-text text-2xl font-serif mt-1">{value}</p>
      {sub && <p className="text-admin-muted/40 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export function NetworkDashboard({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [units, setUnits] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState('') // '' = toda a rede
  const [simUnits, setSimUnits] = useState(1)
  const [cycle, setCycle] = useState('monthly')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [u, o] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('orders').select('unit_id,total,status,created_at').gte('created_at', startOfMonth()).limit(5000),
        ])
        if (!alive) return
        const us = u.data || []
        setUnits(us)
        setOrders(o.data || [])
        setSimUnits(Math.max(1, us.length || 1))
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [tenantId])

  const paid = useMemo(() => orders.filter((o) => VALID_SALE.includes(o.status)), [orders])
  const scoped = useMemo(() => (unit ? paid.filter((o) => o.unit_id === unit) : paid), [paid, unit])

  const revenue = scoped.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const count = scoped.length
  const ticket = count ? revenue / count : 0

  // ranking por unidade (só na visão "toda a rede")
  const perUnit = useMemo(() => {
    const map = new Map()
    for (const o of paid) {
      const k = o.unit_id || 'sem-unidade'
      const cur = map.get(k) || { revenue: 0, count: 0 }
      cur.revenue += Number(o.total) || 0; cur.count += 1
      map.set(k, cur)
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: units.find((u) => u.id === id)?.name || (id === 'sem-unidade' ? 'Sem unidade' : 'Unidade'), ...v }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [paid, units])

  const sim = useMemo(() => networkPrice(simUnits, { cycle }), [simUnits, cycle])
  const tierRows = useMemo(() => summarizeTiers(simUnits, undefined, cycle), [simUnits, cycle])

  const unitOptions = [{ value: '', label: `Toda a rede (${units.length || 0} unidades)` }, ...units.map((u) => ({ value: u.id, label: u.name }))]

  if (loading) return <p className="text-admin-muted/40 text-sm py-12 text-center">Carregando rede…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <p className="text-admin-muted/50 text-xs">Visão única de todas as unidades da rede — sem abrir várias abas.</p>
        </div>
        <div className="w-64">
          <GlassSelect value={unit} onChange={setUnit} options={unitOptions} />
        </div>
      </div>

      {units.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Icon name="building" className="w-9 h-9 text-admin-champ/25 mx-auto mb-3" />
          <p className="text-admin-muted/60 text-sm">Nenhuma unidade cadastrada ainda.</p>
          <p className="text-admin-muted/35 text-xs mt-1">Cadastre suas unidades em Gestão → Rede &amp; Unidades para ver tudo consolidado aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Kpi label="Faturamento do mês" value={brl(revenue)} sub={unit ? 'nesta unidade' : 'toda a rede'} />
            <Kpi label="Pedidos" value={String(count)} sub={unit ? 'nesta unidade' : 'todas as unidades'} />
            <Kpi label="Ticket médio" value={brl(ticket)} />
          </div>

          {!unit && perUnit.length > 0 && (
            <div className="glass-soft rounded-2xl p-5">
              <h3 className="text-[11px] tracking-wider uppercase text-admin-champ mb-4">Desempenho por unidade (mês)</h3>
              <div className="space-y-2">
                {perUnit.map((u, i) => {
                  const max = perUnit[0]?.revenue || 1
                  const pct = Math.max(4, Math.round((u.revenue / max) * 100))
                  return (
                    <button key={u.id} onClick={() => u.id !== 'sem-unidade' && setUnit(u.id)} className="w-full text-left group">
                      <div className="flex items-center gap-3">
                        <span className="text-admin-muted/40 text-xs w-5 shrink-0">{i + 1}º</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-admin-text text-sm truncate group-hover:text-admin-champ transition-colors">{u.name}</span>
                            <span className="text-admin-text/80 text-sm shrink-0 ml-2">{brl(u.revenue)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full rounded-full bg-admin-champ/50" style={{ width: pct + '%' }} />
                          </div>
                        </div>
                        <span className="text-admin-muted/35 text-xs w-16 text-right shrink-0">{u.count} ped.</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Simulador de preço da rede — base + escada por unidade */}
          <div className="glass-soft rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-[11px] tracking-wider uppercase text-admin-champ">Simulador de preço da rede</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setCycle('monthly')} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${cycle === 'monthly' ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Mensal</button>
                <button onClick={() => setCycle('yearly')} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${cycle === 'yearly' ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Anual</button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-admin-muted/60 text-xs">Unidades:</label>
              <input type="range" min="1" max="60" value={simUnits} onChange={(e) => setSimUnits(Number(e.target.value))} className="flex-1 accent-admin-champ" />
              <input type="number" min="1" value={simUnits} onChange={(e) => setSimUnits(Math.max(1, Number(e.target.value) || 1))} className="w-16 glass-input rounded-lg px-2 py-1 text-sm text-admin-text text-center outline-none" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div className="glass rounded-xl p-3"><p className="text-[10px] uppercase text-admin-muted/50">Total {cycle === 'yearly' ? 'anual' : 'mensal'}</p><p className="text-admin-text text-xl font-serif mt-0.5">{brl(sim.total)}</p></div>
              <div className="glass rounded-xl p-3"><p className="text-[10px] uppercase text-admin-muted/50">Por unidade</p><p className="text-admin-text text-xl font-serif mt-0.5">{brl(sim.perUnit)}</p></div>
              <div className="glass rounded-xl p-3"><p className="text-[10px] uppercase text-admin-muted/50">Base (1ª un. + rede)</p><p className="text-admin-text text-xl font-serif mt-0.5">{brl(sim.base)}</p></div>
            </div>
            <div className="space-y-1.5">
              <p className="text-admin-text text-sm">Base Enterprise <span className="text-admin-muted/40">(1ª unidade + painel de rede)</span> — <span className="text-admin-text/90">{brl(sim.base)}</span></p>
              {tierRows.map((r, i) => (
                <p key={i} className="text-admin-muted/60 text-sm">{r.qty}× {brl(r.price)} <span className="text-admin-muted/35">({r.label})</span> = <span className="text-admin-text/80">{brl(r.subtotal)}</span></p>
              ))}
            </div>
            <p className="text-admin-muted/35 text-xs mt-4 leading-relaxed">
              Quanto mais unidades, menor o preço por unidade — o desconto por volume já vem embutido na tabela.
              Isso responde ao pedido de desconto sem negociação caso a caso: acima de 15 unidades cada uma sai por {brl(99)}/mês.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
