import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { timeAgo } from '../../../lib/networkSocial'

// Dashboard do Network — visão geral do ecossistema social: métricas reais e
// atividade recente. Ponto de entrada que orienta o membro pelo que existe.

async function count(table, filter) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count: c } = await q
  return c || 0
}

export function NetworkDashboard({ me, notify, onNavigate }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [members, communities, events, projects, briefings, courses, posts] = await Promise.all([
          count('network_members', (q) => q.eq('status', 'active')),
          count('network_communities'),
          count('network_events'),
          count('network_projects'),
          count('service_requests', (q) => q.eq('status', 'open')),
          count('network_academy_courses', (q) => q.eq('status', 'published')),
          count('network_posts'),
        ])
        // atividade recente: últimos posts, eventos e briefings
        const [{ data: recentPosts }, { data: recentEvents }, { data: recentReq }] = await Promise.all([
          supabase.from('network_posts').select('id,author_name,body,created_at').order('created_at', { ascending: false }).limit(4),
          supabase.from('network_events').select('id,title,starts_at,created_at').order('created_at', { ascending: false }).limit(3),
          supabase.from('service_requests').select('id,title,created_at').order('created_at', { ascending: false }).limit(3),
        ])
        const feed = [
          ...(recentPosts || []).map((p) => ({ kind: 'post', icon: 'grid', title: p.author_name || 'Membro', text: p.body, at: p.created_at, route: 'feed' })),
          ...(recentEvents || []).map((e) => ({ kind: 'event', icon: 'calendar', title: e.title, text: 'Novo evento', at: e.created_at, route: 'events' })),
          ...(recentReq || []).map((r) => ({ kind: 'req', icon: 'tag', title: r.title, text: 'Novo briefing no Marketplace', at: r.created_at, route: 'services' })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)
        if (alive) { setStats({ members, communities, events, projects, briefings, courses, posts }); setActivity(feed) }
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [tenantId])

  const CARDS = [
    { key: 'people', icon: 'users', label: 'Profissionais', value: stats?.members, hint: 'na rede' },
    { key: 'communities', icon: 'grid', label: 'Comunidades', value: stats?.communities, hint: 'ativas' },
    { key: 'events', icon: 'calendar', label: 'Eventos', value: stats?.events, hint: 'no ecossistema' },
    { key: 'projects', icon: 'layout', label: 'Projetos', value: stats?.projects, hint: 'colaborativos' },
    { key: 'services', icon: 'tag', label: 'Briefings abertos', value: stats?.briefings, hint: 'no Marketplace' },
    { key: 'academy', icon: 'book', label: 'Cursos', value: stats?.courses, hint: 'na Academy' },
  ]

  return (
    <div>
      <div className="mb-6"><h1 className="font-serif text-2xl text-admin-text">Visão geral</h1><p className="text-admin-muted/50 text-sm mt-1">O pulso do ecossistema Seravie Network.</p></div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-28 animate-pulse opacity-40" />)}</div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {CARDS.map((c) => (
              <button key={c.key} onClick={() => onNavigate?.(c.key)} className="glass rounded-2xl p-5 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center mb-3 group-hover:bg-admin-champ/20 transition-colors"><Icon name={c.icon} className="w-5 h-5 text-admin-champ/70" /></div>
                <p className="text-3xl font-serif text-admin-text">{(c.value || 0).toLocaleString('pt-BR')}</p>
                <p className="text-admin-muted/50 text-xs mt-1">{c.label} <span className="text-admin-muted/30">· {c.hint}</span></p>
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Atividade recente</p>
              {activity.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><p className="text-admin-muted/50 text-sm">Sem atividade recente ainda.</p></div>
                : <div className="glass rounded-2xl divide-y divide-white/[0.05]">
                    {activity.map((a, i) => (
                      <button key={i} onClick={() => onNavigate?.(a.route)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name={a.icon} className="w-4 h-4 text-admin-champ/70" /></div>
                        <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{a.title}</p>{a.text && <p className="text-admin-muted/45 text-xs truncate">{a.text}</p>}</div>
                        <span className="text-admin-muted/35 text-[11px] shrink-0">{timeAgo(a.at)}</span>
                      </button>
                    ))}
                  </div>}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Atalhos</p>
              <div className="glass rounded-2xl p-2 space-y-1">
                {[
                  { key: 'smart', icon: 'sparkles', label: 'Conexões sugeridas' },
                  { key: 'map', icon: 'map', label: 'Mapa do ecossistema' },
                  { key: 'talent', icon: 'star', label: 'Banco de talentos' },
                  { key: 'collections', icon: 'layers', label: 'Coleções' },
                ].map((s) => (
                  <button key={s.key} onClick={() => onNavigate?.(s.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.03] transition-colors"><Icon name={s.icon} className="w-4 h-4 shrink-0" />{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
