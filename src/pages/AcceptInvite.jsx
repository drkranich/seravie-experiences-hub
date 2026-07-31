import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Login } from './Login'

function getToken() {
  const m = (window.location.hash || '').match(/#convite\/?([^/?&]*)/)
  return m && m[1] ? decodeURIComponent(m[1]) : ''
}

export function AcceptInvite() {
  const token = getToken()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState('idle') // idle | working | ok | error
  const [message, setMessage] = useState('')
  const [tenant, setTenant] = useState(null)

  const accept = async () => {
    setState('working'); setMessage('')
    const { data, error } = await supabase.functions.invoke('accept-invite', { body: { token } })
    if (error) { setState('error'); setMessage('Falha ao processar o convite.'); return }
    if (!data?.ok) { setState('error'); setMessage(data?.error || 'Não foi possível aceitar o convite.'); return }
    setTenant(data.tenant || null); setState('ok')
  }

  useEffect(() => {
    if (!authLoading && user && token && state === 'idle') accept()
  }, [authLoading, user, token])

  if (!token) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-ivory p-6 text-center">
      <h1 className="font-serif text-3xl mb-2">Convite inválido</h1>
      <p className="text-ivory/50">O link do convite está incompleto.</p>
    </div>
  )

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/50 font-serif text-xl tracking-widest">Carregando…</div>

  if (!user) return (
    <div className="min-h-screen bg-ink">
      <div className="max-w-md mx-auto pt-16 px-6 text-center">
        <h1 className="font-serif text-3xl text-ivory mb-2">Você foi convidado</h1>
        <p className="text-ivory/50 mb-6">Entre ou cadastre-se com o e-mail do convite para acessar a plataforma.</p>
      </div>
      <Login onLoginSuccess={() => { /* o efeito acima dispara o accept */ }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-ivory p-6 text-center">
      {state === 'working' && <p className="text-ivory/60 font-serif text-xl tracking-widest">Ativando seu acesso…</p>}
      {state === 'ok' && (
        <>
          <div className="w-16 h-16 rounded-full bg-gold/15 text-gold flex items-center justify-center mb-5"><svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12l4 4 10-11" /></svg></div>
          <h1 className="font-serif text-3xl mb-2">Acesso liberado!</h1>
          <p className="text-ivory/50 mb-8">{tenant ? `Você agora faz parte de ${tenant}.` : 'Convite aceito com sucesso.'}</p>
          <button onClick={() => { window.location.hash = '#admin'; window.location.reload() }} className="bg-gold text-ink px-6 py-3 rounded-full text-sm font-medium">Entrar na plataforma</button>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="font-serif text-3xl mb-2">Não foi possível aceitar</h1>
          <p className="text-ivory/50 mb-6 max-w-md">{message}</p>
          <button onClick={accept} className="border border-gold/40 text-champagne px-5 py-2.5 rounded-full text-sm">Tentar novamente</button>
        </>
      )}
    </div>
  )
}
