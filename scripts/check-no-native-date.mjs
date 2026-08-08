#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// REGRA DO PROJETO (permanente): TODO calendário/date picker usa GlassDate
// (glassmorphism). É PROIBIDO usar <input type="date"> ou type="datetime-local">
// nativos — o popup nativo é desenhado pelo SO e não pode ser estilizado.
//
// Este script varre src/ e FALHA (exit 1) se encontrar um input de data nativo,
// para que o erro seja pego no build/CI em vez de passar despercebido.
//
// Uso: node scripts/check-no-native-date.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname
const BAD = /type\s*=\s*(["'`])(date|datetime-local)\1/g
const offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { walk(p); continue }
    if (!['.jsx', '.tsx', '.js', '.ts'].includes(extname(p))) continue
    const src = readFileSync(p, 'utf8')
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      // ignora comentários explicativos (linhas iniciadas por * ou //)
      const trimmed = line.trim()
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
      BAD.lastIndex = 0
      if (BAD.test(line)) offenders.push(`${p}:${i + 1}  ${trimmed.slice(0, 120)}`)
    })
  }
}

walk(ROOT)

if (offenders.length) {
  console.error('\n✗ Calendário nativo proibido encontrado (use <GlassDate/> — glassmorphism):\n')
  offenders.forEach((o) => console.error('  ' + o))
  console.error('\nSubstitua por: import { GlassDate } from ".../ui"  →  <GlassDate value={v} onChange={setV} /> (adicione withTime para data+hora).\n')
  process.exit(1)
}
console.log('✓ Nenhum calendário nativo. Todos os date pickers usam GlassDate (glassmorphism).')
