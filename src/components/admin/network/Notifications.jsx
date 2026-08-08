import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { timeAgo } from '../../../lib/networkSocial'

// Sino de notificações do ecossistema (Network + Suppliers).
// Usado no cabeçalho do Network; abre um painel com as notificações do tenant.

export function NotificationsBell({ onNavigate, notify }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50); setItems(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const unread = items.filter((n) => !n.read_at).length
  const markAll = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id)
    if (!ids.length) return
    setItems((p) => p.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
  }
  const openItem = async (n) => {
    if (!n.read_at) { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); setItems((p) => p.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) }
    if (n.link_route && onNavigate) onNavigate(n.link_route)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) load() }} className="relative w-9 h-9 rounded-full glass-input flex items-center justify-center text-admin-muted/70 hover:text-admin-champ transition-colors" title="Notificações">
        <Icon name="bell" className="w-4 h-4" />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-admin-champ text-black text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] glass-pop rounded-2xl overflow-hidden z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
              <p className="text-admin-text text-sm font-medium">Notificações</p>
              {unread > 0 && <button onClick={markAll} className="text-[11px] text-admin-champ/80 hover:text-admin-champ">Marcar todas como lidas</button>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <p className="text-admin-muted/30 text-xs text-center py-8">Carregando…</p>
                : items.length === 0 ? <div className="text-center py-10"><Icon name="bell" className="w-8 h-8 text-admin-champ/20 mx-auto mb-2" /><p className="text-admin-muted/50 text-sm">Nenhuma notificação.</p></div>
                  : items.map((n) => (
                      <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 flex gap-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${!n.read_at ? 'bg-admin-champ/[0.05]' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.read_at ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/50'}`}><Icon name={n.icon || 'bell'} className="w-4 h-4" /></div>
                        <div className="min-w-0 flex-1"><p className="text-admin-text text-sm leading-snug">{n.title}</p>{n.body && <p className="text-admin-muted/50 text-xs mt-0.5 line-clamp-2">{n.body}</p>}<p className="text-admin-muted/30 text-[10px] mt-1">{timeAgo(n.created_at)}</p></div>
                        {!n.read_at && <span className="w-2 h-2 rounded-full bg-admin-champ shrink-0 mt-1.5" />}
                      </button>
                    ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
