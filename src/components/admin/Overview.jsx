import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Icon } from './ui'

function BarChart({ data, color }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-2 h-44">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <span className="text-[10px] text-admin-text mb-1">{d.value}</span>
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value > 0 ? '4px' : '0',
              background: color,
            }}
          />
          <span className="text-[9px] text-admin-muted/60 mt-2 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Overview({ go }) {
  const [stats, setStats] = useState({ specialties: 0, portfolio: 0, messages: 0, unread: 0, posts: 0, testimonials: 0, faqs: 0 })
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    ;(async () => {
      const count = (q) => q.then((r) => r.count || 0)
      const [specialties, portfolio, messages, unread, posts, testimonials, faqs] = await Promise.all([
        count(supabase.from('specialties').select('*', { count: 'exact', head: true })),
        count(supabase.from('portfolio_items').select('*', { count: 'exact', head: true })),
        count(supabase.from('contact_submissions').select('*', { count: 'exact', head: true })),
        count(supabase.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false)),
        count(supabase.from('posts').select('*', { count: 'exact', head: true })),
        count(supabase.from('testimonials').select('*', { count: 'exact', head: true })),
        count(supabase.from('faqs').select('*', { count: 'exact', head: true })),
      ])
      setStats({ specialties, portfolio, messages, unread, posts, testimonials, faqs })

      const since = new Date()
      since.setHours(0, 0, 0, 0)
      since.setDate(since.getDate() - 13)
      const days = []
      for (let i = 0; i < 14; i++) {
        const dt = new Date(since)
        dt.setDate(since.getDate() + i)
        days.push({ key: dt.toISOString().slice(0, 10), label: String(dt.getDate()), value: 0 })
      }
      const { data: msgs } = await supabase
        .from('contact_submissions')
        .select('created_at')
        .gte('created_at', since.toISOString())
      ;(msgs || []).forEach((m) => {
        const k = new Date(m.created_at).toISOString().slice(0, 10)
        const b = days.find((x) => x.key === k)
        if (b) b.value++
      })
      setTimeline(days)
    })()
  }, [])

  const cards = [
    { key: 'services', icon: 'spark', label: 'Serviços', value: stats.specialties, accent: 'text-admin-gold' },
    { key: 'portfolio', icon: 'image', label: 'Projetos', value: stats.portfolio, accent: 'text-admin-sage' },
    { key: 'messages', icon: 'mail', label: 'Mensagens', value: stats.messages, accent: 'text-admin-rose' },
    { key: 'messages', icon: 'star', label: 'Não lidas', value: stats.unread, accent: 'text-admin-champ' },
  ]

  const contentData = [
    { label: 'Serviços', value: stats.specialties },
    { label: 'Projetos', value: stats.portfolio },
    { label: 'Jornal', value: stats.posts },
    { label: 'Depoim.', value: stats.testimonials },
    { label: 'FAQ', value: stats.faqs },
  ]

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-serif text-5xl text-admin-text">Visão geral</h1>
        <p className="text-admin-muted/70 mt-2">Bem-vindo ao backstage da Seravie Experiences.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((c, i) => (
          <button key={i} onClick={() => go(c.key)} className="text-left">
            <div className="glass lift rounded-2xl p-6">
              <span className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-6 ${c.accent}`}>
                <Icon name={c.icon} className="w-5 h-5" />
              </span>
              <div className={`font-serif text-5xl ${c.accent}`}>{c.value}</div>
              <div className="text-[11px] tracking-widerx uppercase text-admin-muted/60 mt-2">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-14">
        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-admin-champ mb-6">Distribuição de conteúdo</h2>
          <BarChart data={contentData} color="#B89C61" />
        </Card>
        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-admin-champ mb-6">Mensagens — últimos 14 dias</h2>
          <BarChart data={timeline} color="#C1835B" />
        </Card>
      </div>

      <h2 className="text-[11px] tracking-widerx uppercase text-admin-champ mb-5">Ações rápidas</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'content', icon: 'layout', label: 'Editar hero e seções' },
          { key: 'jornal', icon: 'book', label: 'Escrever no Jornal' },
          { key: 'portfolio', icon: 'image', label: 'Adicionar projeto' },
          { key: 'media', icon: 'folder', label: 'Biblioteca de mídia' },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => go(a.key)}
            className="glass-soft lift rounded-2xl flex items-center gap-3 p-5 text-admin-muted hover:text-admin-champ transition-colors"
          >
            <Icon name={a.icon} className="w-5 h-5 text-admin-champ" />
            <span className="text-sm">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
