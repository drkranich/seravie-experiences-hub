import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { GlassDate } from '../components/admin/ui'

// Experiências públicas do CLIENTE final por vertical:
//   #agenda/<slug>   → agendamento (spa/beauty)
//   #reserva/<slug>  → reserva de passeio (turismo)
//   #clube/<slug>    → adesão a clube/assinatura (vinhos/café/floricultura)
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const bg = { backgroundImage: 'radial-gradient(70% 50% at 80% 0%, rgba(214,196,154,0.14), transparent 60%), linear-gradient(170deg, #14160f 0%, #0b0a08 100%)' }
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

export function ClientExperience() {
  const hash = window.location.hash
  const mode = hash.startsWith('#agenda') ? 'agenda' : hash.startsWith('#reserva') ? 'reserva' : 'clube'
  const slug = (hash.match(/#(?:agenda|reserva|clube)\/([^?]+)/) || [])[1] || ''

  const [tenant, setTenant] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [people, setPeople] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: t } = await supabase.from('tenants').select('id,name,slug,logo_url').eq('slug', slug).maybeSingle()
      setTenant(t || null)
      if (t) {
        if (mode === 'agenda') { const { data } = await supabase.from('spa_services').select('*').eq('tenant_id', t.id).eq('is_active', true).order('name'); setItems(data || []) }
        else if (mode === 'reserva') { const { data } = await supabase.from('tours').select('*').eq('tenant_id', t.id).eq('status', 'active').order('name'); setItems(data || []) }
        else { const { data } = await supabase.from('club_plans').select('*').eq('tenant_id', t.id).eq('active', true).order('price'); setItems(data || []) }
      }
      setLoading(false)
    })()
  }, [slug, mode])

  const submit = async () => {
    if (!sel || !name.trim()) return setErr('Preencha seu nome e escolha uma opção.')
    if (mode === 'agenda' && (!date || !time)) return setErr('Escolha data e horário.')
    if (mode === 'reserva' && !date) return setErr('Escolha a data.')
    setErr(''); setBusy(true)
    const body = { slug, kind: mode === 'agenda' ? 'appointment' : mode === 'reserva' ? 'tour' : 'club', customer_name: name, customer_email: email,
      service_id: mode === 'agenda' ? sel.id : undefined, tour_id: mode === 'reserva' ? sel.id : undefined, plan_id: mode === 'clube' ? sel.id : undefined,
      date, time, people: Number(people) || 1 }
    const { data, error } = await supabase.functions.invoke('client-booking', { body })
    setBusy(false)
    if (error || data?.error) return setErr(data?.error === 'slot_taken' ? 'Esse horário acabou de ser preenchido. Escolha outro.' : 'Não foi possível concluir. Tente novamente.')
    setDone({ mode, sel, date, time, people, total: data?.total })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-ivory/50 font-serif text-xl" style={bg}>Carregando…</div>
  if (!tenant) return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}><p className="font-serif text-2xl text-ivory">Página não encontrada</p><p className="text-ivory/50 text-sm mt-2">Verifique o link com o estabelecimento.</p></div>

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}>
      <div className="w-16 h-16 rounded-full border-2 border-gold/60 text-gold flex items-center justify-center mb-6"><svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg></div>
      <h1 className="font-serif text-3xl text-ivory">{mode === 'agenda' ? 'Agendamento confirmado!' : mode === 'reserva' ? 'Reserva confirmada!' : 'Assinatura confirmada!'}</h1>
      <p className="text-ivory/60 mt-3 max-w-sm">
        {mode === 'agenda' && `${done.sel.name} · ${done.date} às ${done.time}. Você receberá a confirmação em breve.`}
        {mode === 'reserva' && `${done.sel.name} · ${done.date} · ${done.people} pessoa(s). Total ${brl(done.total)} — o estabelecimento entrará em contato para o pagamento.`}
        {mode === 'clube' && `Bem-vindo ao ${done.sel.name}! O estabelecimento entrará em contato para ativar sua assinatura.`}
      </p>
      <button onClick={() => { setDone(null); setSel(null); setName(''); setDate(''); setTime('') }} className="mt-8 bg-gold text-ink px-7 py-3 text-[11px] tracking-widerx uppercase">Voltar</button>
    </div>
  )

  const title = mode === 'agenda' ? 'Agende seu horário' : mode === 'reserva' ? 'Reserve sua experiência' : 'Escolha seu plano'

  return (
    <div className="min-h-screen pb-16" style={bg}>
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="text-center mb-8">
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-12 mx-auto mb-3" />}
          <p className="text-[10px] tracking-widerx uppercase text-gold/80">{tenant.name}</p>
          <h1 className="font-serif text-3xl text-ivory mt-1">{title}</h1>
        </div>

        {err && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-3 rounded-xl mb-4">{err}</div>}

        {items.length === 0 ? (
          <p className="text-ivory/40 text-center text-sm py-16">Nenhuma opção disponível no momento.</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const on = sel?.id === it.id
              return (
                <button key={it.id} onClick={() => setSel(it)} className={`w-full glass rounded-2xl p-4 text-left border transition-colors ${on ? 'border-gold' : 'border-transparent'}`}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-serif text-lg text-ivory">{it.name}</p>
                      {it.description && <p className="text-ivory/45 text-xs mt-0.5 line-clamp-2">{it.description}</p>}
                      <p className="text-ivory/40 text-[11px] mt-1">
                        {mode === 'agenda' && it.duration_min ? `${it.duration_min} min` : ''}
                        {mode === 'reserva' && it.duration ? `${it.duration}` : ''}
                        {mode === 'clube' && it.cadence ? `${it.cadence} · ${it.items_per_cycle || 1} item(ns)/ciclo` : ''}
                      </p>
                    </div>
                    <span className="text-gold whitespace-nowrap">{brl(mode === 'clube' ? it.price : it.price)}{mode === 'clube' ? '/mês' : ''}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {sel && (
          <div className="glass rounded-2xl p-5 mt-5 space-y-3">
            {(mode === 'agenda' || mode === 'reserva') && (
              <div>
                <label className="text-[10px] uppercase tracking-widerx text-gold/70 block mb-1.5">Data</label>
                <GlassDate value={date} onChange={setDate} />
              </div>
            )}
            {mode === 'agenda' && (
              <div>
                <label className="text-[10px] uppercase tracking-widerx text-gold/70 block mb-1.5">Horário</label>
                <div className="grid grid-cols-4 gap-2">
                  {SLOTS.map((s) => <button key={s} onClick={() => setTime(s)} className={`text-xs py-2 rounded-lg border ${time === s ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 text-ivory/60'}`}>{s}</button>)}
                </div>
              </div>
            )}
            {mode === 'reserva' && (
              <div>
                <label className="text-[10px] uppercase tracking-widerx text-gold/70 block mb-1.5">Pessoas</label>
                <input type="number" min="1" max={sel.capacity || 99} value={people} onChange={(e) => setPeople(e.target.value)} className="w-full bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory text-sm outline-none" />
                {sel.capacity && <p className="text-ivory/30 text-[10px] mt-1">Capacidade: {sel.capacity}</p>}
              </div>
            )}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory placeholder-ivory/35 text-sm outline-none" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail (opcional)" className="w-full bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory placeholder-ivory/35 text-sm outline-none" />
            {mode === 'reserva' && <div className="flex justify-between text-ivory pt-1"><span className="text-ivory/60">Total</span><span className="font-serif text-xl text-gold">{brl((Number(sel.price) || 0) * (Number(people) || 1))}</span></div>}
            <button onClick={submit} disabled={busy} className="w-full bg-gold text-ink py-3.5 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60">
              {busy ? 'Enviando…' : mode === 'agenda' ? 'Confirmar agendamento' : mode === 'reserva' ? 'Confirmar reserva' : 'Assinar'}
            </button>
          </div>
        )}
        <p className="text-ivory/25 text-[10px] text-center mt-8">Seravie Experiences</p>
      </div>
    </div>
  )
}
