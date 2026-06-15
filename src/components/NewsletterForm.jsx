import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  const submit = async (e) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    const { error } = await supabase.from('newsletter_subscribers').insert([{ email }])
    if (error) {
      // 23505 = e-mail já inscrito → tratamos como sucesso
      setStatus(error.code === '23505' ? 'done' : 'error')
    } else {
      setStatus('done')
    }
  }

  if (status === 'done') {
    return <p className="text-gold/80 text-sm">Obrigado! Você está na nossa lista.</p>
  }

  return (
    <form onSubmit={submit} className="flex gap-3 max-w-sm">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail"
        className="flex-1 bg-transparent border-b border-gold/30 focus:border-gold py-2 text-ivory placeholder-ivory/30 text-sm outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="text-[10px] tracking-widerx uppercase text-gold hover:text-champagne transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {status === 'loading' ? '...' : 'Inscrever'}
      </button>
      {status === 'error' && <span className="text-red-300 text-xs">erro</span>}
    </form>
  )
}
