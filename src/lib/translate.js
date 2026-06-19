// Tradução automática (Google gtx, grátis) com glossário + cache versionado.
// Fonte sempre PT; alvo en/es. Em erro, devolve o texto original.

const mem = {}
const VER = 'tr2:' // bump => invalida cache anterior (qualidade ruim do MyMemory)

// Termos curtos/ambíguos (menu, rótulos) com tradução garantida.
const GLOSSARY = {
  Home: { en: 'Home', es: 'Inicio' },
  Sobre: { en: 'About', es: 'Acerca' },
  'Sobre nós': { en: 'About us', es: 'Sobre nosotros' },
  Serviços: { en: 'Services', es: 'Servicios' },
  Portfólio: { en: 'Portfolio', es: 'Portafolio' },
  Processo: { en: 'Process', es: 'Proceso' },
  'Nosso processo': { en: 'Our process', es: 'Nuestro proceso' },
  'Para quem': { en: 'For whom', es: 'Para quién' },
  'Para quem criamos': { en: 'Who we create for', es: 'Para quién creamos' },
  Jornal: { en: 'Journal', es: 'Diario' },
  Contato: { en: 'Contact', es: 'Contacto' },
  Depoimentos: { en: 'Testimonials', es: 'Testimonios' },
  Equipe: { en: 'Team', es: 'Equipo' },
  'Ver todos os projetos': { en: 'See all projects', es: 'Ver todos los proyectos' },
}

function cacheKey(target, text) {
  return VER + target + ':' + text
}

async function translateOne(text, target) {
  const g = GLOSSARY[text]
  if (g && g[target]) return g[target]

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
  if (text.length > 1800) return text
  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=' +
      target +
      '&dt=t&q=' +
      encodeURIComponent(text)
    const r = await fetch(url)
    const j = await r.json()
    const tr = j && j[0] ? j[0].map((s) => s[0]).join('') : text
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
