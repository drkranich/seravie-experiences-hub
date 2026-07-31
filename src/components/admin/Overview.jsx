import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const cnt = async (builder) => { try { return (await builder).count || 0 } catch { return 0 } }

export function Overview({ go }) {
  const { profile } = useTenant()
  const [loading, setLoading] = useState(true)
  const [core, setCore] = useState({ todayRevenue: 0, todayCount: 0, monthRevenue: 0, ticket: 0, contacts: 0, openCash: false, criticalStock: 0, lowStock: 0, days: [], maxDay: 1 })
  const [segments, setSegments] = useState([])
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const now = new Date()
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const sbCount = (t) => supabase.from(t).select('*', { count: 'exact', head: true })
      const todayYMD = ymd(now)

      // ---- Núcleo de comércio ----
      const [{ data: todayOrders }, { data: monthOrders }, { count: contacts }, { data: openSess }, { data: prods }, { data: unreadMsgs }] = await Promise.all([
        supabase.from('orders').select('total, items, created_at').gte('created_at', todayStart.toISOString()).eq('payment_status', 'paid'),
        supabase.from('orders').select('total').gte('created_at', monthStart.toISOString()).eq('payment_status', 'paid'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('cash_sessions').select('id').eq('status', 'open').limit(1),
        supabase.from('products').select('stock, min_stock').limit(2000),
        supabase.from('contact_submissions').select('id').eq('read', false).limit(200),
      ])
      const todayRevenue = (todayOrders || []).reduce((s, o) => s + Number(o.total || 0), 0)
      const todayCount = (todayOrders || []).length
      const monthRevenue = (monthOrders || []).reduce((s, o) => s + Number(o.total || 0), 0)
      const criticalStock = (prods || []).filter((p) => p.stock != null && p.stock <= 0).length
      const lowStock = (prods || []).filter((p) => p.stock != null && p.min_stock > 0 && p.stock > 0 && p.stock <= p.min_stock).length

      // vendas 14 dias
      const days = []
      for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push({ key: ymd(d), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: 0 }) }
      const dayMap = Object.fromEntries(days.map((d) => [d.key, d]))
      const since14 = new Date(now); since14.setDate(since14.getDate() - 13); since14.setHours(0, 0, 0, 0)
      const { data: recent } = await supabase.from('orders').select('total, created_at').gte('created_at', since14.toISOString()).eq('payment_status', 'paid')
      ;(recent || []).forEach((o) => { const k = ymd(new Date(o.created_at)); if (dayMap[k]) dayMap[k].value += Number(o.total || 0) })
      const maxDay = Math.max(1, ...days.map((d) => d.value))

      setCore({ todayRevenue, todayCount, monthRevenue, ticket: todayCount ? todayRevenue / todayCount : 0, contacts: contacts || 0, openCash: (openSess || []).length > 0, criticalStock, lowStock, days, maxDay })

      // ---- Frentes ativas do tenant ----
      const { data: vc } = await supabase.from('vertical_configs').select('vertical')
      const active = (vc || []).map((v) => v.vertical)

      const catalog = (v, title, icon) => async () => ({ title, icon, route: v, stats: [['Itens', await cnt(supabase.from('products').select('*', { count: 'exact', head: true }).contains('tags', [v]))]] })
      const L = {
        franchise: async () => ({ title: 'Franquias', icon: 'leaf', route: 'franchise', stats: [['Unidades', await cnt(sbCount('units'))], ['Ocorrências abertas', await cnt(sbCount('incidents').eq('status', 'open'))]] }),
        chocolate: async () => ({ title: 'Chocolateria', icon: 'gift', route: 'chocolate', stats: [['Linhas', await cnt(sbCount('chocolate_lines'))], ['Kits', await cnt(sbCount('chocolate_kits'))]] }),
        coffee: async () => ({ title: 'Cafeteria', icon: 'cup', route: 'coffee', stats: [['Cardápio', await cnt(sbCount('coffee_menu'))], ['Workshops', await cnt(sbCount('events').eq('type', 'workshop'))]] }),
        gourmet: async () => ({ title: 'Empório', icon: 'cup', route: 'gourmet', stats: [['Cestas/Kits', await cnt(sbCount('hampers'))], ['Fornecedores', await cnt(sbCount('suppliers'))]] }),
        wine: async () => ({ title: 'Vinhos', icon: 'wine', route: 'wine', stats: [['Rótulos', await cnt(sbCount('wine_labels'))]] }),
        events: async () => ({ title: 'Eventos', icon: 'star', route: 'events', stats: [['Total', await cnt(sbCount('events').neq('type', 'workshop'))], ['Confirmados', await cnt(sbCount('events').eq('status', 'confirmed'))]] }),
        spa: async () => ({ title: 'Spa', icon: 'heart', route: 'spa', stats: [['Agend. hoje', await cnt(sbCount('appointments').eq('date', todayYMD))], ['Serviços', await cnt(sbCount('spa_services'))]] }),
        tourism: async () => ({ title: 'Turismo', icon: 'map', route: 'tourism', stats: [['Passeios', await cnt(sbCount('tours'))]] }),
        architecture: async () => ({ title: 'Arquitetura', icon: 'layout', route: 'architecture', stats: [['Projetos', await cnt(sbCount('projects'))], ['Em execução', await cnt(sbCount('projects').eq('status', 'execution'))]] }),
        gift: async () => ({ title: 'Presentes', icon: 'gift', route: 'gift', stats: [['Itens', await cnt(sbCount('gift_items'))]] }),
        artesanato: async () => ({ title: 'Artesanato', icon: 'palette', route: 'artesanato', stats: [['Peças', await cnt(sbCount('craft_items'))], ['Encomendas', await cnt(sbCount('craft_commissions'))]] }),
        brewery: catalog('brewery', 'Cervejaria', 'cup'),
        bakery: catalog('bakery', 'Padaria', 'cup'),
        floriculture: catalog('floriculture', 'Floricultura', 'leaf'),
        beauty: catalog('beauty', 'Beauty', 'heart'),
      }
      const segs = (await Promise.all(active.filter((v) => L[v]).map((v) => L[v]()))).filter(Boolean)
      setSegments(segs)

      // ---- Feed de atenção ----
      const al = []
      if (criticalStock > 0) al.push({ icon: 'box', tone: 'rose', text: `${criticalStock} produto(s) sem estoque`, go: 'catalog' })
      if (lowStock > 0) al.push({ icon: 'box', tone: 'gold', text: `${lowStock} produto(s) abaixo do mínimo`, go: 'catalog' })
      al.push({ icon: 'tag', tone: (openSess || []).length ? 'sage' : 'muted', text: (openSess || []).length ? 'Caixa aberto — vendas em andamento' : 'Nenhum caixa aberto', go: 'pos' })
      if ((unreadMsgs || []).length) al.push({ icon: 'mail', tone: 'champ', text: `${unreadMsgs.length} mensagem(ns) não lida(s)`, go: 'messages' })
      if (active.includes('franchise')) { const inc = await cnt(sbCount('incidents').eq('status', 'open')); if (inc) al.push({ icon: 'check', tone: 'rose', text: `${inc} ocorrência(s) aberta(s) na rede`, go: 'franchise' }) }
      if (active.includes('spa')) { const ap = await cnt(sbCount('appointments').eq('date', todayYMD)); if (ap) al.push({ icon: 'heart', tone: 'champ', text: `${ap} agendamento(s) hoje`, go: 'spa' }) }
      if (active.includes('architecture')) { const px = await cnt(sbCount('projects').eq('status', 'execution')); if (px) al.push({ icon: 'layout', tone: 'sage', text: `${px} projeto(s) em execução`, go: 'architecture' }) }
      setAlerts(al)
      setLoading(false)
    })()
  }, [])

  const toneCls = { rose: 'text-admin-rose', gold: 'text-admin-gold', sage: 'text-admin-sage', champ: 'text-admin-champ', muted: 'text-admin-muted/50' }

  if (loading) return <div className="py-16 text-admin-muted/40 text-sm text-center">Carregando seu backstage…</div>

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-5xl text-admin-text">Backstage</h1>
        <p className="text-admin-muted/70 mt-2">Bem-vindo, {profile?.tenant_name || 'Seravie Experiences'}. Sua operação em um olhar.</p>
      </div>

      {/* KPIs de comércio */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Vendas hoje</p><p className="text-admin-sage text-2xl font-medium">{brl(core.todayRevenue)}</p><p className="text-admin-muted/40 text-xs mt-1">{core.todayCount} pedidos</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Faturamento do mês</p><p className="text-admin-champ text-2xl font-medium">{brl(core.monthRevenue)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Ticket médio hoje</p><p className="text-admin-text text-2xl font-medium">{brl(core.ticket)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Clientes</p><p className="text-admin-text text-2xl font-medium">{core.contacts}</p></div>
        <button onClick={() => go('pos')} className="glass rounded-2xl p-5 text-left lift"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Caixa</p><p className={`text-2xl font-medium ${core.openCash ? 'text-admin-sage' : 'text-admin-muted/50'}`}>{core.openCash ? 'Aberto' : 'Fechado'}</p><p className="text-admin-champ/60 text-xs mt-1">abrir PDV →</p></button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Vendas 14 dias */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Vendas — últimos 14 dias</p>
          <div className="flex items-end gap-1.5 h-40">
            {core.days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full rounded-t bg-admin-champ/70 hover:bg-admin-champ transition-all relative" style={{ height: `${Math.max(2, (d.value / core.maxDay) * 100)}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-admin-champ opacity-0 group-hover:opacity-100 whitespace-nowrap">{brl(d.value)}</span>
                </div>
                <span className="text-[9px] text-admin-muted/40">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Feed de atenção (IA) */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Icon name="spark" className="w-4 h-4 text-admin-champ" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">O que merece atenção hoje</p></div>
          {alerts.length === 0 ? <p className="text-admin-muted/40 text-sm">Tudo em ordem por aqui ✦</p> : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <button key={i} onClick={() => a.go && go(a.go)} className="w-full text-left flex items-center gap-3 glass-soft rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                  <Icon name={a.icon} className={`w-4 h-4 shrink-0 ${toneCls[a.tone]}`} />
                  <span className="text-admin-text text-sm flex-1">{a.text}</span>
                  <Icon name="external" className="w-3.5 h-3.5 text-admin-muted/30" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Frentes do negócio */}
      {segments.length > 0 && (
        <>
          <h2 className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Suas frentes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {segments.map((s) => (
              <button key={s.route} onClick={() => go(s.route)} className="glass rounded-2xl p-5 text-left border border-transparent hover:border-admin-champ/25 lift transition-all">
                <div className="flex items-center gap-2 mb-3"><Icon name={s.icon} className="w-4 h-4 text-admin-champ/70" /><p className="text-admin-text text-sm font-medium">{s.title}</p></div>
                <div className="space-y-1.5">
                  {s.stats.map(([label, value], i) => (
                    <div key={i} className="flex items-center justify-between"><span className="text-admin-muted/50 text-xs">{label}</span><span className="text-admin-champ text-sm font-medium">{value}</span></div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Ações rápidas */}
      <h2 className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Ações rápidas</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'pos', icon: 'tag', label: 'Abrir o PDV' },
          { key: 'catalog', icon: 'image', label: 'Gerenciar catálogo' },
          { key: 'crm', icon: 'user', label: 'Ver clientes (CRM)' },
          { key: 'finance', icon: 'chart', label: 'Financeiro' },
        ].map((a) => (
          <button key={a.label} onClick={() => go(a.key)} className="glass-soft lift rounded-2xl flex items-center gap-3 p-5 text-admin-muted hover:text-admin-champ transition-colors">
            <Icon name={a.icon} className="w-5 h-5 text-admin-champ" />
            <span className="text-sm">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
