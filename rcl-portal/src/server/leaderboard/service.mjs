// Leaderboard read model + the admin manual-points writes.
//   snapshot 'leaderboard:all'   : every club with total, entry count, rank (ties share a rank),
//                                  rank inside its category and the total per points kind
//   snapshot 'leaderboard:clubs' : { "<club_id>": details with the full per-entry breakdown }
// Totals include EVERY kind (placement, participation, track, manual and the one penalty row), so a
// penalty applied by the admin shows up automatically. Public reads never touch club_points.
import { query, tx } from '../db.mjs'
import { isFresh, makeEtag, readSnapshot, rebuildFamily } from './snapshots.mjs'

export const FAMILY = 'leaderboard'
export const KEY_ALL = 'leaderboard:all'
export const KEY_CLUBS = 'leaderboard:clubs'
export const KINDS = ['placement', 'participation', 'track', 'penalty', 'manual']
/** Safety net only (the counter is the real freshness check); the worker re-verifies every ~60 s. */
export const maxAgeMs = () => Number(process.env.LEADERBOARD_MAX_AGE_MS || 180_000)

const fail = (status, code, message) => ({ ok: false, status, code, message })

// ------------------------------------------------------------------ build
const TOTALS_SQL = `
  WITH t AS (
    SELECT c.club_id, c.club_name, c.category,
           COALESCE(sum(p.points), 0)::int AS total_points,
           count(p.point_id)::int AS entries_count,
           ${KINDS.map((k) => `COALESCE(sum(p.points) FILTER (WHERE p.kind = '${k}'), 0)::int AS k_${k}`).join(',\n           ')}
    FROM clubs c LEFT JOIN club_points p ON p.club_id = c.club_id
    WHERE c.status = 1 OR EXISTS (SELECT 1 FROM club_points x WHERE x.club_id = c.club_id)
    GROUP BY c.club_id, c.club_name, c.category)
  SELECT t.*,
         rank() OVER (ORDER BY total_points DESC)::int AS rank,
         rank() OVER (PARTITION BY category ORDER BY total_points DESC)::int AS category_rank
  FROM t ORDER BY total_points DESC, club_name, club_id`

const ENTRIES_SQL = `
  SELECT p.point_id, p.club_id, p.sport_id, p.kind, p.points, p.place, p.note,
         e.sport_name, e.category AS sport_category, e.gender_type, e.sport_type
  FROM club_points p LEFT JOIN events e ON e.sport_id = p.sport_id
  ORDER BY p.club_id, p.points DESC, p.point_id`

export async function computeLeaderboard(c) {
  const { rows: clubs } = await c.query(TOTALS_SQL)
  const { rows: entries } = await c.query(ENTRIES_SQL)

  const all = clubs.map((r) => ({
    club_id: r.club_id, club_name: r.club_name, category: r.category,
    total_points: r.total_points, entries_count: r.entries_count,
    rank: r.rank, category_rank: r.category_rank,
    points_by_kind: Object.fromEntries(KINDS.map((k) => [k, r[`k_${k}`]])),
  }))

  const byClub = new Map()
  for (const e of entries) {
    if (!byClub.has(e.club_id)) byClub.set(e.club_id, [])
    byClub.get(e.club_id).push({
      point_id: e.point_id, sport_id: e.sport_id, kind: e.kind, points: e.points, place: e.place, note: e.note,
      sport: e.sport_id == null ? null : { sport_name: e.sport_name, category: e.sport_category, gender_type: e.gender_type, sport_type: e.sport_type },
    })
  }
  const details = {}
  for (const club of all) {
    const raw = byClub.get(club.club_id) ?? []
    const groups = new Map()
    for (const e of raw) {
      const g = groups.get(e.sport_id) ?? { sport_id: e.sport_id, sport_info: e.sport, entries: [], total_points: 0 }
      g.entries.push({ point_id: e.point_id, kind: e.kind, points: e.points, place: e.place, note: e.note })
      g.total_points += e.points
      groups.set(e.sport_id, g)
    }
    const sports_breakdown = [...groups.values()]
      .map((g) => ({ ...g, entries_count: g.entries.length }))
      .sort((a, b) => b.total_points - a.total_points || (a.sport_id ?? 0) - (b.sport_id ?? 0))
    details[club.club_id] = {
      club: { club_id: club.club_id, club_name: club.club_name, category: club.category },
      summary: { total_points: club.total_points, total_entries: raw.length, sports_count: sports_breakdown.filter((g) => g.sport_id != null).length, rank: club.rank, category_rank: club.category_rank, points_by_kind: club.points_by_kind },
      sports_breakdown,
      raw_entries: raw,
    }
  }
  return { [KEY_ALL]: { clubs: all }, [KEY_CLUBS]: details }
}

/** Rebuild if stale (or `force`). Safe to call from anywhere, concurrently; returns what happened. */
export const rebuildLeaderboard = ({ force = false, maxAge = maxAgeMs() } = {}) =>
  rebuildFamily({ family: FAMILY, primaryKey: KEY_ALL, compute: computeLeaderboard, maxAgeMs: maxAge, force })

