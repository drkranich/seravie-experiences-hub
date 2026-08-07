// kdsSound.js — configuração e reprodução de sons do KDS (WebAudio, sem assets).
// Sons discretos por evento, configuráveis (liga/desliga por evento + volume).
// A preferência é mantida em memória no app (não usamos storage do browser).

export const SOUND_EVENTS = [
  { key: 'new', label: 'Novo pedido', freq: 520 },
  { key: 'urgent', label: 'Pedido urgente', freq: 880 },
  { key: 'ready', label: 'Pedido pronto', freq: 660 },
  { key: 'cancel', label: 'Pedido cancelado', freq: 220 },
]

export const DEFAULT_SOUND = {
  enabled: true,
  volume: 0.5, // 0..1
  events: { new: true, urgent: true, ready: true, cancel: true },
}

let _audioCtx = null
function ctx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch { _audioCtx = null } }
  return _audioCtx
}

// Toca o som de um evento respeitando a config (enabled global + por evento + volume).
export function playSound(type, cfg = DEFAULT_SOUND) {
  if (!cfg?.enabled) return
  if (cfg.events && cfg.events[type] === false) return
  const c = ctx(); if (!c) return
  try {
    const ev = SOUND_EVENTS.find((e) => e.key === type) || SOUND_EVENTS[0]
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = ev.freq; o.type = 'sine'
    const peak = Math.max(0.001, Math.min(0.15, (cfg.volume ?? 0.5) * 0.16))
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(peak, c.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35)
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.36)
  } catch { /* silêncio se o browser bloquear áudio */ }
}
