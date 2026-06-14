#!/usr/bin/env node

/**
 * Script de Backup - Seravie Experiences
 * Uso: node scripts/backup.js
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function backup() {
  console.log('🔄 Iniciando backup...')

  const timestamp = new Date().toISOString().replace(/:/g, '-')
  const backupDir = `backups/backup-${timestamp}`

  // Criar diretório
  if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups', { recursive: true })
  }
  fs.mkdirSync(backupDir, { recursive: true })

  const tables = [
    'specialties',
    'portfolio_items',
    'sections',
    'contact_submissions',
    'users',
  ]

  for (const table of tables) {
    console.log(`📦 Fazendo backup de ${table}...`)

    const { data, error } = await supabase.from(table).select('*')

    if (error) {
      console.error(`❌ Erro ao fazer backup de ${table}:`, error)
      continue
    }

    const filename = path.join(backupDir, `${table}.json`)
    fs.writeFileSync(filename, JSON.stringify(data, null, 2))

    console.log(`✓ ${table}: ${data.length} registros`)
  }

  console.log(`\n✅ Backup concluído em: ${backupDir}`)
  return backupDir
}

async function restore(backupPath) {
  console.log(`🔄 Restaurando de ${backupPath}...`)

  const tables = fs.readdirSync(backupPath)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))

  for (const table of tables) {
    const filePath = path.join(backupPath, `${table}.json`)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    console.log(`📦 Restaurando ${table}...`)

    // Limpar tabela
    await supabase.from(table).delete().neq('id', '')

    // Restaurar dados
    for (const record of data) {
      await supabase.from(table).insert([record])
    }

    console.log(`✓ ${table}: ${data.length} registros restaurados`)
  }

  console.log('\n✅ Restauração concluída')
}

const command = process.argv[2]

if (command === 'restore' && process.argv[3]) {
  restore(process.argv[3])
} else {
  backup()
}
