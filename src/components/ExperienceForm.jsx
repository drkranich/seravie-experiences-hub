import { useState } from 'react'
import { useContacts } from '../hooks/useContacts'

const STEPS = [
  { key: 'name', q: 'Qual o seu nome completo?', type: 'text', ph: 'Digite seu nome completo', required: true },
  { key: 'email', q: 'Qual o seu melhor e-mail?', type: 'email', ph: 'voce@email.com', required: true },
  { key: 'phone', q: 'E o seu telefone / WhatsApp?', type: 'tel', ph: '(00) 00000-0000', required: false },
  {
    key: 'projectType',
    q: 'Que tipo de espaço você quer transformar?',
    type: 'choice',
    options: ['Empório / Loja', 'Cafeteria / Restaurante', 'Pousada / Hotel', 'Vinícola / Fazenda', 'Outro'],
    required: false,
  },
  { key: 'details', q: 'Conte um pouco sobre o seu destino.', type: 'textarea', ph: 'Sua visão, prazos, localização...', required: true },
]

const ArrowR = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export function ExperienceForm() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({ name: '', email: '', phone: '', projectType: '', details: '' })
  const [localError, setLocalError] = useState('')
  const [done, setDone] = useState(false)
  const { submitContact, loading } = useContacts()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const update = (val) => {
    setData((d) => ({ ...d, [current.key]: val }))
    setLocalError('')
  }

  const validEmail = (e) => /\S+@\S+\.\S+/.test(e)

  const handleNext = async () => {
    const value = (data[current.key] || '').trim()
    if (current.required && !value) {
      setLocalError('Por favor, preencha este campo para continuar.')
      return
    }
    if (current.key === 'email' && value && !validEmail(value)) {
      setLocalError('Digite um e-mail válido.')
      return
    }
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    const message = `Tipo de projeto: ${data.projectType || '—'}\n\n${data.details}`
    const result = await submitContact({
      name: data.name,
      email: data.email,
      phone: data.phone,
      message,
    })
    if (result.success) setDone(true)
    else setLocalError(result.error || 'Não foi possível enviar. Tente novamente.')
  }

  const handleBack = () => {
    setLocalError('')
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="relative bg-ink/40 backdrop-blur-md border border-gold/25 rounded-2xl p-8 lg:p-10 overflow-hidden">
      <svg
        viewBox="0 0 24 24"
        className="w-28 h-28 text-gold/10 absolute -right-4 -top-4 rotate-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19c4-4 7-6 10-7" />
      </svg>

      {done ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-full border border-gold/40 flex items-center justify-center text-gold mx-auto mb-6">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l4 4 10-11" />
            </svg>
          </div>
          <h3 className="font-serif text-3xl text-ivory mb-3">Recebemos a sua história.</h3>
          <p className="text-ivory/60 text-sm leading-relaxed max-w-sm mx-auto">
            Obrigado, {data.name.split(' ')[0] || 'visitante'}. Nossa equipe entrará em contato em breve
            para começarmos a projetar o seu destino.
          </p>
        </div>
      ) : (
        <>
          {/* progress */}
          <div className="flex items-center justify-between mb-8">
            <span className="font-serif text-2xl text-gold">
              {String(step + 1).padStart(2, '0')}
              <span className="text-ivory/30 text-lg"> / {String(STEPS.length).padStart(2, '0')}</span>
            </span>
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-0.5 rounded-full transition-all duration-500 ${
                    i <= step ? 'w-7 bg-gold' : 'w-3 bg-ivory/20'
                  }`}
                />
              ))}
            </div>
          </div>

          <label className="block font-serif text-2xl lg:text-3xl text-ivory mb-6 leading-snug">
            {current.q}
          </label>

          {current.type === 'choice' ? (
            <div className="flex flex-wrap gap-3">
              {current.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => update(opt)}
                  className={`px-4 py-2.5 text-sm rounded-full border transition-all duration-300 ${
                    data.projectType === opt
                      ? 'border-gold bg-gold/15 text-champagne'
                      : 'border-ivory/20 text-ivory/65 hover:border-gold/50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : current.type === 'textarea' ? (
            <textarea
              rows="3"
              value={data[current.key]}
              onChange={(e) => update(e.target.value)}
              placeholder={current.ph}
              className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-3 text-ivory placeholder-ivory/25 text-lg outline-none resize-none transition-colors"
            />
          ) : (
            <input
              type={current.type}
              value={data[current.key]}
              onChange={(e) => update(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              placeholder={current.ph}
              className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-3 text-ivory placeholder-ivory/25 text-lg outline-none transition-colors"
            />
          )}

          {localError && <p className="mt-4 text-sm text-[#c98b6b]">{localError}</p>}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className={`text-[11px] tracking-widerx uppercase text-ivory/50 hover:text-gold transition-colors ${
                step === 0 ? 'invisible' : ''
              }`}
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="inline-flex items-center gap-3 px-8 py-3.5 bg-gold text-ink text-[11px] tracking-widerx uppercase hover:bg-champagne transition-colors disabled:opacity-60"
            >
              {loading ? 'Enviando...' : isLast ? 'Enviar' : 'Próximo'}
              <ArrowR />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
