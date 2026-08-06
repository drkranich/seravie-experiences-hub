// csv.js — utilitários de CSV compartilhados pelo Seravie (importação genérica).
//
// Objetivo: um único parser robusto (aspas, escape "", separador ; ou , auto,
// BOM, quebras \r\n) usado tanto pelo import da Equipe quanto pelo import
// genérico do Catálogo (ResourcePanel). Devolve tanto as linhas cruas quanto
// os cabeçalhos, para permitir a tela de mapeamento de colunas.

// Detecta o separador olhando a 1ª linha (fora de aspas): ";" vence ","
// quando aparece mais vezes (padrão brasileiro do Excel).
function detectSep(firstLine) {
  const semis = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  if (tabs > semis && tabs > commas) return '\t'
  return semis > commas ? ';' : ','
}

// Faz o parse de um texto CSV em uma matriz de linhas (arrays de células).
// Respeita aspas duplas e o escape "" dentro de campo entre aspas.
export function parseCsvRows(text) {
  const clean = String(text || '').replace(/^﻿/, '') // remove BOM
  const firstLine = clean.split(/\r?\n/)[0] || ''
  const sep = detectSep(firstLine)
  const rows = []
  let field = ''
  let row = []
  let inQ = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQ) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') {
      inQ = true
    } else if (c === sep) {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = '' }
      if (c === '\r' && clean[i + 1] === '\n') i++
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Faz o parse com a 1ª linha como cabeçalho. Retorna { headers, rows } onde
// `headers` são os títulos originais (trim) e `rows` são objetos indexados pelo
// título. Descarta linhas totalmente vazias.
export function parseCsv(text) {
  const raw = parseCsvRows(text)
  if (!raw.length) return { headers: [], rows: [] }
  const headers = raw[0].map((h) => String(h || '').trim())
  const rows = raw.slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])))
  return { headers, rows }
}

// Retrocompatível: parse com cabeçalho em minúsculas (usado pela Equipe).
export function parseCsvLower(text) {
  const raw = parseCsvRows(text)
  if (!raw.length) return []
  const header = raw[0].map((h) => String(h || '').trim().toLowerCase())
  return raw.slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, String(r[i] ?? '').trim()])))
}

// Gera e baixa um CSV-modelo a partir de uma lista de nomes de coluna e (opcional)
// uma linha de exemplo. UTF-8 com BOM para abrir certinho no Excel PT-BR.
export function downloadCsvTemplate(filename, columns, example = {}) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.join(';')
  const sample = columns.map((c) => esc(example[c] ?? '')).join(';')
  const csv = ['﻿' + header, sample].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Sugere automaticamente um mapeamento coluna-do-arquivo -> campo-do-sistema,
// casando por similaridade de nome (ignora acentos/caixa/pontuação).
const norm = (s) => String(s || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '')

export function autoMap(fileHeaders, targetFields) {
  const map = {}
  const used = new Set()
  targetFields.forEach((f) => {
    const cands = [f.key, f.label, ...(f.aliases || [])].map(norm)
    const hit = fileHeaders.find((h) => !used.has(h) && cands.includes(norm(h)))
    if (hit) { map[f.key] = hit; used.add(hit) }
    else map[f.key] = ''
  })
  return map
}
