import { useState } from 'react'
import { supabase } from '../lib/supabase'

const field = 'w-full bg-white/[0.04] border border-gold/20 focus:border-gold/60 rounded-xl px-4 py-3 text-ivory placeholder-ivory/35 outline-none transition-colors text-sm'

const PERKS = [
  'Sistema operacional completo: CRM, PDV, e-commerce, agenda, financeiro e mais',
  'Loja pública e canais de venda (marketplaces) integrados',
  'Acesso ao ecossistema Seravie: Suppliers e Network',
  'Multiusuário com permissões por setor',
]

// Frentes que o onboarding pode ativar (correspondem às verticais do painel)
const ONBOARD_SEGMENTS = [
  ['chocolate', 'Chocolateria'], ['coffee', 'Cafeteria'], ['wine', 'Vinhos'], ['brewery', 'Cervejaria'],
  ['bakery', 'Padaria'], ['gourmet', 'Empório Gourmet'], ['gift', 'Presentes'], ['floriculture', 'Floricultura'],
  ['artesanato', 'Artesanato'], ['beauty', 'Beauty'], ['spa', 'Spa'], ['architecture', 'Arquitetura'],
  ['events', 'Eventos'], ['tourism', 'Turismo'], ['franchise', 'Franquias / Rede'],
]

