// commandSearch — lógica de busca/ranqueamento do Ctrl+K (testável, sem React).
//
// Faz correspondência tolerante (acentos, maiúsculas, substring e "fuzzy" por
// subsequência) e pontua os resultados: prefixo > palavra inicial > substring >
// subsequência. Usada tanto para itens de navegação/ações quanto para dados.

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()

// pontua o quão bem `q` casa com `text`. 0 = não casa.
export function scoreMatch(q, text) {
  const nq = norm(q)
  const nt = norm(text)
  if (!nq) return 1 // sem query: tudo passa (peso baixo)
  if (!nt) return 0
  if (nt === nq) return 1000
  if (nt.startsWith(nq)) return 700
  // início de palavra
  const words = nt.split(/[\s\-_/·.,]+/)
  if (words.some((w) => w.startsWith(nq))) return 500
  const idx = nt.indexOf(nq)
  if (idx >= 0) return 300 - idx // substring; quanto mais no início, melhor
  // subsequência (fuzzy): todos os caracteres de nq aparecem em ordem
  let i = 0
  for (let c = 0; c < nt.length && i < nq.length; c++) {
    if (nt[c] === nq[i]) i++
  }
  if (i === nq.length) return 100
  return 0
}

// filtra + ordena uma lista de comandos por relevância à query.
// cada item precisa ter um campo de texto (via keyFn) e é retornado com _score.
export function rankItems(items, q, keyFn = (x) => x.label) {
  const scored = []
  for (const it of items) {
    // considera label + palavras-chave extras (it.keywords)
    const base = keyFn(it) || ''
    const extra = Array.isArray(it.keywords) ? it.keywords.join(' ') : (it.keywords || '')
    const s = Math.max(scoreMatch(q, base), extra ? scoreMatch(q, extra) * 0.9 : 0)
    if (s > 0) scored.push({ ...it, _score: s })
  }
  scored.sort((a, b) => b._score - a._score || String(a.label).length - String(b.label).length)
  return scored
}

// achata as seções de navegação em comandos { id, label, route, group, keywords }.
export function navCommands(sections = []) {
  const cmds = []
  for (const sec of sections) {
    for (const item of sec.items || []) {
      const route = item.route || item.key
      cmds.push({
        id: 'nav:' + item.key,
        kind: 'nav',
        label: item.label,
        route,
        group: sec.group,
        icon: item.icon || 'grid',
        keywords: [sec.group, item.key],
      })
      for (const p of item.pages || []) {
        cmds.push({
          id: 'nav:' + item.key + '.' + (p.key || p.route),
          kind: 'nav',
          label: p.label,
          sublabel: item.label,
          route: p.route || p.key,
          group: item.label,
          icon: item.icon || 'layout',
          keywords: [item.label, sec.group, p.key],
        })
      }
    }
  }
  // dedup por route+label (páginas repetem rotas às vezes)
  const seen = new Set()
  return cmds.filter((c) => {
    const k = c.route + '|' + norm(c.label)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
