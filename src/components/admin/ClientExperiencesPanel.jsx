import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

// Painel que entrega ao lojista os LINKS PÚBLICOS das experiências do cliente
// (agendamento, reserva, clube). O conteúdo é cadastrado nos painéis de vertical
// (Spa/serviços, Turismo/passeios, Clube/planos); aqui ele pega o link/QR.
const EXPERIENCES = [
  { key: 'agenda', icon: 'calendar', title: 'Agendamento online', desc: 'Cliente escolhe serviço, dia e horário (spa, beauty, consultorias).', hint: 'Cadastre os serviços no painel da sua frente (ex: Spa → Serviços).' },
  { key: 'reserva', icon: 'map', title: 'Reserva de experiência', desc: 'Cliente reserva passeio/roteiro com data e nº de pessoas (turismo, eventos).', hint: 'Cadastre os passeios no painel Turismo.' },
  { key: 'clube', icon: 'star', title: 'Clube / Assinatura', desc: 'Cliente adere a um plano recorrente (vinhos, café, floricultura).', hint: 'Cadastre os planos na aba Clube da sua frente.' },
]

function QRThumb({ url, size = 128 }) {
  const [img, setImg] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#14160f', light: '#f4f0e6' } }).then(setImg).catch(() => {}) }, [url])
  if (!img) return <div className="rounded-xl bg-white/[0.05]" style={{ width: size, height: size }} />
  return <img src={img} alt="QR" width={size} height={size} className="rounded-xl bg-[#f4f0e6] p-1" />
}

export function ClientExperiencesPanel({ notify }) {
  const { profile } = useTenant()
  const [slug, setSlug] = useState(null)
  const [qrOpen, setQrOpen] = useState(null)

  useEffect(() => {
    (async () => {
      if (!profile?.tenant_id) return
      const { data } = await supabase.from('tenants').select('slug').eq('id', profile.tenant_id).maybeSingle()
      setSlug(data?.slug || null)
    })()
  }, [profile?.tenant_id])

  const linkFor = (key) => `${window.location.origin}/#${key}/${slug || ''}`
  const copy = (key) => { navigator.clipboard?.writeText(linkFor(key)); notify('Link copiado', 'success') }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-admin-text">Experiências do Cliente</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Links públicos para seus clientes agendarem, reservarem e assinarem — divulgue no Instagram, WhatsApp ou QR na loja.</p>
      </div>

      {!slug ? (
        <p className="text-admin-muted/40 text-sm">Defina o identificador (slug) da sua conta em Configurações para gerar os links.</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {EXPERIENCES.map((e) => (
            <div key={e.key} className="glass rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-2"><Icon name={e.icon} className="w-5 h-5 text-admin-champ" /><h3 className="text-admin-text font-medium">{e.title}</h3></div>
              <p className="text-admin-muted/50 text-xs leading-relaxed">{e.desc}</p>
              <p className="text-admin-muted/30 text-[11px] mt-2 italic">{e.hint}</p>
              <div className="mt-3 bg-white/[0.03] rounded-lg px-3 py-2 text-[11px] text-admin-champ/80 break-all">{linkFor(e.key)}</div>
              <div className="mt-auto flex gap-2 pt-3">
                <button onClick={() => copy(e.key)} className="flex-1 text-xs py-2 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Copiar link</button>
                <button onClick={() => setQrOpen(e)} className="text-xs px-3 py-2 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">QR</button>
                <a href={linkFor(e.key)} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Abrir</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setQrOpen(null)}>
          <div className="glass-pop rounded-2xl p-7 text-center" onClick={(ev) => ev.stopPropagation()}>
            <QRThumb url={linkFor(qrOpen.key)} size={240} />
            <p className="text-admin-text font-medium mt-4">{qrOpen.title}</p>
            <p className="text-admin-muted/40 text-xs break-all mt-1 max-w-xs">{linkFor(qrOpen.key)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
