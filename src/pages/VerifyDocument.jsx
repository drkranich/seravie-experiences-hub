import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Comprovante público de assinatura (#validar/<code> ou /validar/<code>).
// Manifesto no estilo Clicksign/D4Sign: documento, signatários, IPs, datas, trilha.
const THEME = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', ink: '#0b0a08', sage: '#8FA07C' }
const fmtDT = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—'
const ST = { draft: 'Rascunho', sent: 'Enviado', viewed: 'Visualizado', signed: 'Parcial', completed: 'Concluído', cancelled: 'Cancelado' }
const EV = { created: 'Documento criado', sent: 'Enviado para assinatura', viewed: 'Visualizado pelo signatário', signed: 'Assinado', completed: 'Concluído — todos assinaram', cancelled: 'Cancelado' }

export function VerifyDocument() {
  const code = routeParam('validar')
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    (async () => {
      if (!code) { setState({ loading: false, error: 'missing_code' }); return }
      const { data, error } = await supabase.functions.invoke('verify-doc', { body: { code } })
      if (error || data?.error) { setState({ loading: false, error: data?.error || 'network' }); return }
      setState({ loading: false, ...data })
    })()
  }, [code])

  const wrap = { minHeight: '100vh', background: `radial-gradient(1200px 800px at 50% -10%, ${THEME.bg1}, ${THEME.bg2})`, color: THEME.text, fontFamily: 'Georgia, serif', padding: '40px 20px' }
  const card = { maxWidth: 720, margin: '0 auto', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 36 }
  const chip = (ok) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'system-ui', background: ok ? 'rgba(143,160,124,0.2)' : 'rgba(216,196,154,0.15)', color: ok ? THEME.sage : THEME.accent })
  const sysFont = { fontFamily: 'system-ui, sans-serif' }

  if (state.loading) return <div style={wrap}><p style={{ opacity: 0.5, textAlign: 'center' }}>Verificando documento…</p></div>
  if (state.error) return (
    <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
      <h1 style={{ fontSize: 24 }}>Documento não encontrado</h1>
      <p style={{ opacity: 0.6, ...sysFont, fontSize: 14 }}>O código de verificação é inválido ou o documento não existe.</p>
    </div></div>
  )

  const d = state.document || {}
  const signers = state.signers || []
  const events = state.events || []
  const completed = d.status === 'completed'

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: THEME.accent, margin: '0 0 6px' }}>Comprovante de assinatura</p>
            <h1 style={{ fontSize: 28, margin: 0 }}>{d.title}</h1>
          </div>
          <span style={chip(completed)}>{completed ? '✓ ' : ''}{ST[d.status] || d.status}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, margin: '24px 0', ...sysFont }}>
          <Info label="Documento" value={d.file_name || d.title} />
          <Info label="Criado em" value={fmtDT(d.created_at)} />
          <Info label="Concluído em" value={fmtDT(d.completed_at)} />
          <Info label="Código de verificação" value={d.verification_code} mono />
        </div>

        <Section title="Signatários">
          {signers.map((s, i) => (
            <div key={i} style={{ padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.07)', ...sysFont }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 15 }}>{s.signed_name || s.name || s.email || 'Signatário'}</div>
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{s.email}</div>
                </div>
                <span style={chip(s.status === 'signed')}>{s.status === 'signed' ? 'Assinou' : s.status === 'viewed' ? 'Visualizou' : 'Pendente'}</span>
              </div>
              {s.status === 'signed' && (
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6, lineHeight: 1.6 }}>
                  Assinado em {fmtDT(s.signed_at)}{s.signed_ip && s.signed_ip !== 'desconhecido' ? ` · IP ${s.signed_ip}` : ''}
                </div>
              )}
            </div>
          ))}
        </Section>

        <Section title="Trilha de auditoria">
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', ...sysFont }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: THEME.accent, marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14 }}>{EV[e.event] || e.event}</div>
                <div style={{ fontSize: 11, opacity: 0.45 }}>{fmtDT(e.created_at)}{e.ip && e.ip !== 'desconhecido' ? ` · IP ${e.ip}` : ''}</div>
              </div>
            </div>
          ))}
        </Section>

        <p style={{ fontSize: 11, opacity: 0.4, marginTop: 24, ...sysFont, lineHeight: 1.6 }}>
          Este comprovante atesta a assinatura eletrônica do documento acima, registrada com data, hora e IP de cada signatário,
          conforme a MP 2.200-2/2001 (art. 10, §2º). Documento validável pelo código de verificação em seravieexperiences.com/validar.
        </p>
      </div>
    </div>
  )
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</div>
    </div>
  )
}
function Section({ title, children }) {
  return (
    <div style={{ marginTop: 26 }}>
      <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#D6C49A', opacity: 0.8, margin: '0 0 4px', fontFamily: 'system-ui' }}>{title}</p>
      {children}
    </div>
  )
}
