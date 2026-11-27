// Server-only Postgres access. One pool per process (kept on globalThis so Next.js dev reloads
// don't leak pools). The browser never talks to the database.
import pg from 'pg'

// bigint (int8) -> number. Our ids/counts never approach 2^53.
pg.types.setTypeParser(20, (v) => Number(v))

function makePool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15_000),
  })
  pool.on('error', (err) => console.error('[db] idle client error:', err.message))
  return pool
}

export function getPool() {
  return (globalThis.__rclPool ??= makePool())
}

/** Run one parameterised statement. */
export function query(text, params) {
  return getPool().query(text, params)
}

/** Run `fn(client)` inside a transaction. Rolls back and rethrows on any error. */
export async function tx(fn) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try { await client.query('ROLLBACK') } catch { /* connection already gone */ }
    throw err
  } finally {
    client.release()
  }
}

export async function closePool() {
  if (globalThis.__rclPool) {
    await globalThis.__rclPool.end()
    globalThis.__rclPool = undefined
  }
}
