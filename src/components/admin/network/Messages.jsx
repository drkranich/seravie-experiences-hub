import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { findBannedWords } from '../../../lib/moderation'
import { timeAgo, initials } from '../../../lib/networkSocial'
import { uploadTo } from '../../../lib/storage'
import { startVideoCall } from '../../../lib/videoCall'

// Mensagens diretas entre membros do Network (com moderação de termos ofensivos).

function Avatar({ name, url, size = 'w-9 h-9', text = 'text-xs' }) {
  return url ? <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
    : <div className={`${size} rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center shrink-0 ${text} font-medium`}>{initials(name)}</div>
}

export function Messages({ me, notify, startWith }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [threads, setThreads] = useState([])
  const [members, setMembers] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [banned, setBanned] = useState([])
  const [text, setText] = useState('')
  const [warn, setWarn] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [newChat, setNewChat] = useState(false)
  const [pick, setPick] = useState('')
  const bottomRef = useRef(null); const fileRef = useRef(null)

  const loadThreads = useCallback(async () => {
    const { data } = await supabase.from('network_dm_threads').select('*').order('last_message_at', { ascending: false })
    setThreads(data || [])
  }, [])
  useEffect(() => {
    loadThreads()
    supabase.from('moderation_words').select('word').then(({ data }) => setBanned((data || []).map((w) => w.word)))
    supabase.from('network_members').select('id,name,avatar_url,role_title,headline,tenant_id').eq('status', 'active').limit(300).then(({ data }) => setMembers(data || []))
  }, [loadThreads])

  const openThread = useCallback(async (t) => {
    setActive(t); setText(''); setAttachments([]); setWarn('')
    const { data } = await supabase.from('network_dm_messages').select('*').eq('thread_id', t.id).order('created_at')
    setMessages(data || [])
  }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // inicia conversa com um membro (do deep-link ou do "nova conversa")
  const startThread = useCallback(async (member) => {
    if (!member) return
    // procura thread existente entre os dois tenants
    const other = member.tenant_id
    let { data: existing } = await supabase.from('network_dm_threads').select('*')
      .or(`and(a_tenant.eq.${tenantId},b_tenant.eq.${other}),and(a_tenant.eq.${other},b_tenant.eq.${tenantId})`).maybeSingle()
    if (!existing) {
      const { data: created } = await supabase.from('network_dm_threads').insert({ tenant_id: tenantId, a_member: me?.id, b_member: member.id, a_tenant: tenantId, b_tenant: other }).select('*').maybeSingle()
      existing = created
    }
    if (existing) { await loadThreads(); openThread(existing); setNewChat(false); setPick('') }
  }, [tenantId, me, loadThreads, openThread])

  useEffect(() => { if (startWith && members.length) { const m = members.find((x) => x.id === startWith); if (m) startThread(m) } }, [startWith, members, startThread])

  const memberByTenant = (t) => members.find((m) => m.tenant_id === t)
  const otherOf = (t) => (t.a_tenant === tenantId ? t.b_tenant : t.a_tenant)

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setUploading(true)
    for (const file of files) { const isImg = file.type.startsWith('image/'); const r = await uploadTo(file, { folder: 'network/dm', accept: 'any', maxMB: 20 }); if (r.error) { notify?.(r.error, 'error'); continue } setAttachments((a) => [...a, { name: file.name, url: r.url, type: isImg ? 'image' : 'file' }]) }
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
  }
  const onType = (v) => { setText(v); const h = findBannedWords(v, banned); setWarn(h.length ? `Termo(s) que violam a política: "${h.join(', ')}".` : '') }
  const send = async () => {
    const body = text.trim()
    if ((!body && attachments.length === 0) || !active) return
    if (findBannedWords(body, banned).length) { notify?.('Mensagem bloqueada pela política da plataforma.', 'error'); return }
    const { data, error } = await supabase.from('network_dm_messages').insert({ thread_id: active.id, sender_tenant: tenantId, sender_name: me?.name || 'Você', sender_avatar: me?.avatar_url || null, body: body || '📎 Anexo', attachments }).select('*').single()
    if (error) return notify?.('Não foi possível enviar: ' + error.message, 'error')
    setMessages((m) => [...m, data]); setText(''); setAttachments([]); setWarn('')
    await supabase.from('network_dm_threads').update({ last_message_at: new Date().toISOString() }).eq('id', active.id)
    // notifica o outro lado
    const other = otherOf(active)
    supabase.from('notifications').insert({ tenant_id: other, kind: 'message', title: `Nova mensagem de ${me?.name || 'um membro'}`, body: (body || 'Anexo').slice(0, 80), icon: 'mail', link_route: 'network_hub', actor_name: me?.name })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Mensagens</h1><p className="text-admin-muted/50 text-sm mt-1">Converse diretamente com profissionais e empresas da rede.</p></div>
        <button onClick={() => setNewChat(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Nova conversa</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-20rem)] min-h-[28rem]">
        {/* lista */}
        <div className="glass-soft rounded-2xl p-2 overflow-y-auto space-y-1">
          {threads.length === 0 ? <p className="text-admin-muted/30 text-xs text-center py-8">Nenhuma conversa ainda.</p>
            : threads.map((t) => { const m = memberByTenant(otherOf(t)); return (
                <button key={t.id} onClick={() => openThread(t)} className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${active?.id === t.id ? 'bg-admin-champ/10' : 'hover:bg-white/[0.03]'}`}>
                  <Avatar name={m?.name} url={m?.avatar_url} size="w-9 h-9" />
                  <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{m?.name || 'Membro'}</p><p className="text-admin-muted/40 text-[11px] truncate">{m?.headline || m?.role_title || ''}</p></div>
                  <span className="text-admin-muted/30 text-[10px]">{timeAgo(t.last_message_at)}</span>
                </button>
              )})}
        </div>

        {/* thread */}
        <div className="lg:col-span-2 glass-soft rounded-2xl flex flex-col overflow-hidden">
          {!active ? <div className="flex-1 flex items-center justify-center text-admin-muted/40 text-sm">Selecione uma conversa</div> : (
            <>
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
                {(() => { const m = memberByTenant(otherOf(active)); return <><Avatar name={m?.name} url={m?.avatar_url} size="w-8 h-8" /><div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{m?.name || 'Conversa'}</p><p className="text-admin-muted/40 text-[11px] truncate">{m?.headline || m?.role_title || ''}</p></div></> })()}
                <button onClick={() => startVideoCall('dm-' + active.id)} className="ml-auto w-8 h-8 rounded-lg glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center shrink-0 transition-colors" title="Iniciar videochamada"><Icon name="tv" className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? <p className="text-admin-muted/35 text-xs text-center py-8">Inicie a conversa.</p>
                  : messages.map((m) => { const mine = m.sender_tenant === tenantId; return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-admin-champ/15 text-admin-text' : 'glass text-admin-text/90'}`}>
                          {(m.attachments || []).length > 0 && <div className="space-y-1.5 mb-1.5">{m.attachments.map((att, i) => att.type === 'image' ? <a key={i} href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} className="rounded-lg max-h-40 object-cover" /></a> : <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1]"><Icon name="book" className="w-4 h-4 text-admin-champ/70 shrink-0" /><span className="truncate text-xs">{att.name}</span></a>)}</div>}
                          {m.body && m.body !== '📎 Anexo' && <p className="whitespace-pre-wrap">{m.body}</p>}
                          <p className={`text-[9px] mt-1 ${mine ? 'text-admin-champ/50 text-right' : 'text-admin-muted/30'}`}>{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    )})}
                <div ref={bottomRef} />
              </div>
              {warn && <div className="px-4 py-2 bg-admin-rose/[0.08] border-t border-admin-rose/15 text-admin-rose/90 text-[11px] flex items-center gap-2 shrink-0"><Icon name="warning" className="w-3.5 h-3.5" />{warn}</div>}
              <div className="p-3 border-t border-white/[0.06] shrink-0">
                {attachments.length > 0 && <div className="flex flex-wrap gap-2 mb-2">{attachments.map((att, i) => <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.05] text-xs text-admin-text/80"><Icon name={att.type === 'image' ? 'image' : 'book'} className="w-3.5 h-3.5 text-admin-champ/60" /><span className="truncate max-w-[8rem]">{att.name}</span><button onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button></div>)}</div>}
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" multiple onChange={onFile} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="glass-input rounded-xl px-3 flex items-center justify-center text-admin-muted hover:text-admin-champ transition-colors disabled:opacity-50"><Icon name={uploading ? 'clock' : 'plus'} className="w-4 h-4" /></button>
                  <input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escreva uma mensagem…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                  <button onClick={send} disabled={(!text.trim() && attachments.length === 0) || !!warn} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 rounded-xl text-sm transition-colors disabled:opacity-40">Enviar</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {newChat && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setNewChat(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Nova conversa</h2><button onClick={() => setNewChat(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <GlassSelect value={pick} onChange={setPick} options={[{ value: '', label: 'Selecione um membro' }, ...members.filter((m) => m.tenant_id !== tenantId).map((m) => ({ value: m.id, label: `${m.name}${m.role_title ? ' · ' + m.role_title : ''}` }))]} />
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setNewChat(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => pick && startThread(members.find((m) => m.id === pick))} disabled={!pick} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">Conversar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
