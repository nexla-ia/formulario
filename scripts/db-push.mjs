/**
 * Aplica supabase/schema.sql no banco.
 *   npm run db:push
 * Lê DATABASE_URL de .env.local (ou da variável de ambiente).
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function envFromFile() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return {}
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
}

const url = process.env.DATABASE_URL || envFromFile().DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL (põe em .env.local).')
  process.exit(1)
}

const file = process.argv[2] ?? resolve(root, 'supabase/schema.sql')
const sql = readFileSync(file, 'utf8')

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  const t = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1",
  )
  const f = await client.query(
    "select routine_name from information_schema.routines where routine_schema='public' order by 1",
  )
  console.log('✓ schema aplicado')
  console.log('  tabelas:', t.rows.map((r) => r.table_name).join(', ') || '—')
  console.log('  funções:', f.rows.map((r) => r.routine_name).join(', ') || '—')
} catch (e) {
  console.error('✗ falhou:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
