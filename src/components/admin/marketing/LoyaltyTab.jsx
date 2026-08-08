import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TIERS = [
  { key: 'bronze', label: 'Bronze', color: 'copper', min: 0 },
  { key: 'silver', label: 'Prata', color: 'champ', min: 500 },
  { key: 'gold', label: 'Ouro', color: 'gold', min: 2000 },
  { key: 'platinum', label: 'Platina', color: 'sage', min: 5000 },
]
const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]))
const COLOR = {
  copper: { bg: 'bg-admin-copper/10', text: 'text-admin-copper' }, champ: { bg: 'bg-admin-champ/10', text: 'text-admin-champ' },
  gold: { bg: 'bg-admin-gold/10', text: 'text-admin-gold' }, sage: { bg: 'bg-admin-sage/10', text: 'text-admin-sage' },
}

// Fidelidade unificada — pontos, tiers, gift cards e cashback num só lugar.
export function LoyaltyTab({ notify }) {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [txns, setTxns] = useState([])
  const [gifts, setGifts] = useState([])
  const [names, setNames] = useState({})
  const [tab, setTab] = useState('points')

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const [aRes, tRes, gRes, cRes] = await Promise.all([
        supabase.from('loyalty_accounts').select('*').order('lifetime_points', { ascending: false }).limit(2000),
        supabase.from('loyalty_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('gift_cards').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('contacts').select('id, name').limit(5000),
      ])
      setAccounts(aRes.data || [])
      setTxns(tRes.data || [])
      setGifts(gRes.data || [])
      setNames(Object.fromEntries((cRes.data || []).map((c) => [c.id, c.name])))
    } catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando fidelidade…</p>

  // métricas
  const totalPoints = accounts.reduce((s, a) => s + (a.points || 0), 0)
  const activeGifts = gifts.filter((g) => g.status === 'active')
  const giftBalance = activeGifts.reduce((s, g) => s + Number(g.balance || 0), 0)
  const tierCounts = {}
  accounts.forEach((a) => { const t = a.tier || 'bronze'; tierCounts[t] = (tierCounts[t] || 0) + 1 })

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon="star" label="Membros" value={accounts.length} />
        <Kpi icon="spark" label="Pontos ativos" value={totalPoints.toLocaleString('pt-BR')} />
        <Kpi icon="gift" label="Gift cards ativos" value={activeGifts.length} />
        <Kpi icon="chart" label="Saldo em gift cards" value={brl(giftBalance)} />
      </div>

      {/* Distribuição por tier */}
      <div className="glass rounded-2xl p-5 mb-6">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Níveis de fidelidade</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIERS.map((t) => {
            const col = COLOR[t.color]
            return (
              <div key={t.key} className="glass-soft rounded-xl p-3 text-center">
                <div className={`w-9 h-9 rounded-lg ${col.bg} flex items-center justify-center mx-auto mb-2`}><Icon name="star" className={`w-4 h-4 ${col.text}`} /></div>
                <p className="text-admin-text text-xl font-serif">{tierCounts[t.key] || 0}</p>
                <p className="text-admin-muted/50 text-[11px]">{t.label}</p>
                <p className="text-admin-muted/30 text-[10px]">{t.min}+ pts (vida)</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['points', 'Ranking de pontos', 'star'], ['gifts', 'Gift Cards', 'gift'], ['activity', 'Movimentações', 'clock']].map(([k, v, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={ic} className="w-3.5 h-3.5" />{v}</button>
        ))}
      </div>

      {tab === 'points' && (
        accounts.length === 0 ? <Empty icon="star" msg="Nenhum membro de fidelidade ainda. As contas são criadas automaticamente nas vendas do PDV." /> : (
          <div className="space-y-2">
            {accounts.slice(0, 50).map((a, i) => {
              const tier = TIER_MAP[a.tier] || TIERS[0]
              const col = COLOR[tier.color]
              return (
                <div key={a.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-admin-muted/40 text-xs w-6 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{names[a.contact_id] || 'Cliente'}</p><p className="text-admin-muted/40 text-[11px]">{(a.lifetime_points || 0).toLocaleString('pt-BR')} pts acumulados</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg ${col.bg} ${col.text} shrink-0`}>{tier.label}</span>
                  <span className="text-admin-text text-sm font-medium w-16 text-right shrink-0">{(a.points || 0).toLocaleString('pt-BR')}</span>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'gifts' && (
        gifts.length === 0 ? <Empty icon="gift" msg="Nenhum gift card emitido. Eles são criados na venda de vale-presente no PDV." /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {gifts.map((g) => (
              <div key={g.id} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-admin-champ font-mono text-sm font-medium">{g.code}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg ${g.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{g.status === 'active' ? 'ativo' : g.status === 'used' ? 'usado' : g.status}</span>
                </div>
                <p className="text-admin-text text-lg font-serif">{brl(g.balance)}</p>
                <p className="text-admin-muted/40 text-xs mt-0.5">de {brl(g.initial_amount)}{g.contact_id && names[g.contact_id] ? ` · ${names[g.contact_id]}` : ''}</p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'activity' && (
        txns.length === 0 ? <Empty icon="clock" msg="Nenhuma movimentação de pontos ainda." /> : (
          <div className="space-y-1.5">
            {txns.slice(0, 60).map((t) => (
              <div key={t.id} className="glass rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.type === 'earn' ? 'bg-admin-sage/10' : 'bg-admin-rose/10'}`}><Icon name={t.type === 'earn' ? 'up' : 'down'} className={`w-3.5 h-3.5 ${t.type === 'earn' ? 'text-admin-sage' : 'text-admin-rose'}`} /></div>
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{t.description || (t.type === 'earn' ? 'Pontos ganhos' : 'Pontos resgatados')}</p><p className="text-admin-muted/40 text-[11px]">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p></div>
                <span className={`text-sm font-medium shrink-0 ${t.type === 'earn' ? 'text-admin-sage' : 'text-admin-rose'}`}>{t.type === 'earn' ? '+' : '−'}{Math.abs(t.points || 0)}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function Kpi({ icon, label, value }) {
  return (
    <div className="glass rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-3.5 h-3.5 text-admin-champ/50" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-2xl font-serif">{value}</p>
    </div>
  )
}
function Empty({ icon, msg }) {
  return <div className="glass rounded-2xl p-10 text-center"><Icon name={icon} className="w-9 h-9 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm max-w-md mx-auto">{msg}</p></div>
}
