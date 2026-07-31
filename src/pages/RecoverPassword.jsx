import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAuthEvent } from '../lib/audit'

export function RecoverPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha deve ter ao menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message || 'Não foi possível redefinir. Abra o link do e-mail novamente.'); return }
    logAuthEvent('password_change')
    setDone(true)
  }

  return (
    <div className="min-h-screen admin-bg flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-9 w-full max-w-md">
        <h1 className="font-serif text-3xl text-admin-text text-center mb-2">Redefinir senha</h1>
        {done ? (
          <>
            <p className="text-admin-muted/60 text-sm text-center mb-6">Senha atualizada com sucesso.</p>
            <button onClick={() => { window.location.hash = '#admin'; window.location.reload() }} className="btn-gradient w-full py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium">Entrar na plataforma</button>
          </>
        ) : (
          <>
            <p className="text-admin-muted/60 text-sm text-center mb-6">Defina sua nova senha de acesso.</p>
            {error && <div className="bg-admin-rose/10 border border-admin-rose/30 text-admin-rose text-sm p-3.5 rounded-xl mb-5">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <input type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none" />
              <input type="password" placeholder="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none" />
              <button type="submit" disabled={loading} className="btn-gradient w-full py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60">{loading ? 'Salvando…' : 'Redefinir senha'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
