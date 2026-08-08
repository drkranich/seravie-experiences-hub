import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { uploadTo } from '../../../lib/storage'

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
  const [attachments, setAttachments] = useState([]) // {name, url, type}
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('conversations').select('*, contact:contacts(name, phone, email)').order('last_message_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200)
      setConvs(data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openConv = async (c) => {
    setActive(c); setMessages([]); setAttachments([]); setReply('')
    try { const { data } = await supabase.from('messages').select('*').eq('conversation_id', c.id).order('created_at'); setMessages(data || []) } catch { /* noop */ }
  }
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const isImg = file.type.startsWith('image/')
      const r = await uploadTo(file, { folder: 'conversas', accept: 'any', maxMB: 20 })
      if (r.error) { notify(r.error, 'error'); continue }
      setAttachments((a) => [...a, { name: file.name, url: r.url, type: isImg ? 'image' : 'file' }])
    }
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
  }
  // Canais com envio automático (worker omni-send). Os demais seguem só registrando a mensagem.
  const AUTO_CHANNELS = ['whatsapp', 'instagram', 'email']

  const send = async () => {
    if ((!reply.trim() && attachments.length === 0) || !active) return
    setSending(true)
    try {
      const { data } = await supabase.from('messages').insert({ tenant_id: tenantId, conversation_id: active.id, sender_type: 'agent', sender_id: profile?.user_id, content: reply.trim() || (attachments.length ? '📎 Anexo' : ''), content_type: attachments.length ? 'file' : 'text', attachments }).select('*').single()
      setMessages((m) => [...m, data]); setReply(''); setAttachments([])
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'open' }).eq('id', active.id)

      // Envio real pelo canal da conversa (quando conectado). Se o canal não tiver
      // envio automático ou não estiver configurado, a mensagem fica só registrada.
      if (data && AUTO_CHANNELS.includes(active.channel)) {
        try {
          const { data: res, error: fnErr } = await supabase.functions.invoke('omni-send', { body: { message_id: data.id } })
          const delivery = res?.delivery
          if (delivery) {
            setMessages((m) => m.map((x) => (x.id === data.id ? { ...x, delivery } : x)))
            if (delivery.status === 'sent') notify('Mensagem enviada.', 'success')
            else if (delivery.status === 'skipped') notify('Registrada. Este canal ainda não envia automaticamente.', 'info')
            else notify('Registrada, mas o envio falhou: ' + (delivery.error || 'canal não configurado'), 'error')
          } else if (fnErr) {
            notify('Registrada. Envio automático indisponível: ' + (fnErr.message || 'função'), 'info')
          }
        } catch (fe) {
          notify('Mensagem registrada (envio automático indisponível).', 'info')
          void fe
        }
      }
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
                            {(m.attachments || []).length > 0 && (
                              <div className="space-y-1.5 mb-1.5">
                                {m.attachments.map((att, i) => att.type === 'image'
                                  ? <a key={i} href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} className="rounded-lg max-h-40 object-cover" /></a>
                                  : <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors"><Icon name="book" className="w-4 h-4 text-admin-champ/70 shrink-0" /><span className="truncate text-xs">{att.name}</span></a>
                                )}
                              </div>
                            )}
                            {m.content && m.content !== '📎 Anexo' && <p className="whitespace-pre-wrap">{m.content}</p>}
                            <p className={`text-[9px] mt-1 flex items-center gap-1 ${mine ? 'text-admin-champ/50 justify-end' : 'text-admin-muted/30'}`}>
                              {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {mine && m.delivery && (
                                m.delivery.status === 'sent'
                                  ? <span className="text-admin-sage" title={`Enviado via ${m.delivery.channel || ''}`}>✓ enviado</span>
                                  : m.delivery.status === 'skipped'
                                    ? <span className="text-admin-muted/40" title={m.delivery.error || ''}>registrado</span>
                                    : <span className="text-admin-rose" title={m.delivery.error || 'falha'}>⚠ falha</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-3 border-t border-white/[0.06]">
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.05] text-xs text-admin-text/80">
                            <Icon name={att.type === 'image' ? 'image' : 'book'} className="w-3.5 h-3.5 text-admin-champ/60" />
                            <span className="truncate max-w-[8rem]">{att.name}</span>
                            <button onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" multiple onChange={onFile} className="hidden" />
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="glass-input rounded-xl px-3 flex items-center justify-center text-admin-muted hover:text-admin-champ transition-colors disabled:opacity-50" title="Anexar arquivo ou imagem"><Icon name={uploading ? 'clock' : 'plus'} className="w-4 h-4" /></button>
                      <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escreva uma resposta…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                      <button disabled={sending || (!reply.trim() && attachments.length === 0)} onClick={send} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 rounded-xl text-sm transition-colors disabled:opacity-50">Enviar</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
