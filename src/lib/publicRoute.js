// Helpers de rota pública que aceitam URL LIMPA (/form/slug) e o formato
// antigo com hash (#form/slug). Mantém compatibilidade com links já divulgados.

// Extrai o parâmetro após o prefixo (ex.: 'form' → o slug). Tenta path, depois hash.
export function routeParam(prefix) {
  const path = window.location.pathname
  const p = new RegExp(`^/${prefix}/([^/?#]+)`).exec(path)
  if (p) return decodeURIComponent(p[1])
  const h = new RegExp(`#${prefix}/([^?]+)`).exec(window.location.hash)
  return h ? h[1] : ''
}

// Query string, seja em URL limpa (?x=) ou após o hash (#...?x=)
export function routeQuery() {
  const fromPath = window.location.search.replace(/^\?/, '')
  const fromHash = (window.location.hash.split('?')[1] || '')
  return new URLSearchParams(fromPath || fromHash)
}

// Detecta o "modo" das experiências do cliente (agenda|reserva|clube)
export function experienceMode() {
  const s = window.location.pathname + ' ' + window.location.hash
  if (/(^|[#/])agenda(\/|$)/.test(s)) return 'agenda'
  if (/(^|[#/])reserva(\/|$)/.test(s)) return 'reserva'
  return 'clube'
}

// Monta uma URL pública LIMPA (sem hash) para divulgação
export function publicLink(prefix, slug) {
  return `${window.location.origin}/${prefix}/${slug}`
}
