// Versioned snapshots: a derived read model stored in `snapshots` (key, version, data, data_hash).
//   * `version` only moves when the content changed (data_hash differs), so it is a perfect ETag.
//   * `source_version` is the data_versions counter the snapshot was built from; the counter is
//     bumped by triggers inside the writing transaction, so "source_version < counter" == stale.
//   * `computed_at` is the last time the snapshot was verified/rebuilt (touched even when unchanged).
//   * builds are single-flight: one session-level advisory lock per family; waiters re-check and
//     find the work already done.
import { createHash } from 'node:crypto'
import { getPool, query } from '../db.mjs'

export const hashData = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex')

/**
 * Read one snapshot together with the current counter and its age (DB clock).
 * `path` (array of keys) extracts a sub-document in SQL instead of shipping the whole snapshot.
 */
export async function readSnapshot(key, { family = 'leaderboard', path = null, db = { query } } = {}) {
  const dataExpr = path ? 's.data #> $3::text[]' : 's.data'
  const params = path ? [key, family, path.map(String)] : [key, family]
  const { rows } = await db.query(
    `SELECT s.version, ${dataExpr} AS data, s.computed_at, s.source_version, dv.version AS current_version,
            (extract(epoch FROM now() - s.computed_at) * 1000)::bigint AS age_ms
     FROM snapshots s JOIN data_versions dv ON dv.key = $2 WHERE s.key = $1`, params)
  return rows[0] ?? null
}

export const isFresh = (row, maxAgeMs) =>
  Boolean(row) && row.source_version >= row.current_version && row.age_ms < maxAgeMs

/** Insert/update one snapshot inside the caller's transaction. Version bumps only on change. */
export async function writeIfChanged(c, key, data, sourceVersion) {
  const hash = hashData(data)
  const { rows } = await c.query('SELECT version, data_hash FROM snapshots WHERE key = $1 FOR UPDATE', [key])
  if (!rows.length) {
    await c.query(
      'INSERT INTO snapshots (key, version, data, data_hash, source_version) VALUES ($1, 1, $2::jsonb, $3, $4)',
      [key, JSON.stringify(data), hash, sourceVersion])
    return { key, version: 1, changed: true }
  }
  if (rows[0].data_hash === hash) {
    await c.query('UPDATE snapshots SET computed_at = now(), source_version = GREATEST(source_version, $2) WHERE key = $1', [key, sourceVersion])
    return { key, version: rows[0].version, changed: false }
  }
  const version = rows[0].version + 1
  await c.query(
    'UPDATE snapshots SET version = $2, data = $3::jsonb, data_hash = $4, computed_at = now(), source_version = $5 WHERE key = $1',
    [key, version, JSON.stringify(data), hash, sourceVersion])
  return { key, version, changed: true }
}

const lockId = (family) => 4_206_000 + [...family].reduce((a, ch) => (a + ch.charCodeAt(0)) % 997, 0)

/**
 * Rebuild a snapshot family if it is stale (counter moved or older than maxAgeMs), or always with
 * `force`. `compute(client)` returns { [snapshotKey]: data } and runs in ONE repeatable-read
 * transaction, so the snapshots of a family are mutually consistent.
 * @returns {{built: boolean, results: Array<{key, version, changed}>}}
 */
export async function rebuildFamily({ family = 'leaderboard', primaryKey, compute, maxAgeMs = 0, force = false }) {
  const client = await getPool().connect()
  let locked = false
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockId(family)]) // single flight (session level, before BEGIN)
    locked = true
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    try {
      const { rows: [dv] } = await client.query('SELECT version FROM data_versions WHERE key = $1', [family])
      if (!force) {
        const cur = await readSnapshot(primaryKey, { family, db: client })
        if (cur && cur.source_version >= dv.version && cur.age_ms < maxAgeMs) {
          await client.query('COMMIT')
          return { built: false, results: [] }
        }
      }
      const out = await compute(client)
      const results = []
      for (const [key, data] of Object.entries(out)) results.push(await writeIfChanged(client, key, data, dv.version))
      await client.query('COMMIT')
      return { built: true, results }
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection gone */ }
      throw err
    }
  } finally {
    if (locked) { try { await client.query('SELECT pg_advisory_unlock($1)', [lockId(family)]) } catch { /* released with the session */ } }
    client.release()
  }
}

/** ETag helpers: strong ETag built from the snapshot version plus the request variant. */
export const makeEtag = (...parts) => `"${parts.join('-')}"`
export function etagMatches(request, etag) {
  const inm = request.headers.get('if-none-match')
  if (!inm) return false
  return inm.split(',').map((s) => s.trim().replace(/^W\//, '')).some((t) => t === etag || t === '*')
}
