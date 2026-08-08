import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { loadCustomer360, relationshipScore, customerInsights, TIMELINE_KIND } from '../../../lib/customer360'
import { RelationshipGraph, CopilotPanel } from './RelationshipGraph'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const dt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const TONE = {
  champ: { bg: 'bg-admin-champ/10', text: 'text-admin-champ', bar: 'bg-admin-champ' },
  sage: { bg: 'bg-admin-sage/10', text: 'text-admin-sage', bar: 'bg-admin-sage' },
  gold: { bg: 'bg-admin-gold/10', text: 'text-admin-gold', bar: 'bg-admin-gold' },
  rose: { bg: 'bg-admin-rose/10', text: 'text-admin-rose', bar: 'bg-admin-rose' },
  copper: { bg: 'bg-admin-copper/10', text: 'text-admin-copper', bar: 'bg-admin-copper' },
}

// Visão 360° de uma entidade (contato/empresa) — o coração do Relationship Studio.
export function Customer360({ contact, onBack, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('copilot')

  useEffect(() => { (async () => {
    setLoading(true)
    try { setData(await loadCustomer360(contact.id)) }
    catch (e) { notify && notify('Erro ao carregar 360°: ' + (e.message || e), 'error') }
    finally { setLoading(false) }
  })() }, [contact.id])

  const s = data?.summary
  const score = relationshipScore(s)
  const insights = customerInsights(s, data?.timeline)
  const initials = (contact.name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const TABS = [
    ['copilot', 'Copilot & Graph', 'spark', null],
    ['timeline', 'Timeline', 'clock', data?.timeline?.length],
    ['orders', 'Pedidos', 'cart', data?.orders?.length],
    ['deals', 'Negócios', 'chart', data?.deals?.length],
    ['quotes', 'Orçamentos', 'tag', data?.quotes?.length],
    ['projects', 'Projetos', 'layers', data?.projects?.length],
    ['docs', 'Documentos', 'book', data?.documents?.length],
    ['support', 'Suporte', 'check', data?.tickets?.length],
    ['relationships', 'Rede', 'user', data?.relationships?.length],
  ]

  return (
    <div>
      <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm mb-4"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>

      {/* Cabeçalho da entidade */}
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-admin-champ/15 flex items-center justify-center shrink-0">
            {contact.avatar_url ? <img src={contact.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" /> : <span className="text-admin-champ text-xl font-serif">{initials}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-2xl text-admin-text">{contact.name || 'Sem nome'}</h1>
              {contact.type && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] text-admin-muted/60">{contact.type}</span>}
              {s?.tier && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-gold/15 text-admin-gold">{s.tier}</span>}
            </div>
            <p className="text-admin-muted/50 text-sm mt-0.5">{[contact.email, contact.phone].filter(Boolean).join(' · ') || 'sem contato'}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.segment && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-champ/10 text-admin-champ/80">{contact.segment}</span>}
              {contact.source && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/50">{contact.source === 'pdv' ? 'PDV' : contact.source}</span>}
              {(contact.tags || []).map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{t}</span>)}
            </div>
          </div>
          {/* Score geral */}
          <div className="text-center shrink-0">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#B89C61" strokeWidth="3" strokeDasharray={`${score.overall} 100`} strokeLinecap="round" pathLength="100" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-admin-text font-serif text-lg">{score.overall}</span>
            </div>
            <p className="text-admin-muted/40 text-[10px] mt-1">Score</p>
          </div>
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando visão 360°…</p> : (
        <>
          {/* KPIs 360 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Kpi label="Total gasto" value={brl(s.totalSpent)} icon="chart" />
            <Kpi label="Pedidos" value={s.orderCount} icon="cart" />
            <Kpi label="Ticket médio" value={brl(s.avgTicket)} icon="star" />
            <Kpi label="Negócios abertos" value={brl(s.openDealsValue)} icon="chart" tone="gold" />
            <Kpi label="Pontos" value={s.points} icon="gift" tone="rose" />
            <Kpi label="Última compra" value={dt(s.lastPurchase)} icon="clock" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            {/* Scores por dimensão */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Score de relacionamento</p>
              {[['Relacionamento', score.relationship], ['Compra', score.purchase], ['Engajamento', score.engagement], ['Financeiro', score.financial]].map(([label, v]) => (
                <div key={label} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-xs mb-1"><span className="text-admin-muted/70">{label}</span><span className="text-admin-text">{v}</span></div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden"><div className="h-full bg-admin-champ rounded-full" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
            {/* Insights (copilot) */}
            <div className="glass rounded-2xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3"><Icon name="spark" className="w-4 h-4 text-admin-champ/60" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Insights</p></div>
              <div className="space-y-2">
                {insights.map((it, i) => {
                  const t = TONE[it.tone] || TONE.champ
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}><Icon name={it.icon} className={`w-3.5 h-3.5 ${t.text}`} /></div>
                      <p className="text-admin-muted/70 text-sm leading-relaxed">{it.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Abas 360 */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {TABS.map(([k, v, ic, n]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
                <Icon name={ic} className="w-3.5 h-3.5" />{v}{n > 0 ? <span className="text-[10px] text-admin-muted/40">{n}</span> : null}
              </button>
            ))}
          </div>

          {tab === 'copilot' && (
            <div className="space-y-4">
              <CopilotPanel contact={contact} data={data} summary={s} />
              <RelationshipGraph contact={contact} data={data} />
            </div>
          )}
          {tab === 'timeline' && <Timeline items={data.timeline} />}
          {tab === 'orders' && <SimpleList rows={data.orders.map((o) => ({ title: `Pedido #${o.number || ''}`, sub: `${o.status} · ${o.channel || ''}`, right: brl(o.total), date: o.created_at }))} empty="Sem pedidos." />}
          {tab === 'deals' && <SimpleList rows={data.deals.map((d) => ({ title: d.title, sub: `${d.stage} · ${d.status}`, right: brl(d.value), date: d.created_at }))} empty="Sem negócios." />}
          {tab === 'quotes' && <SimpleList rows={data.quotes.map((x) => ({ title: `${x.number || ''} ${x.title || ''}`, sub: x.status, right: brl(x.total), date: x.created_at }))} empty="Sem orçamentos." />}
          {tab === 'projects' && <SimpleList rows={data.projects.map((p) => ({ title: p.name, sub: `${p.status} · prazo ${dt(p.deadline)}`, right: brl(p.budget), date: p.created_at }))} empty="Sem projetos." />}
          {tab === 'docs' && <SimpleList rows={data.documents.map((d) => ({ title: d.title, sub: `${d.type || ''} · ${d.status}`, date: d.created_at }))} empty="Sem documentos." />}
          {tab === 'support' && <SimpleList rows={data.tickets.map((t) => ({ title: `#${t.number || ''} ${t.subject || ''}`, sub: `${t.status} · ${t.priority || ''}`, date: t.created_at }))} empty="Sem chamados." />}
          {tab === 'relationships' && <RelationshipsList rows={data.relationships} />}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, icon, tone = 'champ' }) {
  const t = TONE[tone] || TONE.champ
  return (
    <div className="glass rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1"><Icon name={icon} className={`w-3.5 h-3.5 ${t.text}`} /><span className="text-admin-muted/45 text-[10px] uppercase tracking-wider leading-tight">{label}</span></div>
      <p className="text-admin-text text-lg font-serif">{value}</p>
    </div>
  )
}

function Timeline({ items }) {
  if (!items || items.length === 0) return <Empty msg="Nenhuma interação registrada ainda." />
  return (
    <div className="glass rounded-2xl p-5">
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-white/[0.06]" />
        <div className="space-y-4">
          {items.map((e, i) => {
            const meta = TIMELINE_KIND[e.kind] || { label: e.kind, color: 'champ' }
            const t = TONE[meta.color] || TONE.champ
            return (
              <div key={i} className="relative">
                <div className={`absolute -left-[1.35rem] top-0.5 w-5 h-5 rounded-full ${t.bg} flex items-center justify-center ring-2 ring-admin-bg`}><Icon name={e.icon} className={`w-3 h-3 ${t.text}`} /></div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-admin-text text-sm">{e.title}</p>
                    {e.sub && <p className="text-admin-muted/50 text-xs mt-0.5">{e.sub}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {e.value > 0 && <p className="text-admin-gold text-sm">{brl(e.value)}</p>}
                    <p className="text-admin-muted/30 text-[10px]">{dt(e.date)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SimpleList({ rows, empty }) {
  if (!rows || rows.length === 0) return <Empty msg={empty} />
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{r.title}</p>{r.sub && <p className="text-admin-muted/40 text-xs">{r.sub}</p>}</div>
          {r.right && <span className="text-admin-gold text-sm shrink-0">{r.right}</span>}
          <span className="text-admin-muted/30 text-[11px] shrink-0">{dt(r.date)}</span>
        </div>
      ))}
    </div>
  )
}

function RelationshipsList({ rows }) {
  if (!rows || rows.length === 0) return <Empty msg="Nenhum relacionamento cadastrado." />
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((r) => (
        <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="user" className="w-4 h-4 text-admin-champ/70" /></div>
          <div className="min-w-0"><p className="text-admin-text text-sm truncate">{r.related?.name || 'Contato'}</p><p className="text-admin-muted/40 text-xs">{r.relationship || 'relacionado'}</p></div>
        </div>
      ))}
    </div>
  )
}

function Empty({ msg }) {
  return <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">{msg}</p></div>
}
