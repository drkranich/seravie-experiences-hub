import { useState, useRef, useEffect } from 'react'
import { Icon } from '../ui'
import { startVideoCall, startGoogleMeet } from '../../../lib/videoCall'

// Botão de videochamada com escolha de provedor: Jitsi (sala compartilhada,
// gratuito) ou Google Meet (sala nova, exige conta Google). `callKey` é a chave
// determinística da sala Jitsi (ex.: 'dm-<id>' ou 'proj-<id>').

export function VideoCallButton({ callKey, compact = false, notify }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const jitsi = () => { startVideoCall(callKey); setOpen(false) }
  const gmeet = () => { startGoogleMeet(); setOpen(false); notify?.('Sala do Google Meet aberta — copie o link e compartilhe na conversa.', 'info') }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Videochamada"
        className={compact
          ? 'w-8 h-8 rounded-lg glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center transition-colors'
          : 'flex items-center gap-2 glass-input text-admin-muted/70 hover:text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors'}>
        <Icon name="tv" className="w-4 h-4" />{!compact && 'Videochamada'}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass-pop rounded-xl p-1.5 z-50 shadow-2xl">
          <button onClick={jitsi} className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-white/[0.04] transition-colors">
            <Icon name="tv" className="w-4 h-4 text-admin-champ/70 shrink-0 mt-0.5" />
            <div><p className="text-admin-text text-sm">Sala Seravie (Jitsi)</p><p className="text-admin-muted/45 text-[11px]">Gratuito · mesma sala para todos</p></div>
          </button>
          <button onClick={gmeet} className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-white/[0.04] transition-colors">
            <Icon name="external" className="w-4 h-4 text-admin-sage/70 shrink-0 mt-0.5" />
            <div><p className="text-admin-text text-sm">Google Meet</p><p className="text-admin-muted/45 text-[11px]">Nova sala · exige conta Google</p></div>
          </button>
        </div>
      )}
    </div>
  )
}
