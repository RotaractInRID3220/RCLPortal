// Typed query layer. It wraps the SAME pg pool as db.mjs, so pool size, statement timeout and the
// int8 -> number parser apply to Drizzle queries too. Transactions, advisory locks, FOR UPDATE and
// LISTEN/NOTIFY stay in raw SQL (query/tx from ../db.mjs); use `sql` from drizzle-orm for fragments.
import { drizzle } from 'drizzle-orm/node-postgres'
import { getPool } from '../db.mjs'
import * as schema from './schema.mjs'

export { schema }

export function getDb() {
  return (globalThis.__rclDrizzle ??= drizzle({ client: getPool(), schema }))
}

/** Run `fn(tx)` in a Drizzle transaction (same BEGIN/COMMIT semantics as tx() in db.mjs). */
export function dbTx(fn) {
  return getDb().transaction(fn)
}
