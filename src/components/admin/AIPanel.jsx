import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

export function AIPanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [automations, setAutomations] = useState([])
  const [showAutoForm, setShowAutoForm] = useState(false)
  const [autoForm, setAutoForm] = useState({ name: '', trigger_type: 'ticket_created', description: '' })
  const bottomRef = useRef(null)

  const loadAutomations = async () => {
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
    setAutomations(data || [])
  }

  useEffect(() => { if (tab === 'automations') loadAutomations() }, [tab])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim(), ts: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)

    // Respostas contextuais simuladas para demonstração
    const q = userMsg.content.toLowerCase()
    let reply = 'Estou processando sua solicitação. Para respostas completas baseadas em seus dados, conecte a chave da API de IA nas configurações.'
    if (q.includes('ticket') || q.includes('chamado')) reply = 'Você pode acessar o Help Desk na sidebar para gerenciar tickets. Lá você encontra SLA, prioridades e histórico de atendimentos.'
    else if (q.includes('cliente') || q.includes('crm')) reply = 'O CRM da Seravie permite cadastrar clientes com histórico completo, preferências, LTV e datas especiais. Acesse via "CRM" na sidebar.'
    else if (q.includes('franquia') || q.includes('unidade')) reply = 'O módulo Franquias permite gerenciar a rede completa: unidades, comunicados, auditorias e visual merchandising.'
    else if (q.includes('relatório') || q.includes('analytics')) reply = 'Em breve o módulo Analytics estará disponível com dashboards por papel, metas e insights de IA.'
    else if (q.includes('produto') || q.includes('catálogo')) reply = 'O Catálogo permite gerenciar produtos com SKU, preço, estoque e variantes. Acesse via "Catálogo" na sidebar.'

    setTimeout(() => {
      setMessages(m => [...m, { role: 'assistant', content: reply, ts: new Date().toISOString() }])
      setLoading(false)
    }, 800)
  }

  const saveAutomation = async () => {
    if (!autoForm.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const { error } = await supabase.from('automations').insert({ ...autoForm, tenant_id: profile?.tenant_id, created_by: profile?.user_id, actions: [], conditions: [] })
    if (error) { notify('Erro', 'error'); return }
    notify('Automação criada', 'success'); setShowAutoForm(false); setAutoForm({ name: '', trigger_type: 'ticket_created', description: '' }); loadAutomations()
  }

  const toggleAuto = async (auto) => {
    await supabase.from('automations').update({ is_active: !auto.is_active }).eq('id', auto.id)
    loadAutomations(); notify(auto.is_active ? 'Desativada' : 'Ativada', 'success')
  }

  const TRIGGERS = { ticket_created:'Ticket criado', ticket_resolved:'Ticket resolvido', contact_created:'Contato criado', order_created:'Pedido criado', campaign_sent:'Campanha enviada', checklist_completed:'Checklist concluído' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Seravie AI</h1><p className="text-admin-muted/60 text-sm mt-1">Copiloto, automações e insights</p></div>
        {tab === 'automations' && <button onClick={() => setShowAutoForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Nova automação</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['chat','Copiloto IA'],['automations','Automações']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab===k?'bg-admin-champ/15 text-admin-champ':'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="glass rounded-2xl flex flex-col" style={{ height: '60vh' }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Icon name="spark" className="w-10 h-10 text-admin-champ/20 mb-4" />
                <p className="text-admin-text text-sm font-medium mb-2">Seravie AI Copiloto</p>
                <p className="text-admin-muted/40 text-xs max-w-xs">Pergunte sobre seus dados, peça resumos, obtenha sugestões de ações ou explore módulos da plataforma.</p>
                <div className="grid grid-cols-2 gap-2 mt-5 w-full max-w-sm">
                  {['Resumo do atendimento hoje','Como gerenciar tickets?','O que são as Franquias?','Como criar um cupom?'].map(s => (
                    <button key={s} onClick={() => { setInput(s); }} className="glass-soft rounded-lg px-3 py-2 text-xs text-admin-muted/60 hover:text-admin-champ text-left transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-admin-champ/15 text-admin-text rounded-br-sm' : 'bg-white/[0.05] text-admin-text rounded-bl-sm'}`}>
                  {m.role === 'assistant' && <p className="text-[9px] text-admin-champ/60 mb-1 tracking-wider uppercase">Seravie AI</p>}
                  <p className="leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-white/[0.05] px-4 py-3 rounded-2xl rounded-bl-sm"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-admin-champ/40 animate-pulse" style={{ animationDelay: `${i*150}ms` }} />)}</div></div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-3">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Pergunte algo sobre sua operação…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
              <button onClick={send} disabled={loading || !input.trim()} className="px-4 py-2.5 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ rounded-xl transition-colors disabled:opacity-40"><Icon name="spark" className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-2">
          {automations.length === 0
            ? <div className="glass rounded-2xl p-10 text-center"><Icon name="spark" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma automação criada</p></div>
            : automations.map(a => (
              <div key={a.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-admin-text text-sm font-medium">{a.name}</p>
                  <p className="text-admin-muted/40 text-xs mt-0.5">{TRIGGERS[a.trigger_type] || a.trigger_type} · Executada {a.run_count} vezes</p>
                </div>
                <button onClick={() => toggleAuto(a)} className={`text-[10px] px-3 py-1.5 rounded-lg transition-colors ${a.is_active ? 'bg-admin-sage/10 text-admin-sage hover:bg-admin-rose/10 hover:text-admin-rose' : 'bg-white/[0.04] text-admin-muted/40 hover:bg-admin-champ/10 hover:text-admin-champ'}`}>
                  {a.is_active ? 'ativa' : 'inativa'}
                </button>
              </div>
            ))
          }
        </div>
      )}

      {showAutoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Nova automação</h2><button onClick={() => setShowAutoForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={autoForm.name} onChange={e => setAutoForm(f => ({...f, name: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Gatilho</label><select value={autoForm.trigger_type} onChange={e => setAutoForm(f => ({...f, trigger_type: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">{Object.entries(TRIGGERS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={autoForm.description} onChange={e => setAutoForm(f => ({...f, description: e.target.value}))} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveAutomation} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={() => setShowAutoForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
