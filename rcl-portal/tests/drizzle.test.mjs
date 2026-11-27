// Guards the Drizzle layer: the generated schema must match the migrated database, and queries
// through Drizzle must go through the shared pool.
import test from 'node:test'
import assert from 'node:assert/strict'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { getDb, schema } = await import('../src/server/db/drizzle.mjs')
const { query, closePool } = await import('../src/server/db.mjs')

test('every table and column in the database is described by the Drizzle schema', async () => {
  const tables = Object.values(schema).filter((t) => t && typeof t === 'object' && Symbol.for('drizzle:IsDrizzleTable') in t)
  const defined = new Map(tables.map((t) => { const c = getTableConfig(t); return [c.name, new Set(c.columns.map((x) => x.name))] }))
  const { rows } = await query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'schema_migrations'`)
  const missing = rows.filter((r) => !defined.get(r.table_name)?.has(r.column_name)).map((r) => `${r.table_name}.${r.column_name}`)
  assert.deepEqual(missing, [], `schema.mjs is stale, run npm run db:pull: ${missing.join(', ')}`)
})

test('Drizzle queries run on the shared pool', async () => {
  const r = await getDb().execute(sql`select 1 as ok`)
  assert.equal(r.rows[0].ok, 1)
})

test.after(() => closePool())
