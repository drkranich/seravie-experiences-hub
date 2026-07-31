import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

export function AnalyticsPanel() {
  const [stats, setStats] = useState({ contacts:0, tickets:0, conversations:0, products:0, orders:0, campaigns:0, employees:0, checklists:0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const count = async (table) => { const { count: c } = await supabase.from(table).select('*', { count: 'exact', head: true }); return c || 0 }
      const [contacts, tickets, conversations, products, orders, campaigns, employees, checklists] = await Promise.all([
        count('contacts'), count('tickets'), count('conversations'), count('products'),
        count('orders'), count('campaigns'), count('employees'), count('checklists')
      ])
      setStats({ contacts, tickets, conversations, products, orders, campaigns, employees, checklists })
      setLoading(false)
    })()
  }, [])

  const CARDS = [
    { label: 'Contatos', value: stats.contacts, icon: 'user', color: 'text-admin-champ' },
    { label: 'Tickets', value: stats.tickets, icon: 'check', color: 'text-admin-rose' },
    { label: 'Conversas', value: stats.conversations, icon: 'mail', color: 'text-admin-gold' },
    { label: 'Produtos', value: stats.products, icon: 'image', color: 'text-admin-sage' },
    { label: 'Pedidos', value: stats.orders, icon: 'gift', color: 'text-admin-champ' },
    { label: 'Campanhas', value: stats.campaigns, icon: 'star', color: 'text-admin-gold' },
    { label: 'Colaboradores', value: stats.employees, icon: 'user', color: 'text-admin-sage' },
    { label: 'Checklists', value: stats.checklists, icon: 'check', color: 'text-admin-muted' },
  ]

  return (
    <div>
      <div className="mb-8"><h1 className="font-serif text-4xl text-admin-text">Analytics</h1><p className="text-admin-muted/60 text-sm mt-1">Visão consolidada da plataforma</p></div>
      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {CARDS.map(c => (
              <div key={c.label} className="glass rounded-xl p-5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${c.color} bg-current/10`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon name={c.icon} className={`w-4 h-4 ${c.color}`} />
                </div>
                <p className={`font-serif text-3xl ${c.color}`}>{c.value}</p>
                <p className="text-[11px] tracking-wider uppercase text-admin-muted/50 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-6 text-center">
            <Icon name="spark" className="w-8 h-8 text-admin-champ/20 mx-auto mb-3" />
            <p className="text-admin-text text-sm font-medium mb-1">Analytics avançado em breve</p>
            <p className="text-admin-muted/40 text-xs">Dashboards por papel, metas, funnels, cohorts e insights de IA</p>
          </div>
        </>
      )}
    </div>
  )
}
