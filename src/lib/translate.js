// Tradução automática gratuita (MyMemory) com cache em memória + localStorage.
// Fonte sempre PT; alvo en/es. Em caso de erro, devolve o texto original.

const mem = {}

function cacheKey(target, text) {
  return 'tr:' + target + ':' + text
}

async function translateOne(text, target) {
  const k = cacheKey(target, text)
  if (mem[k] != null) return mem[k]
  try {
    const ls = localStorage.getItem(k)
    if (ls != null) {
      mem[k] = ls
      return ls
    }
  } catch (e) {
    /* ignore */
  }
  // MyMemory tem limite ~500 chars por consulta
  if (text.length > 480) return text
  try {
    const url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(text) +
      '&langpair=pt|' +
      target
    const r = await fetch(url)
    const j = await r.json()
    const tr = j && j.responseData && j.responseData.translatedText ? j.responseData.translatedText : text
    mem[k] = tr
    try {
      localStorage.setItem(k, tr)
    } catch (e) {
      /* ignore */
    }
    return tr
  } catch (e) {
    return text
  }
}

export async function translateMany(texts, target) {
  const unique = [...new Set(texts)]
  const out = {}
  const CONCURRENCY = 6
  let i = 0
  async function worker() {
    while (i < unique.length) {
      const t = unique[i++]
      out[t] = await translateOne(t, target)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return out
}
