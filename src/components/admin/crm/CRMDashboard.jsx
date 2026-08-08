import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`

// Tela inicial do Relationship Studio — nunca uma lista, sempre a visão do relacionamento.
export function CRMDashboard({ notify, onOpenContact }) {
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const in30 = new Date(Date.now() - 30 * 86400000).toISOString()
      const [contactsRes, dealsRes, ordersRes, tasksRes, stagesRes] = await Promise.all([
        supabase.from('contacts').select('id, name, birthdate, source, created_at, ltv, segment').limit(6000),
        supabase.from('deals').select('id, value, stage, status, probability, expected_close_date, created_at').limit(4000),
        supabase.from('orders').select('contact_id, created_at, status').neq('status', 'cancelled').limit(8000),
        supabase.from('deal_tasks').select('id, title, due_date, done, deal_id').eq('done', false).order('due_date').limit(200),
        supabase.from('pipeline_stages').select('key, probability, is_won, is_lost').limit(50),
      ])
      const contacts = contactsRes.data || []
      const deals = dealsRes.data || []
      const orders = ordersRes.data || []
      const tasks = tasksRes.data || []
      const stages = stagesRes.data || []
      const stageProb = Object.fromEntries(stages.map((s) => [s.key, s.probability]))

      // clientes ativos: compraram nos últimos 30 dias
      const lastByContact = {}
      orders.forEach((o) => { if (o.contact_id) { const t = new Date(o.created_at).getTime(); if (!lastByContact[o.contact_id] || t > lastByContact[o.contact_id]) lastByContact[o.contact_id] = t } })
      const activeClients = Object.values(lastByContact).filter((t) => Date.now() - t <= 30 * 86400000).length
      const lostClients = Object.entries(lastByContact).filter(([, t]) => Date.now() - t > 90 * 86400000).length
      const buyers = new Set(Object.keys(lastByContact))
      const leads = contacts.filter((c) => !buyers.has(c.id)).length
      const newContacts30 = contacts.filter((c) => c.created_at && new Date(c.created_at) >= new Date(in30)).length
      const conv = contacts.length ? (buyers.size / contacts.length) * 100 : 0

      const openDeals = deals.filter((x) => x.status !== 'won' && x.status !== 'lost')
      const wonDeals = deals.filter((x) => x.status === 'won')
      const pipelineValue = openDeals.reduce((s, x) => s + Number(x.value || 0), 0)
      const wonValue = wonDeals.reduce((s, x) => s + Number(x.value || 0), 0)
      // receita prevista = soma(valor × probabilidade)
      const forecast = openDeals.reduce((s, x) => {
        const p = x.probability != null ? x.probability : (stageProb[x.stage] ?? defaultProb(x.stage))
        return s + Number(x.value || 0) * (p / 100)
      }, 0)
      const winRate = (wonDeals.length + deals.filter((x) => x.status === 'lost').length) ? (wonDeals.length / (wonDeals.length + deals.filter((x) => x.status === 'lost').length)) * 100 : 0

      // aniversariantes hoje
      const mmdd = `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
      const bdayToday = contacts.filter((c) => c.birthdate && String(c.birthdate).slice(5, 10) === mmdd)

      // follow-ups: tarefas atrasadas / hoje
      const today = new Date().toISOString().slice(0, 10)
      const overdue = tasks.filter((t) => t.due_date && t.due_date < today).length
      const dueToday = tasks.filter((t) => t.due_date === today).length

      setD({
        totalContacts: contacts.length, leads, activeClients, lostClients, newContacts30, conv,
        openCount: openDeals.length, pipelineValue, wonValue, forecast, winRate,
        tasks, overdue, dueToday, bdayToday,
      })
    } catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando o Relationship Studio…</p>
  if (!d) return null

  return (
    <div className="space-y-5">
      {/* Faixa principal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Big label="Receita prevista" value={brl(d.forecast)} sub="pipeline ponderado" icon="spark" tone="champ" />
        <Big label="Pipeline aberto" value={brl(d.pipelineValue)} sub={`${d.openCount} negócios`} icon="chart" tone="gold" />
        <Big label="Fechado (ganho)" value={brl(d.wonValue)} sub={`win rate ${pct(d.winRate)}`} icon="check" tone="sage" />
        <Big label="Conversão" value={pct(d.conv)} sub={`${d.leads} leads`} icon="user" tone="copper" />
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Mini label="Contatos" value={d.totalContacts} icon="user" />
        <Mini label="Clientes ativos" value={d.activeClients} icon="heart" tone="sage" />
        <Mini label="Novos (30d)" value={d.newContacts30} icon="star" tone="champ" />
        <Mini label="Clientes perdidos" value={d.lostClients} icon="clock" tone="rose" />
        <Mini label="Follow-ups atrasados" value={d.overdue} icon="clock" tone="rose" />
        <Mini label="Tarefas hoje" value={d.dueToday} icon="check" tone="gold" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Follow-ups / tarefas */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Icon name="check" className="w-4 h-4 text-admin-champ/60" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Próximos follow-ups</p></div>
          {d.tasks.length === 0 ? <p className="text-admin-muted/40 text-sm py-4">Nenhuma tarefa pendente.</p> : (
            <div className="space-y-2">
              {d.tasks.slice(0, 8).map((t) => {
                const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
                return (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${overdue ? 'bg-admin-rose' : 'bg-admin-gold'} shrink-0`} />
                    <span className="text-admin-text/80 flex-1 truncate">{t.title}</span>
                    <span className={`text-xs shrink-0 ${overdue ? 'text-admin-rose' : 'text-admin-muted/40'}`}>{t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Aniversariantes */}
        <div className="glass rounded-2xl p-5 bg-admin-rose/[0.04] border border-admin-rose/15">
          <div className="flex items-center gap-2 mb-4"><Icon name="gift" className="w-4 h-4 text-admin-rose/70" /><p className="text-[11px] tracking-wider uppercase text-admin-rose/80">🎂 Aniversariantes de hoje</p></div>
          {d.bdayToday.length === 0 ? <p className="text-admin-muted/40 text-sm py-4">Ninguém faz aniversário hoje.</p> : (
            <div className="flex flex-wrap gap-2">
              {d.bdayToday.map((c) => (
                <button key={c.id} onClick={() => onOpenContact && onOpenContact(c)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-rose/10 text-admin-rose/90 hover:bg-admin-rose/20 transition-colors">{c.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function defaultProb(stage) {
  return { new: 10, qualified: 25, proposal: 50, negotiation: 70, won: 100, postsale: 100, lost: 0 }[stage] ?? 20
}

function Big({ label, value, sub, icon, tone }) {
  const T = { champ: 'from-admin-champ/10 border-admin-champ/20 text-admin-champ', gold: 'from-admin-gold/10 border-admin-gold/20 text-admin-gold', sage: 'from-admin-sage/10 border-admin-sage/20 text-admin-sage', copper: 'from-admin-copper/10 border-admin-copper/20 text-admin-copper' }[tone]
  return (
    <div className={`glass rounded-2xl p-5 bg-gradient-to-br to-transparent border ${T}`}>
      <div className="flex items-center gap-2 mb-2"><Icon name={icon} className="w-4 h-4 opacity-70" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-3xl font-serif leading-none">{value}</p>
      <p className="text-admin-muted/40 text-xs mt-2">{sub}</p>
    </div>
  )
}
function Mini({ label, value, icon, tone = 'champ' }) {
  const T = { champ: 'text-admin-champ/60', sage: 'text-admin-sage/70', gold: 'text-admin-gold/70', rose: 'text-admin-rose/70', copper: 'text-admin-copper/70' }[tone]
  return (
    <div className="glass rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1"><Icon name={icon} className={`w-3.5 h-3.5 ${T}`} /><span className="text-admin-muted/45 text-[10px] uppercase tracking-wider leading-tight">{label}</span></div>
      <p className="text-admin-text text-xl font-serif">{value}</p>
    </div>
  )
}
