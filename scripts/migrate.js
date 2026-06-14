#!/usr/bin/env node

/**
 * Migration Tool - Seravie Experiences
 * Uso: node scripts/migrate.js up
 *      node scripts/migrate.js down
 *      node scripts/migrate.js create <name>
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'

const MIGRATIONS_DIR = 'supabase/migrations'
const MIGRATIONS_LOG = 'supabase/.migrations.json'

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getMigrationsLog() {
  ensureDir(MIGRATIONS_DIR)
  if (!fs.existsSync(MIGRATIONS_LOG)) {
    fs.writeFileSync(MIGRATIONS_LOG, JSON.stringify({ executed: [] }, null, 2))
  }
  return JSON.parse(fs.readFileSync(MIGRATIONS_LOG, 'utf-8'))
}

function saveMigrationsLog(log) {
  fs.writeFileSync(MIGRATIONS_LOG, JSON.stringify(log, null, 2))
}

function create(name) {
  console.log(`📝 Criando migration: ${name}`)

  const timestamp = Date.now()
  const filename = `${timestamp}_${name}.sql`
  const filepath = path.join(MIGRATIONS_DIR, filename)

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Write your SQL here
-- BEGIN TRANSACTION;

-- ROLLBACK;
-- COMMIT;
`

  ensureDir(MIGRATIONS_DIR)
  fs.writeFileSync(filepath, template)

  console.log(`✅ Migration criada: ${filepath}`)
}

function list() {
  ensureDir(MIGRATIONS_DIR)
  const files = fs.readdirSync(MIGRATIONS_DIR).sort()
  const log = getMigrationsLog()

  console.log('\n📋 Migrations disponíveis:\n')

  files.forEach(file => {
    const executed = log.executed.includes(file)
    const status = executed ? '✅' : '⏳'
    console.log(`${status} ${file}`)
  })

  console.log('')
}

function up() {
  console.log('🚀 Executando migrations pendentes...')

  ensureDir(MIGRATIONS_DIR)
  const files = fs.readdirSync(MIGRATIONS_DIR).sort()
  const log = getMigrationsLog()

  const pending = files.filter(f => !log.executed.includes(f))

  if (pending.length === 0) {
    console.log('✅ Todas as migrations já foram executadas')
    return
  }

  pending.forEach(file => {
    const filepath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(filepath, 'utf-8')

    console.log(`⬆️ ${file}`)

    // Aqui você executaria o SQL no banco
    // await supabase.rpc('execute_sql', { sql })

    log.executed.push(file)
  })

  saveMigrationsLog(log)
  console.log(`\n✅ ${pending.length} migrations executadas`)
}

function down() {
  console.log('⚠️ Revertendo última migration...')

  const log = getMigrationsLog()

  if (log.executed.length === 0) {
    console.log('❌ Nenhuma migration para reverter')
    return
  }

  const last = log.executed.pop()
  console.log(`↩️ Revertendo: ${last}`)

  saveMigrationsLog(log)
  console.log('✅ Migration revertida')
}

const command = process.argv[2]

switch (command) {
  case 'create':
    create(process.argv[3] || 'unnamed')
    break
  case 'list':
    list()
    break
  case 'up':
    up()
    break
  case 'down':
    down()
    break
  default:
    console.log(`
📚 Seravie Migrations

Uso:
  node scripts/migrate.js create <name>  - Criar nova migration
  node scripts/migrate.js list          - Listar migrations
  node scripts/migrate.js up            - Executar migrations
  node scripts/migrate.js down          - Reverter última migration

Exemplo:
  node scripts/migrate.js create add_user_table
    `)
}
