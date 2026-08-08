import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { findBannedWords } from '../../../lib/moderation'
import { timeAgo } from '../../../lib/networkSocial'

// Chat comprador ↔ fornecedor — liberado só com assinatura ativa (modelo Airbnb).
// Moderação: bloqueia o envio de mensagens com termos ofensivos e avisa o usuário.
// A regra é reforçada no servidor (RLS exige assinatura ativa para inserir).

export function SupplierChat({ supplier, onClose, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [allowed, setAllowed] = useState(null)   // null=checando, true/false
  const [thread, setThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [banned, setBanned] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [warn, setWarn] = useState('')
  const bottomRef = useRef(null)

  // 1) checa assinatura ativa (gate)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase.rpc('has_active_subscription', { p_tenant: tenantId })
        if (alive) setAllowed(!!data)
      } catch { if (alive) setAllowed(false) }
    })()
    return () => { alive = false }
  }, [tenantId])

  // 2) carrega lista de moderação
  useEffect(() => {
    ;(async () => { try { const { data } = await supabase.from('moderation_words').select('word'); setBanned((data || []).map((w) => w.word)) } catch { /* noop */ } })()
  }, [])

  // 3) abre/cria a thread e carrega mensagens (só se liberado)
  const loadThread = useCallback(async () => {
    let { data: t } = await supabase.from('supplier_threads').select('*').eq('buyer_tenant', tenantId).eq('supplier_id', supplier.id).maybeSingle()
    if (!t) {
      const { data: created } = await supabase.from('supplier_threads').insert({ buyer_tenant: tenantId, supplier_id: supplier.id, supplier_tenant: supplier.tenant_id, subject: supplier.name }).select('*').maybeSingle()
      t = created
    }
    setThread(t)
    if (t) { const { data: msgs } = await supabase.from('supplier_messages').select('*').eq('thread_id', t.id).order('created_at'); setMessages(msgs || []) }
  }, [tenantId, supplier])
  useEffect(() => { if (allowed) loadThread() }, [allowed, loadThread])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const onType = (v) => {
    setText(v)
    const hits = findBannedWords(v, banned)
    setWarn(hits.length ? `Sua mensagem contém termo(s) que violam a política: “${hits.join(', ')}”.` : '')
  }

  const send = async () => {
    const body = text.trim()
    if (!body || !thread) return
    const hits = findBannedWords(body, banned)
    if (hits.length) { notify?.('Mensagem bloqueada: contém termos que violam a política da plataforma.', 'error'); setWarn(`Bloqueado: “${hits.join(', ')}”.`); return }
    setSending(true)
    const { data, error } = await supabase.from('supplier_messages').insert({ thread_id: thread.id, sender_tenant: tenantId, sender_name: profile?.tenant_name || 'Você', body }).select('*').single()
    setSending(false)
    if (error) { notify?.('Não foi possível enviar. ' + (error.message?.includes('policy') ? 'Verifique se sua assinatura está ativa.' : error.message), 'error'); return }
    setMessages((m) => [...m, data]); setText(''); setWarn('')
    supabase.from('supplier_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-t-2xl sm:rounded-2xl w-full max-w-lg h-[80vh] sm:h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] shrink-0">
          <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center">{supplier.logo_url ? <img src={supplier.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-4 h-4 text-admin-champ/60" />}</div>
          <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{supplier.name}</p><p className="text-admin-muted/40 text-[11px]">Conversa direta</p></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>

        {allowed === null ? (
          <div className="flex-1 flex items-center justify-center text-admin-muted/40 text-sm"><Icon name="refresh" className="w-4 h-4 animate-spin mr-2" />Verificando acesso…</div>
        ) : !allowed ? (
          // Gate: sem assinatura ativa
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-admin-champ/12 flex items-center justify-center mb-4"><Icon name="star" className="w-7 h-7 text-admin-champ" /></div>
            <h3 className="font-serif text-xl text-admin-text">Chat disponível para assinantes</h3>
            <p className="text-admin-muted/55 text-sm mt-2 leading-relaxed">Assim como nas melhores plataformas, a conversa direta entre quem compra e quem oferece a solução é liberada com uma assinatura ativa da Seravie. Assine para negociar diretamente com os fornecedores.</p>
            <button onClick={() => notify?.('Vá em Sistema → Minha Assinatura para ativar seu plano.', 'info')} className="mt-5 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors">Ver planos</button>
          </div>
        ) : (
          <>
            {/* mensagens */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? <p className="text-admin-muted/35 text-xs text-center py-8">Inicie a conversa com {supplier.name}.</p>
                : messages.map((m) => {
                    const mine = m.sender_tenant === tenantId
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-admin-champ/15 text-admin-text' : 'glass text-admin-text/90'}`}>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`text-[9px] mt-1 ${mine ? 'text-admin-champ/50 text-right' : 'text-admin-muted/30'}`}>{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
              <div ref={bottomRef} />
            </div>
            {/* aviso de moderação */}
            {warn && <div className="px-4 py-2 bg-admin-rose/[0.08] border-t border-admin-rose/15 text-admin-rose/90 text-[11px] flex items-center gap-2 shrink-0"><Icon name="warning" className="w-3.5 h-3.5 shrink-0" />{warn}</div>}
            {/* composer */}
            <div className="p-3 border-t border-white/[0.06] shrink-0 flex gap-2">
              <input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escreva uma mensagem…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              <button onClick={send} disabled={sending || !text.trim() || !!warn} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 rounded-xl text-sm transition-colors disabled:opacity-40">Enviar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
