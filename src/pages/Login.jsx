import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.error) setError(result.error)
    else onLoginSuccess()
  }

  return (
    <div className="min-h-screen admin-bg flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-9 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl text-admin-text leading-none">Seravie</div>
          <div className="text-[9px] tracking-widestx text-admin-champ/80 mt-2">EXPERIENCES · CMS</div>
        </div>

        {error && (
          <div className="bg-admin-rose/10 border border-admin-rose/30 text-admin-rose text-sm p-3.5 rounded-xl mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full glass-input rounded-xl px-4 py-3 text-admin-text placeholder-admin-muted/40 outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient w-full py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-admin-muted/50 mt-6 text-xs tracking-widerx uppercase">
          Acesso restrito à administração
        </p>
      </div>
    </div>
  )
}
