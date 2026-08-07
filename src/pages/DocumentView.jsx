import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Proposta "viva" — página pública (#p/<slug>). Renderiza os blocos do documento,
// permite aceite + assinatura digital. Glassmorphism editorial premium.
const DEFAULT_THEME = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ink: '#0b0a08' }
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function DocumentView() {
  const slug = routeParam('p')
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signer, setSigner] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('documents').select('*').eq('slug', slug).eq('public_enabled', true).maybeSingle()
      setDoc(data || null)
      if (data) { supabase.rpc('document_mark_viewed', { p_slug: slug }); if (['accepted', 'signed'].includes(data.status)) setDone(true) }
      setLoading(false)
    })()
  }, [slug])

  const theme = useMemo(() => ({ ...DEFAULT_THEME, ...(doc?.theme || {}) }), [doc])
  const blocks = Array.isArray(doc?.blocks) ? doc.blocks : []
  const data = doc?.data || {}

  const accept = async () => {
    if (signer.trim().length < 2) return setErr('Digite seu nome completo para assinar.')
    setAccepting(true); setErr('')
    const { data: r, error } = await supabase.rpc('document_accept', { p_slug: slug, p_signer: signer.trim(), p_meta: { ua: navigator.userAgent, at: new Date().toISOString() } })
    setAccepting(false)
    if (error || r?.error) return setErr('Não foi possível registrar o aceite. Tente novamente.')
    setDone(true)
  }

  const bg = { backgroundImage: `radial-gradient(70% 45% at 80% -5%, ${theme.accent}22, transparent 60%), linear-gradient(165deg, ${theme.bg1}, ${theme.bg2})`, color: theme.text, minHeight: '100vh' }
  const glass = { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20 }

  if (loading) return <div style={bg} className="flex items-center justify-center font-serif text-xl">Carregando…</div>
  if (!doc) return <div style={bg} className="flex flex-col items-center justify-center text-center px-6"><p className="font-serif text-2xl">Documento não encontrado</p><p className="opacity-50 text-sm mt-2">Este link pode ter expirado ou sido despublicado.</p></div>

  return (
    <div style={bg}>
      <div className="max-w-2xl mx-auto px-5 py-16">
        {blocks.map((b, i) => <Block key={i} b={b} theme={theme} data={data} glass={glass} />)}

        {/* Aceite / assinatura */}
        <div className="mt-10" style={{ ...glass, padding: 28 }}>
          {done ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ border: `2px solid ${theme.accent}`, color: theme.accent }}>
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12l4 4 10-11" /></svg>
              </div>
              <h3 className="font-serif text-2xl">Proposta aceita</h3>
              <p className="opacity-60 text-sm mt-2">{doc.signer_name ? `Assinada por ${doc.signer_name}` : 'Registrado com sucesso'}.</p>
            </div>
          ) : (
            <>
              <h3 className="font-serif text-2xl mb-1">Aceitar proposta</h3>
              <p className="opacity-60 text-sm mb-5">Ao assinar, você concorda com os termos apresentados acima.</p>
              <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Seu nome completo" className="w-full px-5 py-4 text-lg rounded-2xl outline-none mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: theme.text }} />
              {err && <p className="text-rose-300 text-sm mb-3">{err}</p>}
              <button onClick={accept} disabled={accepting} className="w-full py-4 text-[13px] tracking-widerx uppercase font-medium rounded-2xl transition-all disabled:opacity-50" style={{ background: theme.accent, color: theme.ink }}>{accepting ? 'Registrando…' : 'Assinar e aceitar'}</button>
              <p className="opacity-30 text-[10px] text-center mt-4">Assinatura digital registrada com data, hora e dispositivo.</p>
            </>
          )}
        </div>
        <p className="text-center opacity-20 text-[10px] mt-8 tracking-widerx uppercase">Seravie Document Studio</p>
      </div>
    </div>
  )
}

// merge de variáveis {{campo}} com os dados do documento
const merge = (s, data) => typeof s === 'string' ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => data?.[k] ?? '') : s

function Block({ b, theme, data, glass }) {
  const t = b.type
  if (t === 'cover') return (
    <div className="text-center mb-10 py-10">
      {b.logo_url && <img src={b.logo_url} alt="" className="h-12 mx-auto mb-8 object-contain" />}
      {b.eyebrow && <p className="text-[11px] tracking-widerx uppercase mb-3" style={{ color: theme.accent }}>{merge(b.eyebrow, data)}</p>}
      <h1 className="font-serif text-4xl leading-tight">{merge(b.title, data) || 'Proposta Comercial'}</h1>
      {b.subtitle && <p className="opacity-60 mt-3">{merge(b.subtitle, data)}</p>}
      {b.image_url && <img src={b.image_url} alt="" className="w-full h-56 object-cover mt-8" style={{ borderRadius: 16 }} />}
    </div>
  )
  if (t === 'heading') return <h2 className="font-serif text-2xl mt-8 mb-3">{merge(b.text, data)}</h2>
  if (t === 'text') return <p className="opacity-75 leading-relaxed whitespace-pre-wrap mb-4">{merge(b.text, data)}</p>
  if (t === 'image') return b.url ? <img src={b.url} alt="" className="w-full object-cover my-6" style={{ borderRadius: 16 }} /> : null
  if (t === 'quote_table') {
    const items = data.items || []
    return (
      <div className="my-6" style={{ ...glass, padding: 20 }}>
        {b.title && <p className="text-[11px] tracking-widerx uppercase mb-3" style={{ color: theme.accent }}>{b.title}</p>}
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex justify-between items-baseline text-sm py-1.5 border-b border-white/[0.06] last:border-0">
              <span className="opacity-80">{it.qty}× {it.name}</span>
              <span className="opacity-90">{brl(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-white/[0.1]">
          <span className="font-serif text-lg">Total</span>
          <span className="font-serif text-2xl" style={{ color: theme.accent }}>{brl(data.total)}</span>
        </div>
      </div>
    )
  }
  if (t === 'terms') return (
    <div className="my-6 opacity-70 text-sm">
      <h3 className="font-serif text-xl mb-2" style={{ color: theme.accent }}>{b.title || 'Termos'}</h3>
      <p className="whitespace-pre-wrap leading-relaxed">{merge(b.text, data)}</p>
    </div>
  )
  if (t === 'callout') return (
    <div className="my-6" style={{ borderLeft: `3px solid ${theme.accent}`, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px' }}>
      {b.title && <p className="text-[11px] tracking-widerx uppercase mb-1.5" style={{ color: theme.accent }}>{merge(b.title, data)}</p>}
      <p className="opacity-85 leading-relaxed whitespace-pre-wrap">{merge(b.text, data)}</p>
    </div>
  )
  if (t === 'divider') return <div className="my-8" style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />
  if (t === 'signature_line') return (
    <div className="flex gap-10 my-8">
      {[b.left_label || 'Contratante', b.right_label || 'Contratada'].map((lbl, i) => (
        <div key={i} className="flex-1 text-center">
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)', marginTop: 48, paddingTop: 8 }} className="text-xs opacity-60">{lbl}</div>
        </div>
      ))}
    </div>
  )
  return null
}
