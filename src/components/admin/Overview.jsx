import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

export function Overview({ go }) {
  const [stats, setStats] = useState({ specialties: 0, portfolio: 0, messages: 0, unread: 0 })

  useEffect(() => {
    ;(async () => {
      const [sp, pf, ms, un] = await Promise.all([
        supabase.from('specialties').select('*', { count: 'exact', head: true }),
        supabase.from('portfolio_items').select('*', { count: 'exact', head: true }),
        supabase.from('contact_submissions').select('*', { count: 'exact', head: true }),
        supabase.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false),
      ])
      setStats({
        specialties: sp.count || 0,
        portfolio: pf.count || 0,
        messages: ms.count || 0,
        unread: un.count || 0,
      })
    })()
  }, [])

  const cards = [
    { key: 'services', icon: 'spark', label: 'Serviços', value: stats.specialties, accent: 'text-admin-gold' },
    { key: 'portfolio', icon: 'image', label: 'Projetos', value: stats.portfolio, accent: 'text-admin-sage' },
    { key: 'messages', icon: 'mail', label: 'Mensagens', value: stats.messages, accent: 'text-admin-rose' },
    { key: 'messages', icon: 'star', label: 'Não lidas', value: stats.unread, accent: 'text-admin-champ' },
  ]

  const actions = [
    { key: 'content', icon: 'layout', label: 'Editar hero e seções' },
    { key: 'services', icon: 'spark', label: 'Gerenciar serviços' },
    { key: 'portfolio', icon: 'image', label: 'Adicionar projeto' },
    { key: 'media', icon: 'folder', label: 'Biblioteca de mídia' },
  ]

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-serif text-5xl text-admin-text">Visão geral</h1>
        <p className="text-admin-muted/70 mt-2">Bem-vindo ao backstage da Seravie Experiences.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
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

      <h2 className="text-[11px] tracking-widerx uppercase text-admin-champ mb-5">Ações rápidas</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((a) => (
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
