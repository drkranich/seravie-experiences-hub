import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { timeAgo } from '../../../lib/networkSocial'

// Timeline Viva — a memória viva da operação: linha do tempo cronológica de
// eventos reais do tenant no ecossistema (posts, projetos, briefings, propostas,
// eventos, cursos, pedidos). Agrega de várias tabelas e ordena por data.

const TYPES = {
  post: { label: 'Publicação', icon: 'grid', c: 'text-admin-champ' },
  project: { label: 'Projeto', icon: 'layout', c: 'text-admin-sage' },
  briefing: { label: 'Briefing', icon: 'tag', c: 'text-admin-gold' },
  proposal: { label: 'Proposta', icon: 'mail', c: 'text-admin-champ' },
  event: { label: 'Evento', icon: 'calendar', c: 'text-admin-copper' },
  course: { label: 'Curso', icon: 'book', c: 'text-admin-sage' },
  order: { label: 'Pedido', icon: 'cart', c: 'text-admin-gold' },
  collection: { label: 'Coleção', icon: 'layers', c: 'text-admin-champ' },
}
const fmt = (d) => { try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) } catch { return '' } }

export function TimelineViva({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!tenantId) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const q = (t, sel, extra) => { let b = supabase.from(t).select(sel).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30); return b }
        const [posts, projects, briefings, proposals, events, courses, orders, collections] = await Promise.all([
          q('network_posts', 'id,body,created_at'),
          q('network_projects', 'id,name,created_at'),
          q('service_requests', 'id,title,created_at'),
          q('service_proposals', 'id,author_name,created_at,request_id'),
          q('network_events', 'id,title,created_at'),
          q('network_academy_courses', 'id,title,created_at'),
          supabase.from('buyer_orders').select('id,supplier_name,code,total,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30),
          q('network_collections', 'id,title,created_at'),
        ])
        const merged = [
          ...(posts.data || []).map((x) => ({ type: 'post', at: x.created_at, title: 'Você publicou no feed', sub: (x.body || '').slice(0, 80) })),
          ...(projects.data || []).map((x) => ({ type: 'project', at: x.created_at, title: `Projeto "${x.name}" criado` })),
          ...(briefings.data || []).map((x) => ({ type: 'briefing', at: x.created_at, title: `Briefing publicado: ${x.title}` })),
          ...(proposals.data || []).map((x) => ({ type: 'proposal', at: x.created_at, title: `Proposta enviada por ${x.author_name || 'profissional'}` })),
          ...(events.data || []).map((x) => ({ type: 'event', at: x.created_at, title: `Evento criado: ${x.title}` })),
          ...(courses.data || []).map((x) => ({ type: 'course', at: x.created_at, title: `Curso publicado: ${x.title}` })),
          ...(orders.data || []).map((x) => ({ type: 'order', at: x.created_at, title: `Pedido ${x.code || ''} · ${x.supplier_name || 'fornecedor'}`, sub: x.total ? `R$ ${Number(x.total).toLocaleString('pt-BR')}` : '' })),
          ...(collections.data || []).map((x) => ({ type: 'collection', at: x.created_at, title: `Coleção "${x.title}" criada` })),
        ].filter((x) => x.at).sort((a, b) => new Date(b.at) - new Date(a.at))
        if (alive) setItems(merged)
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [tenantId])

  const shown = useMemo(() => filter === 'all' ? items : items.filter((i) => i.type === filter), [items, filter])
  // agrupa por dia
  const byDay = useMemo(() => {
    const g = {}
    shown.forEach((i) => { const k = fmt(i.at); (g[k] ||= []).push(i) })
    return Object.entries(g)
  }, [shown])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Timeline Viva</h1><p className="text-admin-muted/50 text-sm mt-1">A memória viva da sua jornada no ecossistema.</p></div>
        <div className="w-44"><GlassSelect value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tudo' }, ...Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label }))]} /></div>
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass rounded-2xl h-16 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="clock" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Sua timeline começa aqui. Publique, crie projetos e participe do ecossistema.</p></div>
          : <div className="space-y-6">
              {byDay.map(([day, list]) => (
                <div key={day}>
                  <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">{day}</p>
                  <div className="relative pl-6 space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-white/[0.08]">
                    {list.map((i, idx) => { const t = TYPES[i.type] || TYPES.post; return (
                      <div key={idx} className="relative">
                        <span className={`absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full bg-admin-side ring-2 ring-white/[0.08] flex items-center justify-center ${t.c}`}><span className="w-1.5 h-1.5 rounded-full bg-current" /></span>
                        <div className="glass rounded-xl p-3 flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${t.c}`}><Icon name={t.icon} className="w-4 h-4" /></div>
                          <div className="min-w-0 flex-1"><p className="text-admin-text text-sm">{i.title}</p>{i.sub && <p className="text-admin-muted/45 text-xs mt-0.5 truncate">{i.sub}</p>}<p className="text-admin-muted/30 text-[10px] mt-1">{timeAgo(i.at)}</p></div>
                          <span className={`text-[9px] uppercase tracking-wider shrink-0 ${t.c}`}>{t.label}</span>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ))}
            </div>}
    </div>
  )
}
