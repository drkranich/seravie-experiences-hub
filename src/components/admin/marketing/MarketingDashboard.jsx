import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { eventLabel, EVENT_MAP } from '../../../lib/marketingEvents'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const brl2 = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`
const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000

// Centro de Crescimento — números vivos de todo o ecossistema.
export function MarketingDashboard({ notify }) {
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const in30 = new Date(now.getTime() - 30 * 86400000).toISOString()
      const in60 = new Date(now.getTime() - 60 * 86400000).toISOString()
      const [
        ordersRes, contactsRes, campaignsRes, recipientsRes, couponsRes, autosRes, eventsRes, loyaltyRes,
      ] = await Promise.all([
        supabase.from('orders').select('id, total, contact_id, coupon_id, channel, status, created_at').order('created_at', { ascending: false }).limit(4000),
        supabase.from('contacts').select('id, name, birthdate, ltv, source, created_at').limit(5000),
        supabase.from('campaigns').select('id, title, type, status, sent_count, open_count, click_count, audience_size, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('campaign_recipients').select('channel, status').limit(10000),
        supabase.from('coupons').select('id, used_count').limit(500),
        supabase.from('marketing_automations').select('id, is_active, sent_count').limit(50),
        supabase.from('marketing_events').select('event_type, occurred_at').order('occurred_at', { ascending: false }).limit(500),
        supabase.from('loyalty_accounts').select('points, lifetime_points').limit(5000),
      ])
      const orders = (ordersRes.data || []).filter((o) => o.status !== 'cancelled')
      const contacts = contactsRes.data || []
      const campaigns = campaignsRes.data || []
      const recipients = recipientsRes.data || []
      const coupons = couponsRes.data || []
      const autos = autosRes.data || []
      const events = eventsRes.data || []

      // ---- Receita ----
      const revAll = orders.reduce((s, o) => s + Number(o.total || 0), 0)
      const rev30 = orders.filter((o) => new Date(o.created_at) >= new Date(in30)).reduce((s, o) => s + Number(o.total || 0), 0)
      const ordersFromCoupon = orders.filter((o) => o.coupon_id)
      const revFromCampaigns = ordersFromCoupon.reduce((s, o) => s + Number(o.total || 0), 0)
      const ticket = orders.length ? revAll / orders.length : 0

      // ---- Clientes ----
      const contactIds = new Set(contacts.map((c) => c.id))
      const lastPurchase = {}
      orders.forEach((o) => { if (o.contact_id) { const t = new Date(o.created_at).getTime(); if (!lastPurchase[o.contact_id] || t > lastPurchase[o.contact_id]) lastPurchase[o.contact_id] = t } })
      const activeClients = Object.values(lastPurchase).filter((t) => (Date.now() - t) <= 30 * 86400000).length
      const lostClients = Object.entries(lastPurchase).filter(([, t]) => (Date.now() - t) > 60 * 86400000).length
      const newLeads30 = contacts.filter((c) => c.created_at && new Date(c.created_at) >= new Date(in30)).length
      // recuperados: compraram nos últimos 30d mas estavam inativos >60d antes disso (aprox.)
      const buyers = Object.keys(lastPurchase).length
      const conv = contacts.length ? (buyers / contacts.length) * 100 : 0

      // ---- Aniversariantes hoje ----
      const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const bdayToday = contacts.filter((c) => c.birthdate && String(c.birthdate).slice(5, 10) === mmdd)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const bdayMonth = contacts.filter((c) => c.birthdate && String(c.birthdate).slice(5, 7) === mm).length

      // ---- Mensagens ----
      const msgByChannel = { email: 0, whatsapp: 0, sms: 0, push: 0 }
      recipients.forEach((r) => { if (msgByChannel[r.channel] !== undefined) msgByChannel[r.channel] += 1 })
      const msgTotal = recipients.length
      const autoSent = autos.reduce((s, a) => s + (a.sent_count || 0), 0)

      // ---- Campanhas ----
      const activeCampaigns = campaigns.filter((c) => ['scheduled', 'running', 'sent'].includes(c.status)).length
      const activeAutos = autos.filter((a) => a.is_active).length
      const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)
      const totalOpen = campaigns.reduce((s, c) => s + (c.open_count || 0), 0)
      const openRate = totalSent ? (totalOpen / totalSent) * 100 : 0
      const couponsUsed = coupons.reduce((s, c) => s + (c.used_count || 0), 0)

      // receita por campanha (top 5 por audience → proxy de alcance × ticket)
      const campRevenue = campaigns
        .filter((c) => c.sent_count > 0)
        .map((c) => ({ title: c.title, type: c.type, sent: c.sent_count || 0, open: c.open_count || 0, openRate: c.sent_count ? (c.open_count || 0) / c.sent_count * 100 : 0 }))
        .slice(0, 6)

      // eventos recentes do ecossistema
      const evtCounts = {}
      events.forEach((e) => { evtCounts[e.event_type] = (evtCounts[e.event_type] || 0) + 1 })
      const topEvents = Object.entries(evtCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

      // ROI (proxy): receita atribuída a cupom / (mensagens enviadas × custo estimado)
      const estCost = msgTotal * 0.05 // R$0,05 por mensagem (estimativa)
      const roi = estCost > 0 ? ((revFromCampaigns - estCost) / estCost) * 100 : 0

      setD({
        revAll, rev30, revFromCampaigns, ticket, roi,
        activeClients, lostClients, newLeads30, conv, buyers, totalContacts: contacts.length,
        bdayToday, bdayMonth, couponsUsed,
        msgByChannel, msgTotal, autoSent,
        activeCampaigns, activeAutos, openRate, campRevenue: campRevenue, topEvents,
      })
    } catch (e) {
      notify && notify('Erro ao carregar dashboard: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando o centro de crescimento…</p>
  if (!d) return <p className="text-admin-muted/40 text-sm py-16 text-center">Sem dados ainda.</p>

  return (
    <div className="space-y-6">
      {/* Faixa principal: receita + ROI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigKpi label="Receita gerada" value={brl(d.revAll)} sub={`${brl(d.rev30)} nos últimos 30 dias`} icon="chart" tone="champ" />
        <BigKpi label="Receita por campanhas" value={brl(d.revFromCampaigns)} sub="vendas com cupom vinculado" icon="gift" tone="sage" />
        <BigKpi label="ROI de marketing" value={pct(d.roi)} sub="receita atribuída vs. custo" icon="spark" tone="gold" />
        <BigKpi label="Ticket médio" value={brl2(d.ticket)} sub={`${d.buyers} compradores`} icon="cart" tone="copper" />
      </div>

      {/* Grade de mini-KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniKpi label="Campanhas ativas" value={d.activeCampaigns} icon="mail" />
        <MiniKpi label="Fluxos ativos" value={d.activeAutos} icon="spark" />
        <MiniKpi label="Clientes ativos" value={d.activeClients} icon="user" tone="sage" />
        <MiniKpi label="Novos leads (30d)" value={d.newLeads30} icon="star" tone="champ" />
        <MiniKpi label="Taxa de conversão" value={pct(d.conv)} icon="chart" />
        <MiniKpi label="Clientes perdidos" value={d.lostClients} icon="clock" tone="rose" />
        <MiniKpi label="Aniversariantes hoje" value={d.bdayToday.length} icon="gift" tone="rose" />
        <MiniKpi label="Aniversariantes/mês" value={d.bdayMonth} icon="calendar" />
        <MiniKpi label="Cupons utilizados" value={d.couponsUsed} icon="gift" tone="gold" />
        <MiniKpi label="Mensagens enviadas" value={d.msgTotal} icon="mail" />
        <MiniKpi label="Taxa de abertura" value={pct(d.openRate)} icon="eye" tone="sage" />
        <MiniKpi label="Base total" value={d.totalContacts} icon="user" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Mensagens por canal */}
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Mensagens por canal</p>
          {[['email', 'E-mail', 'bg-admin-champ'], ['whatsapp', 'WhatsApp', 'bg-admin-sage'], ['sms', 'SMS', 'bg-admin-gold'], ['push', 'Push', 'bg-admin-copper']].map(([k, label, barCls]) => {
            const v = d.msgByChannel[k] || 0
            const max = Math.max(1, ...Object.values(d.msgByChannel))
            return (
              <div key={k} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1"><span className="text-admin-muted/70">{label}</span><span className="text-admin-text">{v}</span></div>
                <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden"><div className={`h-full ${barCls} rounded-full`} style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            )
          })}
          <p className="text-admin-muted/40 text-[11px] mt-4">+ {d.autoSent} enviadas por automações</p>
        </div>

        {/* Desempenho por campanha */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Desempenho por campanha</p>
          {d.campRevenue.length === 0 ? <p className="text-admin-muted/40 text-sm py-6 text-center">Nenhuma campanha enviada ainda.</p> : (
            <div className="space-y-3">
              {d.campRevenue.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-admin-text truncate">{c.title} <span className="text-admin-muted/40">· {c.type}</span></span>
                    <span className="text-admin-muted/60">{c.sent} envios · {pct(c.openRate)} abertura</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden"><div className="h-full bg-admin-sage rounded-full" style={{ width: `${Math.min(100, c.openRate)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Eventos do ecossistema */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><Icon name="spark" className="w-4 h-4 text-admin-champ/60" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Eventos do ecossistema (últimos)</p></div>
        {d.topEvents.length === 0 ? (
          <p className="text-admin-muted/40 text-sm py-4">Nenhum evento registrado ainda. Conclua uma venda no PDV para ver o motor de eventos em ação.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {d.topEvents.map(([type, count]) => {
              const meta = EVENT_MAP[type]
              return (
                <div key={type} className="glass-soft rounded-xl p-3 text-center">
                  <Icon name={meta?.icon || 'spark'} className="w-4 h-4 text-admin-champ/60 mx-auto mb-1.5" />
                  <p className="text-admin-text text-xl font-serif">{count}</p>
                  <p className="text-admin-muted/50 text-[10px] leading-tight mt-0.5">{eventLabel(type)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Aniversariantes hoje — ação rápida */}
      {d.bdayToday.length > 0 && (
        <div className="glass rounded-2xl p-5 bg-admin-rose/[0.04] border border-admin-rose/15">
          <div className="flex items-center gap-2 mb-3"><Icon name="gift" className="w-4 h-4 text-admin-rose/70" /><p className="text-[11px] tracking-wider uppercase text-admin-rose/80">🎂 Aniversariantes de hoje ({d.bdayToday.length})</p></div>
          <div className="flex flex-wrap gap-2">
            {d.bdayToday.slice(0, 20).map((c) => (
              <span key={c.id} className="text-xs px-3 py-1 rounded-lg bg-admin-rose/10 text-admin-rose/90">{c.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BigKpi({ label, value, sub, icon, tone = 'champ' }) {
  const TONE = {
    champ: 'from-admin-champ/10 border-admin-champ/20 text-admin-champ',
    sage: 'from-admin-sage/10 border-admin-sage/20 text-admin-sage',
    gold: 'from-admin-gold/10 border-admin-gold/20 text-admin-gold',
    copper: 'from-admin-copper/10 border-admin-copper/20 text-admin-copper',
  }[tone]
  return (
    <div className={`glass rounded-2xl p-5 bg-gradient-to-br to-transparent border ${TONE}`}>
      <div className="flex items-center gap-2 mb-2"><Icon name={icon} className="w-4 h-4 opacity-70" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-3xl font-serif leading-none">{value}</p>
      <p className="text-admin-muted/40 text-xs mt-2">{sub}</p>
    </div>
  )
}

function MiniKpi({ label, value, icon, tone = 'champ' }) {
  const T = { champ: 'text-admin-champ/60', sage: 'text-admin-sage/70', gold: 'text-admin-gold/70', rose: 'text-admin-rose/70', copper: 'text-admin-copper/70' }[tone]
  return (
    <div className="glass rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1"><Icon name={icon} className={`w-3.5 h-3.5 ${T}`} /><span className="text-admin-muted/45 text-[10px] uppercase tracking-wider leading-tight">{label}</span></div>
      <p className="text-admin-text text-xl font-serif">{value}</p>
    </div>
  )
}
