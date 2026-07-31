import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'

export function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // login | reset
  const { login } = useAuth()
  const { settings } = useSettings()
  const brand = settings?.brand || {}

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setInfo('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.error) setError(result.error)
    else onLoginSuccess()
  }

  const sendReset = async (e) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email) { setError('Informe seu e-mail para recuperar a senha.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#recuperar` })
    setLoading(false)
    if (err) setError(err.message)
    else setInfo('Enviamos um link de recuperação para o seu e-mail. Verifique a caixa de entrada (e o spam).')
  }

  return (
    <div className="min-h-screen admin-bg flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-9 w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          {brand.logo_url
            ? <img src={brand.logo_url} alt="Seravie Experiences" className="max-h-12 w-auto object-contain" />
            : <div className="font-serif text-[32px] text-admin-text leading-none">Seravie Experiences</div>}
          <div className="text-[9px] tracking-widestx text-admin-champ/80 mt-2">CMS</div>
        </div>

        {error && (
          <div className="bg-admin-rose/10 border border-admin-rose/30 text-admin-rose text-sm p-3.5 rounded-xl mb-5">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-admin-sage/10 border border-admin-sage/30 text-admin-sage text-sm p-3.5 rounded-xl mb-5">
            {info}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none" />
            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none" />
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setError(''); setInfo('') }} className="w-full text-center text-admin-champ/70 hover:text-admin-champ text-xs mt-1">Esqueci minha senha</button>
          </form>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-admin-muted/60 text-sm">Digite seu e-mail e enviaremos um link para redefinir a senha.</p>
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none" />
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60">
              {loading ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }} className="w-full text-center text-admin-champ/70 hover:text-admin-champ text-xs mt-1">Voltar ao login</button>
          </form>
        )}

        <p className="text-center text-admin-muted/50 mt-6 text-xs tracking-widerx uppercase">
          Acesso restrito à administração
        </p>
      </div>
    </div>
  )
}
