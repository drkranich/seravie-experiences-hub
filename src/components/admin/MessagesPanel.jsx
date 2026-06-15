import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, TextInput, Icon, Spinner } from './ui'

export function MessagesPanel({ notify }) {
  const [msgs, setMsgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    setMsgs(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const markRead = async (id, read) => {
    const { error } = await supabase.from('contact_submissions').update({ read }).eq('id', id)
    if (error) notify('Erro: ' + error.message, 'error')
    else load()
  }

  const del = async (id) => {
    if (!window.confirm('Excluir esta mensagem?')) return
    const { error } = await supabase.from('contact_submissions').delete().eq('id', id)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Mensagem excluída.', 'success')
      load()
    }
  }

  const filtered = msgs.filter((m) => {
    const t = (m.name + ' ' + m.email + ' ' + m.message).toLowerCase()
    return t.includes(q.toLowerCase())
  })
  const unread = msgs.filter((m) => !m.read).length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl text-ivory">Mensagens</h1>
          <p className="text-ivory/45 mt-2">
            {msgs.length} no total · {unread} não lidas
          </p>
        </div>
        <div className="relative">
          <Icon name="search" className="w-4 h-4 text-ivory/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-9 w-64" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ivory/40">
          <Spinner /> Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-ivory/40">Nenhuma mensagem encontrada.</Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <Card key={m.id} className={`p-5 ${!m.read ? 'border-gold/40' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-xl text-ivory">{m.name}</h3>
                    {!m.read && <span className="text-[9px] tracking-widerx uppercase bg-gold/20 text-gold px-2 py-0.5 rounded-full">Nova</span>}
                  </div>
                  <p className="text-ivory/55 text-sm">
                    {m.email}
                    {m.phone ? ' · ' + m.phone : ''}
                  </p>
                </div>
                <span className="text-ivory/35 text-xs whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="text-ivory/75 text-sm mt-4 whitespace-pre-wrap leading-relaxed">{m.message}</p>
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={() => markRead(m.id, !m.read)}
                  className="flex items-center gap-1.5 text-[10px] tracking-widerx uppercase text-champagne hover:text-gold transition-colors"
                >
                  <Icon name="check" className="w-3.5 h-3.5" />
                  {m.read ? 'Marcar não lida' : 'Marcar lida'}
                </button>
                <a
                  href={`mailto:${m.email}`}
                  className="flex items-center gap-1.5 text-[10px] tracking-widerx uppercase text-champagne hover:text-gold transition-colors"
                >
                  <Icon name="mail" className="w-3.5 h-3.5" />
                  Responder
                </a>
                <button
                  onClick={() => del(m.id)}
                  className="flex items-center gap-1.5 text-[10px] tracking-widerx uppercase text-ivory/40 hover:text-red-300 transition-colors ml-auto"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