export function AuthPanel({ initialTab = 'login', onClose }) {
  const [tab, setTab] = useState(initialTab)
  const [phase, setPhase] = useState('form') // form | onboarding
  const [form, setForm] = useState({ full_name: '', company: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [tenantId, setTenantId] = useState(null)
  const [segs, setSegs] = useState([])
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))
  const go = () => { window.location.hash = '#admin'; window.location.reload() }

  const login = async (e) => {
    e?.preventDefault(); setError(''); setInfo(''); setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
    setBusy(false)
    if (err) return setError('E-mail ou senha incorretos.')
    go()
  }

  const signup = async (e) => {
    e?.preventDefault(); setError(''); setInfo('')
    if (!form.email.trim() || !form.password) return setError('Preencha e-mail e senha.')
    if (form.password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.')
    setBusy(true)
    const { data, error: err } = await supabase.functions.invoke('auth-signup', {
      body: { email: form.email.trim(), password: form.password, full_name: form.full_name, company: form.company },
    })
    if (err || data?.error) {
      setBusy(false)
      if (data?.error === 'email_taken') { setError('Este e-mail já tem conta. Faça login.'); setTab('login'); return }
      return setError(data?.detail || 'Não foi possível criar a conta. Tente novamente.')
    }
    const { error: sErr } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
    setBusy(false)
    if (sErr) { setTab('login'); setInfo('Conta criada! Faça login para entrar.'); return }
    setTenantId(data?.tenant_id || null); setPhase('onboarding') // onboarding guiado
  }

  const reset = async (e) => {
    e?.preventDefault(); setError(''); setInfo('')
    if (!form.email.trim()) return setError('Informe seu e-mail.')
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: `${window.location.origin}/#recuperar` })
    setBusy(false)
    if (err) return setError(err.message)
    setInfo('Se houver uma conta com este e-mail, enviaremos um link de redefinição.')
  }

  const toggleSeg = (k) => setSegs((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k])
  const finishOnboarding = async () => {
    setBusy(true)
    if (segs.length && tenantId) {
      await supabase.from('vertical_configs').insert(segs.map((v) => ({ tenant_id: tenantId, vertical: v, config: { enabled: true } })))
    }
    go()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/92 backdrop-blur-md" onClick={phase === 'onboarding' ? undefined : onClose}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden border border-gold/20 bg-[#12140e] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Lado marca */}
        <div className="hidden md:flex flex-col justify-between p-9 relative overflow-hidden"
          style={{ backgroundImage: 'radial-gradient(80% 70% at 70% 20%, rgba(214,196,154,0.22), transparent 60%), linear-gradient(160deg, #1a211b, #0b0a08)' }}>
          <div>
            <div className="font-serif text-3xl text-ivory leading-none">Seravie</div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-gold/80 mt-2">Experience Operating System</div>
          </div>
          <div>
            <p className="font-serif text-2xl text-ivory/90 leading-snug mb-6">O sistema que transforma negócios em experiências memoráveis.</p>
            <ul className="space-y-3">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-ivory/70 text-sm">
                  <span className="w-5 h-5 rounded-full border border-gold/40 text-gold flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-ivory/30 text-[11px]">Já são dezenas de frentes de negócio operando com a Seravie.</p>
        </div>

        {/* Lado direito */}
        <div className="p-8 sm:p-10 bg-[#0e100b]">
          {phase === 'onboarding' ? (
            <div>
              <div className="mb-6">
                <p className="text-[10px] tracking-[0.3em] uppercase text-gold/80 mb-2">Conta criada</p>
                <h2 className="font-serif text-3xl text-ivory leading-tight">Qual é a sua frente de negócio?</h2>
                <p className="text-ivory/45 text-sm mt-2">Escolha uma ou mais e já deixamos o painel pronto para o seu segmento. Você pode mudar depois em "Frentes / Núcleos".</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[46vh] overflow-y-auto pr-1 mb-6">
                {ONBOARD_SEGMENTS.map(([k, label]) => {
                  const on = segs.includes(k)
                  return (
                    <button key={k} onClick={() => toggleSeg(k)} className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${on ? 'border-gold/60 bg-gold/10 text-ivory' : 'border-gold/15 text-ivory/60 hover:border-gold/30'}`}>
                      <span className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'border-gold bg-gold/30' : 'border-ivory/25'}`}>{on && <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg>}</span>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button disabled={busy} onClick={finishOnboarding} className="w-full bg-gold text-ink py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium hover:bg-champagne transition-colors disabled:opacity-60">
                {busy ? 'Preparando…' : segs.length ? `Ativar ${segs.length} frente${segs.length > 1 ? 's' : ''} e entrar` : 'Entrar no painel'}
              </button>
              <button disabled={busy} onClick={go} className="w-full text-center text-gold/70 hover:text-gold text-xs pt-3">Pular por enquanto</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-7">
                <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl">
                  <button onClick={() => { setTab('login'); setError(''); setInfo('') }} className={`px-4 py-2 rounded-lg text-[11px] tracking-widerx uppercase transition-colors ${tab === 'login' ? 'bg-gold text-ink' : 'text-ivory/60 hover:text-ivory'}`}>Entrar</button>
                  <button onClick={() => { setTab('signup'); setError(''); setInfo('') }} className={`px-4 py-2 rounded-lg text-[11px] tracking-widerx uppercase transition-colors ${tab === 'signup' ? 'bg-gold text-ink' : 'text-ivory/60 hover:text-ivory'}`}>Criar conta</button>
                </div>
                <button onClick={onClose} className="text-ivory/40 hover:text-ivory"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              </div>

              {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-3 rounded-xl mb-4">{error}</div>}
              {info && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm p-3 rounded-xl mb-4">{info}</div>}

              {tab === 'login' && (
                <form onSubmit={login} className="space-y-3.5">
                  <h2 className="font-serif text-3xl text-ivory mb-1">Bem-vindo de volta</h2>
                  <p className="text-ivory/45 text-sm !mt-0 mb-5">Acesse o painel da sua operação.</p>
                  <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => set('email', e.target.value)} className={field} required />
                  <input type="password" placeholder="Senha" value={form.password} onChange={(e) => set('password', e.target.value)} className={field} required />
                  <button disabled={busy} className="w-full bg-gold text-ink py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium hover:bg-champagne transition-colors disabled:opacity-60">{busy ? 'Entrando…' : 'Entrar'}</button>
                  <button type="button" onClick={() => { setTab('reset'); setError(''); setInfo('') }} className="w-full text-center text-gold/70 hover:text-gold text-xs pt-1">Esqueci minha senha</button>
                </form>
              )}

              {tab === 'signup' && (
                <form onSubmit={signup} className="space-y-3.5">
                  <h2 className="font-serif text-3xl text-ivory mb-1">Crie sua conta</h2>
                  <p className="text-ivory/45 text-sm !mt-0 mb-5">Comece a operar sua experiência em minutos.</p>
                  <input placeholder="Seu nome" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={field} />
                  <input placeholder="Nome do negócio" value={form.company} onChange={(e) => set('company', e.target.value)} className={field} />
                  <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => set('email', e.target.value)} className={field} required />
                  <input type="password" placeholder="Senha (mín. 6 caracteres)" value={form.password} onChange={(e) => set('password', e.target.value)} className={field} required />
                  <button disabled={busy} className="w-full bg-gold text-ink py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium hover:bg-champagne transition-colors disabled:opacity-60">{busy ? 'Criando conta…' : 'Criar minha conta'}</button>
                  <p className="text-ivory/35 text-[11px] text-center pt-1">Ao criar a conta, você concorda com os Termos de Uso e a Política de Privacidade.</p>
                </form>
              )}

              {tab === 'reset' && (
                <form onSubmit={reset} className="space-y-3.5">
                  <h2 className="font-serif text-3xl text-ivory mb-1">Recuperar senha</h2>
                  <p className="text-ivory/45 text-sm !mt-0 mb-5">Enviaremos um link de redefinição para seu e-mail.</p>
                  <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => set('email', e.target.value)} className={field} required />
                  <button disabled={busy} className="w-full bg-gold text-ink py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium hover:bg-champagne transition-colors disabled:opacity-60">{busy ? 'Enviando…' : 'Enviar link'}</button>
                  <button type="button" onClick={() => { setTab('login'); setError(''); setInfo('') }} className="w-full text-center text-gold/70 hover:text-gold text-xs pt-1">Voltar ao login</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
