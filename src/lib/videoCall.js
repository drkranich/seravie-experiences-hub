// Videochamadas — gera uma sala pública (Jitsi Meet, sem servidor próprio) a
// partir de um identificador estável (ex.: thread de DM ou projeto). Abre em
// nova aba. Simples e sem custo; pode ser trocado por outro provedor depois.

const slug = (s) => 'seravie-' + String(s || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)

export function callRoomUrl(key) {
  return `https://meet.jit.si/${slug(key)}`
}

export function startVideoCall(key) {
  const url = callRoomUrl(key)
  window.open(url, '_blank', 'noopener')
  return url
}
