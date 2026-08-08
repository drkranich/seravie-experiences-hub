import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

// IA Consultora do Network — chat que aconselha sobre o ecossistema profissional
// (equipe para projeto, conexões, comunidades, briefings, talentos). Usa a Edge
// Function network-ai (BYO chave; fallback heurístico se não configurada).

const SUGGESTIONS = [
  'Quem eu deveria conectar para montar uma equipe de cafeteria?',
  'Quais comunidades combinam com o meu perfil?',
  'Como escrever um briefing forte para contratar um fotógrafo?',
  'Que talentos estão disponíveis em arquitetura?',
]

export function NetworkAI({ me, notify }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Olá! Sou a IA Consultora do Seravie Network. Posso ajudar a montar equipes, encontrar conexões, escolher comunidades e estruturar briefings. O que você precisa?' }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const ask = async (q) => {
    const question = (q ?? input).trim()
    if (!question || busy) return
    setMessages((m) => [...m, { role: 'user', text: question }]); setInput(''); setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('network-ai', { body: { question } })
      if (error) { setMessages((m) => [...m, { role: 'assistant', text: 'Não consegui responder agora: ' + error.message }]); return }
      setMessages((m) => [...m, { role: 'assistant', text: data?.reply || 'Sem resposta.', unconfigured: data?.configured === false }])
    } catch (e) { setMessages((m) => [...m, { role: 'assistant', text: 'Falha: ' + (e?.message || e) }]) }
    finally { setBusy(false) }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-admin-text flex items-center gap-2"><Icon name="sparkles" className="w-6 h-6 text-admin-champ" />IA Consultora</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Sua consultora do ecossistema: equipes, conexões, comunidades e briefings.</p>
      </div>

      <div className="flex-1 overflow-y-auto glass rounded-2xl p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === 'user' ? 'bg-admin-champ/15 text-admin-text rounded-br-sm' : 'bg-white/[0.05] text-admin-text rounded-bl-sm'}`}>
              {m.role === 'assistant' && <p className="text-[9px] uppercase tracking-wider text-admin-champ/60 mb-1 flex items-center gap-1"><Icon name="sparkles" className="w-2.5 h-2.5" />Consultora</p>}
              {m.text}
              {m.unconfigured && <p className="text-[10px] text-admin-gold/70 mt-2 pt-2 border-t border-white/[0.06]">IA generativa não conectada — resposta baseada em heurística. Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY nos Secrets do Supabase para respostas completas.</p>}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="px-4 py-3 rounded-2xl bg-white/[0.05] text-admin-muted/50 text-sm flex items-center gap-2"><Icon name="clock" className="w-4 h-4" />Pensando…</div></div>}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="text-xs px-3 py-2 rounded-xl bg-white/[0.04] text-admin-muted/70 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors text-left">{s}</button>)}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Pergunte à consultora…" className="flex-1 glass-input rounded-xl px-4 py-3 text-sm text-admin-text outline-none" />
        <button onClick={() => ask()} disabled={busy || !input.trim()} className="w-11 h-11 rounded-xl bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"><Icon name="up" className="w-5 h-5" /></button>
      </div>
    </div>
  )
}
