import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const CHANNELS = ['email','whatsapp','instagram','messenger','chat','internal']
const CHANNEL_ICONS = { email:'mail', whatsapp:'mail', instagram:'star', messenger:'mail', chat:'mail', internal:'user', phone:'user', telegram:'mail', google_business:'leaf' }
const STATUS_COLORS = { open:'text-admin-sage', pending:'text-admin-gold', resolved:'text-admin-muted', closed:'text-admin-muted/40' }

export function ConversationsInbox({ notify }) {
  const { profile } = useTenant()
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('open')
  const [filterChannel, setFilterChannel] = useState('')
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const loadConversations = async () => {
    setLoading(true)
    let q = supabase.from('conversations').select('*, contacts(name, email)').order('last_message_at', { ascending: false }).limit(50)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterChannel) q = q.eq('channel', filterChannel)
    const { data } = await q
    setConversations(data || [])
    setLoading(false)
  }

  const loadMessages = async (convId) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at')
    setMessages(data || [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => { loadConversations() }, [filterStatus, filterChannel])
  useEffect(() => { if (active) loadMessages(active.id) }, [active])

  const send = async () => {
    if (!newMsg.trim() || !active) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      tenant_id: profile?.tenant_id,
      conversation_id: active.id,
      sender_type: 'agent',
      sender_id: profile?.user_id,
      content: newMsg.trim(),
      content_type: 'text'
    })
    if (!error) {
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'pending' }).eq('id', active.id)
      setNewMsg('')
      loadMessages(active.id)
      loadConversations()
    } else notify('Erro ao enviar', 'error')
    setSending(false)
  }

  const updateStatus = async (status) => {
    await supabase.from('conversations').update({ status }).eq('id', active.id)
    setActive(c => ({ ...c, status }))
    loadConversations()
    notify('Status atualizado', 'success')
  }

  const newConversation = async () => {
    const { data, error } = await supabase.from('conversations').insert({
      tenant_id: profile?.tenant_id,
      channel: 'internal',
      subject: 'Nova conversa',
      status: 'open'
    }).select().single()
    if (!error) { loadConversations(); setActive(data) }
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-140px)] -mx-6 lg:-mx-10">
      {/* Lista de conversas */}
      <div className="w-72 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-admin-text">Conversas</h2>
            <button onClick={newConversation} className="text-admin-champ hover:bg-admin-champ/10 p-1.5 rounded-lg transition-colors">
              <Icon name="spark" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['open','pending','resolved'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s === filterStatus ? '' : s)}
                className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors capitalize ${filterStatus === s ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/50 hover:text-admin-muted'}`}>
                {s === 'open' ? 'Abertas' : s === 'pending' ? 'Pendentes' : 'Resolvidas'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="text-admin-muted/30 text-sm p-4">Carregando…</p>
            : conversations.length === 0
              ? <div className="p-6 text-center"><Icon name="mail" className="w-8 h-8 text-admin-champ/20 mx-auto mb-2" /><p className="text-admin-muted/40 text-xs">Nenhuma conversa</p></div>
              : conversations.map(c => (
                <button key={c.id} onClick={() => setActive(c)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${active?.id === c.id ? 'bg-white/[0.05]' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={CHANNEL_ICONS[c.channel] || 'mail'} className="w-3.5 h-3.5 text-admin-champ/60" />
                    <p className="text-admin-text text-xs font-medium truncate flex-1">{c.contacts?.name || c.subject || 'Sem nome'}</p>
                    <span className={`text-[9px] ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-admin-muted/40 text-[11px] truncate">{c.subject || c.channel}</p>
                  <p className="text-admin-muted/30 text-[10px] mt-0.5">{new Date(c.last_message_at).toLocaleDateString('pt-BR')}</p>
                </button>
              ))
          }
        </div>
      </div>

      {/* Thread de mensagens */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <p className="text-admin-text text-sm font-medium">{active.contacts?.name || active.subject || 'Conversa'}</p>
              <p className="text-admin-muted/40 text-xs capitalize">{active.channel} · {active.status}</p>
            </div>
            <div className="flex gap-2">
              {active.status !== 'resolved' && (
                <button onClick={() => updateStatus('resolved')}
                  className="text-[10px] px-3 py-1.5 rounded-lg bg-admin-sage/10 text-admin-sage hover:bg-admin-sage/20 transition-colors">
                  Resolver
                </button>
              )}
              {active.status !== 'closed' && (
                <button onClick={() => updateStatus('closed')}
                  className="text-[10px] px-3 py-1.5 rounded-lg text-admin-muted/50 hover:text-admin-muted hover:bg-white/[0.03] transition-colors">
                  Fechar
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.length === 0
              ? <p className="text-admin-muted/30 text-sm text-center py-8">Nenhuma mensagem ainda</p>
              : messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                    m.sender_type === 'agent'
                      ? 'bg-admin-champ/15 text-admin-text rounded-br-sm'
                      : m.is_internal
                        ? 'bg-admin-gold/10 border border-admin-gold/20 text-admin-gold text-xs italic'
                        : 'bg-white/[0.05] text-admin-text rounded-bl-sm'
                  }`}>
                    {m.is_internal && <span className="text-[9px] block mb-1 opacity-60">nota interna</span>}
                    <p>{m.content}</p>
                    <p className="text-[9px] opacity-40 mt-1">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            }
            <div ref={bottomRef} />
          </div>

          <div className="px-5 py-3.5 border-t border-white/[0.06]">
            <div className="flex gap-3">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Digite uma mensagem…"
                className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
              <button onClick={send} disabled={sending || !newMsg.trim()}
                className="px-4 py-2.5 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ rounded-xl transition-colors disabled:opacity-40">
                <Icon name="spark" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icon name="mail" className="w-12 h-12 text-admin-champ/20 mx-auto mb-3" />
            <p className="text-admin-muted/40 text-sm">Selecione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  )
}
