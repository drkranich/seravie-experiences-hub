import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

const CHANNELS = {
  whatsapp: { label: 'WhatsApp', icon: 'chart', color: 'sage' },
  instagram: { label: 'Instagram', icon: 'star', color: 'rose' },
  messenger: { label: 'Messenger', icon: 'mail', color: 'champ' },
  email: { label: 'E-mail', icon: 'mail', color: 'champ' },
  telegram: { label: 'Telegram', icon: 'chart', color: 'champ' },
  chat: { label: 'Chat', icon: 'mail', color: 'gold' },
  phone: { label: 'Telefone', icon: 'user', color: 'copper' },
}
const COL = { sage: 'bg-admin-sage/12 text-admin-sage', rose: 'bg-admin-rose/12 text-admin-rose', champ: 'bg-admin-champ/12 text-admin-champ', gold: 'bg-admin-gold/12 text-admin-gold', copper: 'bg-admin-copper/12 text-admin-copper' }
const timeAgo = (d) => { if (!d) return ''; const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return 'agora'; if (s < 3600) return `${Math.floor(s / 60)}min`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d` }

// Comunicação omnichannel — todas as conversas dos clientes numa tela.
export function Omnichannel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')       // canal
  const [active, setActive] = useState(null)      // conversa aberta
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('conversations').select('*, contact:contacts(name, phone, email)').order('last_message_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200)
      setConvs(data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openConv = async (c) => {
    setActive(c); setMessages([])
    try { const { data } = await supabase.from('messages').select('*').eq('conversation_id', c.id).order('created_at'); setMessages(data || []) } catch { /* noop */ }
  }
  const send = async () => {
    if (!reply.trim() || !active) return
    setSending(true)
    try {
      const { data } = await supabase.from('messages').insert({ tenant_id: tenantId, conversation_id: active.id, sender_type: 'agent', sender_id: profile?.user_id, content: reply.trim(), content_type: 'text' }).select('*').single()
      setMessages((m) => [...m, data]); setReply('')
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'open' }).eq('id', active.id)
    } catch (e) { notify('Erro ao enviar: ' + (e.message || e), 'error') } finally { setSending(false) }
  }

  const channels = [...new Set(convs.map((c) => c.channel).filter(Boolean))]
  const list = filter ? convs.filter((c) => c.channel === filter) : convs

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <p className="text-admin-muted/50 text-xs flex-1 min-w-[12rem]">Todas as conversas dos clientes — WhatsApp, Instagram, e-mail, chat — num só lugar.</p>
        <button onClick={() => setFilter('')} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todos</button>
        {channels.map((ch) => (
          <button key={ch} onClick={() => setFilter(ch)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === ch ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{CHANNELS[ch]?.label || ch}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando conversas…</p>
        : convs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Icon name="mail" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
            <p className="text-admin-muted/50 text-sm">Nenhuma conversa ainda.</p>
            <p className="text-admin-muted/30 text-xs mt-1">As conversas dos canais conectados (WhatsApp, Instagram, e-mail) aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-18rem)] min-h-[28rem]">
            {/* lista de conversas */}
            <div className="glass-soft rounded-2xl p-2 overflow-y-auto space-y-1">
              {list.map((c) => {
                const ch = CHANNELS[c.channel] || { label: c.channel, icon: 'mail', color: 'champ' }
                return (
                  <button key={c.id} onClick={() => openConv(c)} className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${active?.id === c.id ? 'bg-admin-champ/10' : 'hover:bg-white/[0.03]'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${COL[ch.color]}`}><Icon name={ch.icon} className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-admin-text text-sm truncate">{c.contact?.name || c.subject || 'Sem nome'}</p>
                        <p className="text-admin-muted/40 text-[11px] truncate">{ch.label}{c.subject ? ` · ${c.subject}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-admin-muted/30 text-[10px]">{timeAgo(c.last_message_at || c.created_at)}</span>
                        {c.status && c.status !== 'closed' && <span className="block w-2 h-2 rounded-full bg-admin-sage ml-auto mt-1" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* thread */}
            <div className="lg:col-span-2 glass-soft rounded-2xl flex flex-col overflow-hidden">
              {!active ? (
                <div className="flex-1 flex items-center justify-center text-admin-muted/40 text-sm">Selecione uma conversa</div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${COL[CHANNELS[active.channel]?.color || 'champ']}`}><Icon name={CHANNELS[active.channel]?.icon || 'mail'} className="w-4 h-4" /></div>
                    <div className="min-w-0"><p className="text-admin-text text-sm">{active.contact?.name || active.subject || 'Conversa'}</p><p className="text-admin-muted/40 text-[11px]">{CHANNELS[active.channel]?.label || active.channel}{active.contact?.phone ? ` · ${active.contact.phone}` : ''}</p></div>
                    {active.contact?.phone && <a href={`https://wa.me/${String(active.contact.phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="ml-auto text-xs text-admin-sage hover:underline flex items-center gap-1"><Icon name="chart" className="w-3.5 h-3.5" />WhatsApp</a>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? <p className="text-admin-muted/30 text-xs text-center py-6">Sem mensagens nesta conversa.</p> : messages.map((m) => {
                      const mine = m.sender_type === 'agent'
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-admin-champ/15 text-admin-text' : 'glass text-admin-text/90'}`}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            <p className={`text-[9px] mt-1 ${mine ? 'text-admin-champ/50' : 'text-admin-muted/30'}`}>{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-3 border-t border-white/[0.06] flex gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escreva uma resposta…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                    <button disabled={sending || !reply.trim()} onClick={send} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 rounded-xl text-sm transition-colors disabled:opacity-50">Enviar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