/** Latest snapshot, rebuilt inline first when it is stale. Never returns old data. */
export async function readFresh(key, { path = null } = {}) {
  let row = await readSnapshot(key, { family: FAMILY, path })
  if (!isFresh(row, maxAgeMs())) {
    await rebuildLeaderboard()
    row = await readSnapshot(key, { family: FAMILY, path })
  }
  return row
}

// ------------------------------------------------------------------ public reads
const CATEGORY_ALIASES = { community: 'community', institute: 'institute', university: 'institute' }
export const normaliseCategory = (v) => (v == null || v === '' ? null : CATEGORY_ALIASES[String(v).toLowerCase()] ?? undefined)

/** @returns {{ok:true, version, generatedAt, etag, body}|{ok:false,...}} */
export async function getAggregated({ category, limit, offset = 0 }) {
  const cat = normaliseCategory(category)
  if (cat === undefined) return fail(400, 'invalid_request', 'category must be community or institute.')
  const row = await readFresh(KEY_ALL)
  let clubs = row.data.clubs
  if (cat) clubs = clubs.filter((c) => c.category === cat).map((c) => ({ ...c, rank: c.category_rank }))
  const total = clubs.length
  const page = limit ? clubs.slice(offset, offset + limit) : clubs.slice(offset)
  return {
    ok: true, version: row.version, generatedAt: row.computed_at,
    etag: makeEtag('lb-all', row.version, cat ?? 'all', limit ?? 'x', offset),
    body: {
      success: true, data: page, total,
      pagination: { limit: limit ?? null, offset, hasMore: limit ? offset + limit < total : false },
      version: row.version, generated_at: row.computed_at,
    },
  }
}

export async function getClubDetails(clubId) {
  const row = await readFresh(KEY_CLUBS, { path: [clubId] })
  if (!row.data) return fail(404, 'club_not_found', 'Club not found')
  return {
    ok: true, version: row.version, generatedAt: row.computed_at,
    etag: makeEtag('lb-club', row.version, clubId),
    body: { success: true, data: row.data, version: row.version, generated_at: row.computed_at },
  }
}

// ------------------------------------------------------------------ admin list + manual writes
const POINT_COLS = `p.point_id, p.club_id, p.sport_id, p.kind, p.points, p.place, p.note,
  json_build_object('club_name', c.club_name, 'category', c.category) AS clubs`

/** Live rows for the admin per-sport screen (not a snapshot: an admin must see their write at once). */
export async function listPoints({ sportId, clubId, category, limit, offset = 0 }) {
  const cap = Math.min(limit ?? 1000, 1000)
  const { rows } = await query(
    `SELECT ${POINT_COLS}, count(*) OVER ()::int AS total_count
     FROM club_points p JOIN clubs c ON c.club_id = p.club_id
     WHERE ($1::int IS NULL OR p.sport_id = $1) AND ($2::int IS NULL OR p.club_id = $2) AND ($3::text IS NULL OR c.category = $3)
     ORDER BY p.points DESC, p.point_id LIMIT $4 OFFSET $5`,
    [sportId ?? null, clubId ?? null, category ?? null, cap, offset])
  const total = rows[0]?.total_count ?? 0
  return { data: rows.map(({ total_count, ...r }) => r), total, limit: limit ?? null, offset }
}

/** Admin manual entry (kind='manual'): any non-zero integer, optionally tied to a sport. */
export async function addManualPoints({ actor, clubId, sportId = null, points, place = null, note = null }) {
  try {
    return await tx(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO club_points (club_id, sport_id, kind, points, place, note, created_by)
         VALUES ($1, $2, 'manual', $3, $4, $5, $6) RETURNING point_id`,
        [clubId, sportId, points, place, note, actor.member_id])
      const id = rows[0].point_id
      await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
        [actor.member_id, 'club_points.manual_add', 'club_points', String(id), JSON.stringify({ clubId, sportId, points, place, note })])
      const { rows: [row] } = await c.query(`SELECT ${POINT_COLS} FROM club_points p JOIN clubs c ON c.club_id = p.club_id WHERE p.point_id = $1`, [id])
      return { ok: true, row }
    })
  } catch (err) {
    if (err.code === '23503') return fail(404, 'not_found', err.constraint?.includes('sport') ? 'Sport not found.' : 'Club not found.')
    throw err
  }
}

/** Only manual rows are deleted here; the automatic kinds are corrected by re-running their award. */
export async function deleteManualPoints({ actor, pointId }) {
  return tx(async (c) => {
    const { rows } = await c.query('SELECT point_id, club_id, sport_id, kind, points FROM club_points WHERE point_id = $1 FOR UPDATE', [pointId])
    if (!rows.length) return fail(404, 'not_found', 'Club point entry not found')
    if (rows[0].kind !== 'manual') return fail(409, 'not_manual', `A ${rows[0].kind} entry cannot be deleted here; re-run its award or penalty instead.`)
    await c.query('DELETE FROM club_points WHERE point_id = $1', [pointId])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'club_points.manual_delete', 'club_points', String(pointId), JSON.stringify(rows[0])])
    return { ok: true }
  })
}
