import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS = { active: 'Ativa', trialing: 'Em teste', past_due: 'Pagamento pendente', canceled: 'Cancelada', cancelled: 'Cancelada', none: 'Sem assinatura' }
const STATUS_STYLE = { active: 'text-admin-sage', trialing: 'text-admin-champ', past_due: 'text-admin-gold', canceled: 'text-admin-rose', cancelled: 'text-admin-rose', none: 'text-admin-muted/50' }
const LIMITS = [
  ['pdv_sales', 'Vendas no PDV', 'este mês'], ['online_orders', 'Pedidos online', 'este mês'],
  ['units', 'Unidades / franquias', ''], ['users', 'Usuários', ''], ['products', 'Produtos', ''],
]

export function SubscriptionPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null)
  const [plan, setPlan] = useState(null)
  const [plans, setPlans] = useState([])
  const [usage, setUsage] = useState({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const [{ data: s }, { data: allPlans }, pdv, online, units, users, products] = await Promise.all([
        supabase.from('subscriptions').select('*').maybeSingle(),
        supabase.from('plans').select('*').eq('is_active', true).order('sort_order').order('price_monthly'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('channel', 'pdv').gte('created_at', monthStart.toISOString()),
        supabase.from('store_orders').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('memberships').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
      ])
      setSub(s || null)
      setPlans(allPlans || [])
      setUsage({ pdv_sales: pdv.count || 0, online_orders: online.count || 0, units: units.count || 0, users: users.count || 0, products: products.count || 0 })
      if (s?.plan_id) setPlan((allPlans || []).find((p) => p.id === s.plan_id) || null)
      setLoading(false)
    })()
  }, [])

  const [checkout, setCheckout] = useState(null)
  const subscribe = async (p, cycle = 'monthly') => {
    setCheckout(p.id)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscription', {
        body: { plan_id: p.id, cycle, origin: window.location.origin },
      })
      if (error || data?.error) {
        const code = data?.error || error?.message
        if (code === 'stripe_not_configured') notify('A cobrança online (Stripe) ainda não foi ativada. Assim que as chaves forem configuradas, este botão levará direto ao checkout.', 'info')
        else if (code === 'plan_has_no_stripe_price') notify('Este plano ainda não tem o Price ID do Stripe configurado em "Planos da Plataforma".', 'error')
        else notify('Não foi possível iniciar o checkout: ' + (code || 'erro'), 'error')
        return
      }
      if (data?.url) window.location.href = data.url
    } catch (e) {
      notify('Falha ao contatar o checkout. Tente novamente.', 'error')
    } finally { setCheckout(null) }
  }

  const status = sub?.status || 'none'
  const limits = plan?.limits || {}

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando assinatura…</p>

  return (
    <div>
      <div className="mb-6"><h1 className="font-serif text-4xl text-admin-text">Minha Assinatura</h1><p className="text-admin-muted/60 text-sm mt-1">Seu plano na Seravie Experiences e o uso da plataforma</p></div>

      {/* Cartão do plano atual */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Plano atual</p>
            <p className="font-serif text-3xl text-admin-text">{plan?.name || 'Nenhum plano'}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-sm ${STATUS_STYLE[status]}`}>● {STATUS[status] || status}</span>
              {sub?.billing_cycle && <span className="text-admin-muted/50 text-sm">· {sub.billing_cycle === 'yearly' ? 'anual' : 'mensal'}</span>}
              {plan && <span className="text-admin-champ text-sm">· {brl(sub?.billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly)}{sub?.billing_cycle === 'yearly' ? '/ano' : '/mês'}</span>}
            </div>
            {sub?.current_period_end && <p className="text-admin-muted/40 text-xs mt-2">Renova em {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}</p>}
            {sub?.trial_end && status === 'trialing' && <p className="text-admin-gold/70 text-xs mt-1">Teste até {new Date(sub.trial_end).toLocaleDateString('pt-BR')}</p>}
          </div>
          {sub?.provider_subscription_id && <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-admin-muted/40">Cobrança</p><p className="text-admin-muted/60 text-xs">{sub.payment_provider || 'stripe'}</p></div>}
        </div>
      </div>

      {/* Uso vs limites */}
      <h2 className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Uso da plataforma</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {LIMITS.map(([k, label, hint]) => {
          const used = usage[k] || 0
          const lim = limits[k]
          const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : null
          const over = lim && used > lim
          return (
            <div key={k} className="glass rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-admin-muted/60 text-xs">{label}{hint ? ` · ${hint}` : ''}</p>
                <p className={`text-sm font-medium ${over ? 'text-admin-rose' : 'text-admin-text'}`}>{used}{lim ? <span className="text-admin-muted/40"> / {lim}</span> : <span className="text-admin-sage/60 text-xs"> · ilimitado</span>}</p>
              </div>
              {lim ? (
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${over ? 'bg-admin-rose' : pct >= 80 ? 'bg-admin-gold' : 'bg-admin-champ'}`} style={{ width: `${pct}%` }} /></div>
              ) : <div className="h-1.5 rounded-full bg-admin-sage/20" />}
              {over && <p className="text-admin-rose/80 text-[10px] mt-1.5">Limite do plano excedido — considere fazer upgrade.</p>}
            </div>
          )
        })}
      </div>

      {/* Planos disponíveis */}
      <h2 className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">{plan ? 'Trocar de plano' : 'Escolha um plano'}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhum plano disponível no momento.</p> : plans.map((p) => {
          const current = plan?.id === p.id
          return (
            <div key={p.id} className={`glass rounded-2xl p-5 flex flex-col border ${current ? 'border-admin-champ/40' : 'border-transparent'}`}>
              <div className="flex items-center justify-between mb-1"><p className="text-admin-text font-medium">{p.name}</p>{current && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-admin-champ/15 text-admin-champ">atual</span>}</div>
              <p className="text-admin-champ text-2xl font-medium">{brl(p.price_monthly)}<span className="text-admin-muted/40 text-xs font-normal"> /mês</span></p>
              {p.description && <p className="text-admin-muted/50 text-xs mt-2">{p.description}</p>}
              {(p.features || []).length > 0 && (
                <div className="space-y-1 mt-3 flex-1">
                  {(p.features || []).slice(0, 6).map((f, i) => <div key={i} className="flex items-center gap-2 text-admin-muted/60 text-xs"><Icon name="check" className="w-3.5 h-3.5 text-admin-sage shrink-0" />{f}</div>)}
                </div>
              )}
              <button
                onClick={() => current ? null : subscribe(p, sub?.billing_cycle === 'yearly' ? 'yearly' : 'monthly')}
                disabled={current || checkout === p.id}
                className={`mt-4 py-2.5 rounded-xl text-sm transition-colors ${current ? 'bg-white/[0.04] text-admin-muted/40 cursor-default' : 'bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ'}`}>
                {current ? 'Plano atual' : checkout === p.id ? 'Abrindo checkout…' : 'Assinar / fazer upgrade'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
