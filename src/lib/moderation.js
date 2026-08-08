// moderation — checagem de termos ofensivos no cliente (espelha moderation_words).
// A regra dura é reforçada no servidor (RLS + trigger); aqui é o feedback imediato.

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Detecta palavra proibida por limite de palavra (não pega substrings inocentes).
export function findBannedWords(text, words = []) {
  const nt = ' ' + norm(text).replace(/[^a-z0-9à-ÿ\s]/gi, ' ') + ' '
  const hits = []
  for (const w of words) {
    const nw = norm(w).trim()
    if (!nw) continue
    const re = new RegExp(`\\s${nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`)
    if (re.test(nt)) hits.push(w)
  }
  return hits
}

export function isClean(text, words = []) {
  return findBannedWords(text, words).length === 0
}
