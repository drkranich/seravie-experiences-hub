// Videochamadas — dois provedores:
//  - Jitsi (meet.jit.si): gratuito, sem login, SALA COMPARTILHADA determinística
//    a partir de um identificador estável (thread de DM ou projeto). Ambos os
//    lados que clicam entram na MESMA sala. É o padrão recomendado.
//  - Google Meet: abre meet.google.com/new (cria uma sala nova, exige conta
//    Google logada; o usuário copia e compartilha o link manualmente).

const slug = (s) => 'seravie-' + String(s || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)

export function callRoomUrl(key) {
  return `https://meet.jit.si/${slug(key)}`
}

// Jitsi — sala compartilhada por chave (default)
export function startVideoCall(key) {
  const url = callRoomUrl(key)
  window.open(url, '_blank', 'noopener')
  return url
}

// Google Meet — cria uma sala nova (sem chave compartilhada)
export function startGoogleMeet() {
  const url = 'https://meet.google.com/new'
  window.open(url, '_blank', 'noopener')
  return url
}
