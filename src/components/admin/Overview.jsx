import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Icon } from './ui'

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
    { key: 'services', icon: 'spark', label: 'Serviços', value: stats.specialties },
    { key: 'portfolio', icon: 'image', label: 'Projetos', value: stats.portfolio },
    { key: 'messages', icon: 'mail', label: 'Mensagens', value: stats.messages },
    { key: 'messages', icon: 'star', label: 'Não lidas', value: stats.unread },
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
        <h1 className="font-serif text-4xl text-ivory">Visão geral</h1>
        <p className="text-ivory/45 mt-2">Bem-vindo ao painel da Seravie Experiences.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {cards.map((c, i) => (
          <button key={i} onClick={() => go(c.key)} className="text-left">
            <Card className="p-6 hover:border-gold/40 transition-colors">
              <span className="w-11 h-11 rounded-full border border-gold/30 flex items-center justify-center text-gold mb-5">
                <Icon name={c.icon} className="w-5 h-5" />
              </span>
              <div className="font-serif text-4xl text-ivory">{c.value}</div>
              <div className="text-[11px] tracking-widerx uppercase text-ivory/45 mt-1">{c.label}</div>
            </Card>
          </button>
        ))}
      </div>

      <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-4">Ações rápidas</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => go(a.key)}
            className="flex items-center gap-3 p-4 rounded-xl border border-gold/15 bg-moss/20 text-ivory/75 hover:border-gold/40 hover:text-gold transition-colors"
          >
            <Icon name={a.icon} className="w-5 h-5 text-gold" />
            <span className="text-sm">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
