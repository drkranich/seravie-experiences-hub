import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadTo } from '../lib/storage'
import { routeParam } from '../lib/publicRoute'

// Seravie Flow Studio — experiência pública cinematográfica (#form/<slug>).
// Um bloco por vez, tela cheia, transições suaves, glassmorphism premium.
const DEFAULT_THEME = {
  bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6',
  glow: 'rgba(214,196,154,0.16)', radius: 20,
}

export function FlowExperience() {
  const slug = routeParam('form')
  const [form, setForm] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [dir, setDir] = useState(1)       // 1 = avança, -1 = volta (para animação)
  const [anim, setAnim] = useState('in')  // in | out
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const startRef = useRef(Date.now())

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: f } = await supabase.from('flow_forms').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
      setForm(f || null)
      if (f) {
        const { data: b } = await supabase.from('flow_form_blocks').select('*').eq('form_id', f.id).order('sort_order')
        setBlocks(b || [])
      }
      setLoading(false)
    })()
  }, [slug])

  const theme = useMemo(() => ({ ...DEFAULT_THEME, ...(form?.theme || {}) }), [form])
  const total = blocks.length
  const current = blocks[idx]
  const isStatic = (t) => ['title', 'text', 'image', 'button'].includes(t)
  const progress = total ? Math.round(((idx + (done ? 1 : 0)) / total) * 100) : 0

  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }))
  const canAdvance = () => {
    if (!current) return false
    if (isStatic(current.type)) return true
    if (!current.required) return true
    const v = answers[current.id]
    return v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)
  }

  const go = (delta) => {
    const next = idx + delta
    if (next < 0) return
    if (next >= total) { submit(); return }
    setDir(delta); setAnim('out')
    setTimeout(() => { setIdx(next); setAnim('in') }, 260)
  }

  const submit = async () => {
    setSending(true); setErr('')
    const meta = { seconds: Math.round((Date.now() - startRef.current) / 1000) }
    const { data, error } = await supabase.functions.invoke('flow-submit', { body: { slug, answers, meta } })
    setSending(false)
    if (error || data?.error) return setErr('Não foi possível enviar. Verifique os campos e tente novamente.')
    setDone(true)
  }

  const bg = {
    backgroundImage: `radial-gradient(80% 55% at 75% -5%, ${theme.glow}, transparent 60%), linear-gradient(165deg, ${theme.bg1} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
  }
  const glass = { background: 'rgba(255,255,255,0.055)', backdropFilter: 'blur(26px) saturate(1.15)', WebkitBackdropFilter: 'blur(26px) saturate(1.15)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', borderRadius: theme.radius }
  const animCls = anim === 'out'
    ? (dir > 0 ? 'opacity-0 -translate-y-6 blur-sm' : 'opacity-0 translate-y-6 blur-sm')
    : 'opacity-100 translate-y-0 blur-0'

  if (loading) return <div className="min-h-screen flex items-center justify-center font-serif text-xl" style={{ ...bg }}>Carregando…</div>
  if (!form) return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}><p className="font-serif text-2xl">Experiência não encontrada</p><p className="opacity-50 text-sm mt-2">Este link pode ter sido despublicado.</p></div>

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ border: `2px solid ${theme.accent}`, color: theme.accent }}>
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg>
      </div>
      <h1 className="font-serif text-3xl">{form.submit_message || 'Obrigado!'}</h1>
      <p className="opacity-25 text-[10px] mt-8 tracking-widerx uppercase">Seravie Flow Studio</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={bg}>
      {/* barra de progresso */}
      <div className="h-1 w-full bg-white/[0.06]">
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: theme.accent }} />
      </div>

      {/* cena atual */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className={`w-full max-w-xl transition-all duration-300 ease-out ${animCls}`}>
          {form.cover_url && idx === 0 && <img src={form.cover_url} alt="" className="w-full h-40 object-cover mb-6" style={{ borderRadius: theme.radius }} />}
          {current && <BlockView block={current} theme={theme} glass={glass} value={answers[current.id]} onChange={(v) => setAnswer(current.id, v)} onEnter={() => canAdvance() && go(1)} />}
          {err && <p className="text-rose-300 text-sm mt-4 text-center">{err}</p>}
        </div>
      </div>

      {/* navegação */}
      <div className="px-5 pb-8">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <button onClick={() => go(-1)} disabled={idx === 0} className="text-[11px] tracking-widerx uppercase opacity-50 disabled:opacity-0 transition-opacity">← Voltar</button>
          <span className="text-[11px] opacity-30">{Math.min(idx + 1, total)} / {total}</span>
          <button
            onClick={() => go(1)} disabled={!canAdvance() || sending}
            className="px-7 py-3 text-[12px] tracking-widerx uppercase font-medium transition-all disabled:opacity-30"
            style={{ background: theme.accent, color: theme.bg1, borderRadius: theme.radius }}>
            {sending ? 'Enviando…' : idx === total - 1 ? 'Concluir' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Render de cada bloco (uma cena) ----------
function BlockView({ block, theme, glass, value, onChange, onEnter }) {
  const t = block.type
  const label = block.label || ''
  const opts = Array.isArray(block.options) ? block.options : []
  const inputBase = 'w-full bg-white/[0.05] border rounded-2xl px-5 py-4 text-lg outline-none transition-colors placeholder-white/25'
  const inputStyle = { borderColor: 'rgba(255,255,255,0.12)', color: theme.text }
  const onKey = (e) => { if (e.key === 'Enter' && t !== 'long_text') onEnter?.() }

  const Header = () => (
    <div className="mb-6">
      {block.help && <p className="text-[11px] tracking-widerx uppercase mb-2" style={{ color: theme.accent, opacity: 0.85 }}>{block.help}</p>}
      <h2 className="font-serif leading-tight" style={{ fontSize: t === 'title' ? '2.6rem' : '2rem' }}>{label}{block.required && !['title','text','image','button'].includes(t) ? <span style={{ color: theme.accent }}> *</span> : null}</h2>
    </div>
  )

  if (t === 'title') return <div className="text-center"><Header /></div>
  if (t === 'text') return <div><Header />{block.config?.body && <p className="opacity-70 text-lg leading-relaxed whitespace-pre-wrap">{block.config.body}</p>}</div>
  if (t === 'image') return <div className="text-center"><Header />{block.config?.media_url && <img src={block.config.media_url} alt="" className="w-full object-cover mt-2" style={{ borderRadius: theme.radius }} />}</div>
  if (t === 'button') return <div className="text-center"><Header />{block.config?.url && <a href={block.config.url} target="_blank" rel="noreferrer" className="inline-block mt-4 px-8 py-3 text-[12px] tracking-widerx uppercase" style={{ background: theme.accent, color: theme.bg1, borderRadius: theme.radius }}>{block.config?.button_label || 'Abrir'}</a>}</div>

  if (t === 'long_text') return <div><Header /><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={block.placeholder || 'Escreva aqui…'} className={`${inputBase} resize-none`} style={inputStyle} /></div>

  if (['short_text', 'email', 'phone', 'number', 'url'].includes(t)) {
    const inputType = t === 'email' ? 'email' : t === 'number' ? 'number' : t === 'phone' ? 'tel' : t === 'url' ? 'url' : 'text'
    return <div><Header /><input type={inputType} value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} placeholder={block.placeholder || 'Sua resposta…'} className={inputBase} style={inputStyle} autoFocus /></div>
  }

  if (t === 'choice') return (
    <div><Header />
      <div className="space-y-3">
        {opts.map((o, i) => {
          const val = o.value ?? o.label ?? o
          const lbl = o.label ?? o
          const on = value === val
          return (
            <button key={i} onClick={() => { onChange(val); setTimeout(() => onEnter?.(), 200) }}
              className="w-full text-left px-5 py-4 text-lg transition-all" style={{ ...glass, ...(on ? { borderColor: theme.accent, background: 'rgba(214,196,154,0.12)' } : {}) }}>
              <span style={{ color: on ? theme.accent : theme.text }}>{lbl}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (t === 'nps') return (
    <div><Header />
      <div className="grid grid-cols-11 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} onClick={() => { onChange(n); setTimeout(() => onEnter?.(), 200) }}
            className="aspect-square rounded-xl text-sm transition-all" style={{ ...glass, borderRadius: 12, ...(value === n ? { borderColor: theme.accent, background: 'rgba(214,196,154,0.15)', color: theme.accent } : {}) }}>{n}</button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] opacity-40 mt-2"><span>Nada provável</span><span>Muito provável</span></div>
    </div>
  )

  if (t === 'rating') {
    const max = Number(block.config?.max) || 5
    return (
      <div><Header />
        <div className="flex gap-2 justify-center">
          {Array.from({ length: max }, (_, n) => n + 1).map((n) => (
            <button key={n} onClick={() => { onChange(n); setTimeout(() => onEnter?.(), 200) }} className="text-4xl transition-transform hover:scale-110" style={{ color: (value || 0) >= n ? theme.accent : 'rgba(255,255,255,0.2)' }}>★</button>
          ))}
        </div>
      </div>
    )
  }

  if (t === 'upload') return <UploadField block={block} theme={theme} glass={glass} value={value} onChange={onChange} />

  // fallback
  return <div><Header /><input value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputBase} style={inputStyle} placeholder="Sua resposta…" /></div>
}

// ---------- Upload do cliente (foto/arquivo) no formulário público ----------
function UploadField({ block, theme, glass, value, onChange }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)
  const acceptAny = block.config?.accept === 'any'
  const isImg = value && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(value)

  const handle = async (file) => {
    if (!file) return
    setBusy(true); setErr('')
    const r = await uploadTo(file, { bucket: 'flow', folder: 'submissions', accept: acceptAny ? 'any' : 'image', maxMB: 15 })
    setBusy(false)
    if (r.error) setErr(r.error); else onChange(r.url)
  }

  return (
    <div>
      <div className="mb-6">
        {block.help && <p className="text-[11px] tracking-widerx uppercase mb-2" style={{ color: theme.accent, opacity: 0.85 }}>{block.help}</p>}
        <h2 className="font-serif leading-tight" style={{ fontSize: '2rem' }}>{block.label}{block.required ? <span style={{ color: theme.accent }}> *</span> : null}</h2>
      </div>
      <input ref={ref} type="file" accept={acceptAny ? undefined : 'image/*'} capture={acceptAny ? undefined : 'environment'} className="hidden" onChange={(e) => handle(e.target.files[0])} />
      <div onClick={() => !busy && ref.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]) }}
        className="cursor-pointer text-center px-6 py-10 transition-all" style={{ ...glass, borderStyle: value ? 'solid' : 'dashed' }}>
        {value ? (
          <div className="flex flex-col items-center gap-3">
            {isImg ? <img src={value} alt="" className="max-h-52 rounded-2xl object-cover" /> : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(214,196,154,0.15)', color: theme.accent }}>
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 3v5h5M8 3h7l5 5v13H4V3z" strokeLinejoin="round" /></svg>
              </div>
            )}
            <span className="text-sm opacity-70">{busy ? 'Enviando…' : 'Enviado ✓ — toque para trocar'}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-80">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${theme.accent}`, color: theme.accent }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span className="text-lg">{busy ? 'Enviando…' : acceptAny ? 'Enviar arquivo' : 'Enviar foto'}</span>
            <span className="text-xs opacity-40">toque para escolher{acceptAny ? '' : ' ou tirar uma foto'}</span>
          </div>
        )}
      </div>
      {err && <p className="text-rose-300 text-sm mt-3 text-center">{err}</p>}
    </div>
  )
}
