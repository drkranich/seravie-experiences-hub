import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Página pública de assinatura (#sign/<token> ou /sign/<token>). Sem login.
// Mostra o documento, canvas para desenhar a assinatura e aceite. Glassmorphism editorial.
const THEME = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ink: '#0b0a08' }

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    // resolução nítida
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * ratio; c.height = rect.height * ratio
    ctx.scale(ratio, ratio)
    ctx.strokeStyle = THEME.text; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  }, [])

  const pos = (e) => {
    const c = canvasRef.current; const rect = c.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p; if (empty) setEmpty(false)
  }
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(empty ? null : canvasRef.current.toDataURL('image/png')) }
  const clear = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null) }

  return (
    <div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 160, touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>Desenhe sua assinatura acima</span>
        <button onClick={clear} style={{ fontSize: 12, color: THEME.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>
      </div>
    </div>
  )
}

// converte um File de imagem em dataURL (com limite de tamanho)
function fileToDataUrl(file, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!file) return reject('no_file')
    if (file.size > maxBytes) return reject('file_too_big')
    const rd = new FileReader()
    rd.onload = () => resolve(rd.result)
    rd.onerror = () => reject('read_error')
    rd.readAsDataURL(file)
  })
}

export function SignDocument() {
  const token = routeParam('sign')
  const [state, setState] = useState({ loading: true })
  const [name, setName] = useState('')
  const [sig, setSig] = useState(null)
  const [sigMode, setSigMode] = useState('draw') // draw | upload
  const [idDoc, setIdDoc] = useState(null) // { data, name, type }
  const [idKind, setIdKind] = useState('rg') // rg | cpf | cnh | outro
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      if (!token) { setErr('invalid_token'); setState({ loading: false }); return }
      const { data, error } = await supabase.functions.invoke('sign-doc', { body: { token, action: 'load' } })
      const res = error ? { error: 'network' } : data
      if (!res || res.error) { setErr(res?.error || 'erro'); setState({ loading: false }); return }
      if (res.signer?.status === 'signed') setDone(true)
      setName(res.signer?.name || '')
      setState({ loading: false, ...res })
    })()
  }, [token])

  const submit = async () => {
    if (!name.trim()) return setErr('name_required')
    if (!sig) return setErr('signature_required')
    if (!accepted) return setErr('accept_required')
    setSubmitting(true); setErr('')
    const { data, error } = await supabase.functions.invoke('sign-doc', { body: { token, signed_name: name.trim(), signature_data: sig, id_document: idDoc ? { data: idDoc.data, name: idDoc.name, kind: idKind } : null } })
    setSubmitting(false)
    if (error || data?.error) return setErr(data?.error || 'erro')
    setDone(true)
  }

  const wrap = { minHeight: '100vh', background: `radial-gradient(1200px 800px at 50% -10%, ${THEME.bg1}, ${THEME.bg2})`, color: THEME.text, fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const card = { width: '100%', maxWidth: 640, background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32 }
  const label = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, display: 'block', marginBottom: 6 }
  const input = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', color: THEME.text, fontSize: 15, fontFamily: 'system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }
  const btn = (primary) => ({ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'system-ui, sans-serif', background: primary ? THEME.accent : 'rgba(255,255,255,0.06)', color: primary ? THEME.ink : THEME.text, opacity: submitting ? 0.6 : 1 })
  const errMsg = { name_required: 'Digite seu nome completo.', signature_required: 'Desenhe ou envie sua assinatura.', accept_required: 'Marque o aceite para prosseguir.', invalid_token: 'Link inválido ou expirado.', already_signed: 'Este documento já foi assinado.', cancelled: 'Esta solicitação foi cancelada.', network: 'Falha de conexão. Tente novamente.', file_too_big: 'Arquivo muito grande (máximo 5 MB).', read_error: 'Não foi possível ler o arquivo. Tente outro.' }[err] || (err ? 'Ocorreu um erro. Tente novamente.' : '')

  if (state.loading) return <div style={wrap}><p style={{ opacity: 0.5 }}>Carregando documento…</p></div>
  if (err && !state.request) return <div style={wrap}><div style={card}><h1 style={{ fontSize: 22 }}>Não foi possível abrir</h1><p style={{ opacity: 0.6, fontFamily: 'system-ui' }}>{errMsg}</p></div></div>

  const r = state.request || {}

  if (done) return (
    <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(120,160,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
      <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>Documento assinado</h1>
      <p style={{ opacity: 0.6, fontFamily: 'system-ui', fontSize: 14 }}>Obrigado. Sua assinatura de <b>{r.title}</b> foi registrada com data, hora e IP. A outra parte foi notificada.</p>
    </div></div>
  )

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: THEME.accent, marginBottom: 6 }}>Documento para assinatura</p>
        <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>{r.title}</h1>
        {r.message && <p style={{ opacity: 0.7, fontFamily: 'system-ui', fontSize: 14, marginBottom: 16 }}>{r.message}</p>}

        {/* documento */}
        {state.file_url && (
          <div style={{ margin: '16px 0', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {(r.file_ext || '').toLowerCase() === 'pdf'
              ? <iframe title="documento" src={state.file_url} style={{ width: '100%', height: 380, border: 'none', background: '#fff' }} />
              : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes((r.file_ext || '').toLowerCase())
                ? <img alt="documento" src={state.file_url} style={{ width: '100%', display: 'block' }} />
                : <a href={state.file_url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 16, color: THEME.accent, fontFamily: 'system-ui' }}>Abrir documento ({r.file_name})</a>}
          </div>
        )}

        {/* assinatura */}
        <div style={{ marginTop: 20 }}>
          <label style={label}>Seu nome completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="Nome de quem assina" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={label}>Sua assinatura</label>
          <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 10, marginBottom: 10 }}>
            {[['draw', 'Desenhar'], ['upload', 'Enviar imagem']].map(([k, l]) => (
              <button key={k} onClick={() => { setSigMode(k); setSig(null) }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'system-ui, sans-serif', background: sigMode === k ? THEME.accent : 'transparent', color: sigMode === k ? THEME.ink : THEME.text }}>{l}</button>
            ))}
          </div>
          {sigMode === 'draw'
            ? <SignaturePad onChange={setSig} />
            : (
              <div>
                <label style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, cursor: 'pointer', textAlign: 'center', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  {sig ? <img alt="assinatura" src={sig} style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }} />
                    : <span style={{ opacity: 0.6, fontFamily: 'system-ui', fontSize: 13 }}>Clique para enviar sua assinatura (JPG ou PNG)</span>}
                  <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setSig(await fileToDataUrl(f)); setErr('') } catch (x) { setErr(x === 'file_too_big' ? 'file_too_big' : 'read_error') } }} />
                </label>
                {sig && <button onClick={() => setSig(null)} style={{ fontSize: 12, color: THEME.accent, background: 'none', border: 'none', cursor: 'pointer', marginTop: 6 }}>Remover imagem</button>}
              </div>
            )}
        </div>

        {/* documento de identificação (opcional) */}
        <div style={{ marginTop: 16 }}>
          <label style={label}>Documento de identificação <span style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>(opcional — reforça a validade)</span></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={idKind} onChange={(e) => setIdKind(e.target.value)} style={{ ...input, width: 'auto', fontFamily: 'system-ui, sans-serif' }}>
              <option value="rg">RG</option>
              <option value="cpf">CPF</option>
              <option value="cnh">CNH</option>
              <option value="outro">Outro</option>
            </select>
            <label style={{ ...btn(false), width: 'auto', padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {idDoc ? '✓ Anexado' : 'Anexar arquivo'}
              <input type="file" accept="image/png,image/jpeg,application/pdf" style={{ display: 'none' }}
                onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setIdDoc({ data: await fileToDataUrl(f), name: f.name, type: f.type }); setErr('') } catch (x) { setErr(x === 'file_too_big' ? 'file_too_big' : 'read_error') } }} />
            </label>
            {idDoc && <span style={{ fontFamily: 'system-ui', fontSize: 12, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 8 }}>{idDoc.name}<button onClick={() => setIdDoc(null)} style={{ color: THEME.accent, background: 'none', border: 'none', cursor: 'pointer' }}>remover</button></span>}
          </div>
          <p style={{ fontFamily: 'system-ui', fontSize: 11, opacity: 0.4, marginTop: 6 }}>Aceita JPG, PNG ou PDF. Fica guardado com a trilha de auditoria da assinatura.</p>
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontFamily: 'system-ui', fontSize: 13, opacity: 0.85, cursor: 'pointer' }}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Li o documento e concordo em assiná-lo eletronicamente. Entendo que minha assinatura, data, hora e IP serão registrados como prova (MP 2.200-2).</span>
        </label>

        {errMsg && <p style={{ color: '#e0a0a0', fontFamily: 'system-ui', fontSize: 13, marginTop: 12 }}>{errMsg}</p>}
        <button onClick={submit} disabled={submitting} style={{ ...btn(true), marginTop: 18 }}>{submitting ? 'Registrando…' : 'Assinar documento'}</button>
      </div>
    </div>
  )
}
