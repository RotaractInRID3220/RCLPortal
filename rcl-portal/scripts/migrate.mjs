#!/usr/bin/env node
// Minimal forward-only migration runner.
//   node scripts/migrate.mjs            apply pending migrations in db/migrations
//   node scripts/migrate.mjs --seed     also apply db/seed/*.sql afterwards
//   node scripts/migrate.mjs --mock     DEV ONLY: also add sample events (db/dev/mock_events.sql)
//   node scripts/migrate.mjs --status   list applied/pending
// Uses DATABASE_MIGRATOR_URL (DDL rights); falls back to DATABASE_DIRECT_URL.
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'
import { loadEnv } from './load-env.mjs'

loadEnv()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'db')
const url = process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_DIRECT_URL
if (!url) {
  console.error('DATABASE_MIGRATOR_URL (or DATABASE_DIRECT_URL) is not set')
  process.exit(1)
}
const args = new Set(process.argv.slice(2))
const sha = (s) => createHash('sha256').update(s).digest('hex')

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`)
  const applied = new Map((await client.query('SELECT name, checksum FROM schema_migrations')).rows.map((r) => [r.name, r.checksum]))
  const files = readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort()

  if (args.has('--status')) {
    for (const f of files) console.log(`${applied.has(f) ? 'applied ' : 'PENDING '} ${f}`)
    process.exit(0)
  }

  for (const f of files) {
    const sql = readFileSync(path.join(root, 'migrations', f), 'utf8')
    if (applied.has(f)) {
      if (applied.get(f) !== sha(sql)) throw new Error(`Migration ${f} was changed after it was applied`)
      continue
    }
    console.log(`applying ${f}`)
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [f, sha(sql)])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw new Error(`Migration ${f} failed: ${e.message}`)
    }
  }
  await client.query(readFileSync(path.join(root, 'grants.sql'), 'utf8'))
  console.log('grants applied')
  if (args.has('--seed')) {
    for (const f of readdirSync(path.join(root, 'seed')).filter((x) => x.endsWith('.sql')).sort()) {
      await client.query(readFileSync(path.join(root, 'seed', f), 'utf8'))
      console.log(`seeded ${f}`)
    }
  }
  if (args.has('--mock')) {
    if (process.env.NODE_ENV === 'production') throw new Error('--mock is for development only')
    await client.query(readFileSync(path.join(root, 'dev', 'mock_events.sql'), 'utf8'))
    console.log('added mock events')
  }
  console.log('done')
} finally {
  await client.end()
}
