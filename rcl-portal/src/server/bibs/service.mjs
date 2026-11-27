// Bib numbers: one per player, for players registered in an event that needs a bib
// (events.bib_required: track events, swimming, road race). Assigned by an admin with one button
// ("assign missing numbers"); a number never changes and is never reused. When a player is
// replaced or swapped out of every bib event, their number is handed to the player who takes over.
import { query, tx } from '../db.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_KEY = 4_20_001                                   // advisory lock: one assignment/transfer at a time

export const formatBib = (n) => (n == null ? null : String(n).padStart(3, '0'))

/** Players with at least one registration in a bib event. */
const NEEDS_SQL = `EXISTS (SELECT 1 FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = p.member_id AND e.bib_required)`

export async function bibStatus(db = { query }) {
  const { rows: [r] } = await db.query(
    `SELECT (SELECT count(*)::int FROM bib_numbers) AS assigned,
            (SELECT count(*)::int FROM players p WHERE ${NEEDS_SQL} AND NOT EXISTS (SELECT 1 FROM bib_numbers b WHERE b.member_id = p.member_id)) AS missing,
            (SELECT count(*)::int FROM players p JOIN bib_numbers b USING (member_id) WHERE NOT ${NEEDS_SQL}) AS unused,
            (SELECT coalesce(max(bib_number), 0) + 1 FROM bib_numbers) AS next_number,
            (SELECT count(*)::int FROM events WHERE bib_required) AS bib_events`)
  return { ...r, next_display: formatBib(r.next_number) }
}

/** Give every player who needs a number and has none the next free number (never reusing old ones). Idempotent. */
export async function assignMissingBibs({ actor }) {
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    const { rows: need } = await c.query(
      `SELECT p.member_id FROM players p LEFT JOIN clubs cl USING (club_id)
       WHERE ${NEEDS_SQL} AND NOT EXISTS (SELECT 1 FROM bib_numbers b WHERE b.member_id = p.member_id)
       ORDER BY cl.club_name, p.name, p.member_id`)
    if (!need.length) return { ok: true, assigned: 0, first: null, last: null }
    const { rows: [{ start }] } = await c.query('SELECT coalesce(max(bib_number), 0) AS start FROM bib_numbers')
    if (Number(start) + need.length > 9999) return fail(409, 'bib_range_exhausted', 'There are not enough bib numbers left (maximum 9999).')
    const ids = need.map((n) => n.member_id)
    const nums = ids.map((_, i) => Number(start) + i + 1)
    await c.query(
      `INSERT INTO bib_numbers (bib_number, member_id, assigned_by) SELECT n, m, $3 FROM unnest($1::int[], $2::int[]) AS t(n, m)`,
      [nums, ids, actor.member_id])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)',
      [actor.member_id, 'bib.assign', 'bib', String(nums[0]), JSON.stringify({ count: ids.length, first: nums[0], last: nums.at(-1) })])
    return { ok: true, assigned: ids.length, first: formatBib(nums[0]), last: formatBib(nums.at(-1)) }
  })
}

/**
 * Inside the caller's transaction, after registrations changed for `memberIds` (replacement or swap):
 * a player who now has a number but no bib event left hands the number to a player (from the same
 * list) who now needs one and has none. Pairs in list order. Returns the transfers made.
 */
export async function handBibsOver(c, memberIds) {
  const ids = [...new Set(memberIds.filter(Boolean))]
  if (ids.length < 2) return []
  await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
  const { rows } = await c.query(
    `SELECT p.member_id,
            (SELECT bib_number FROM bib_numbers b WHERE b.member_id = p.member_id) AS bib,
            ${NEEDS_SQL} AS needs
     FROM players p WHERE p.member_id = ANY($1)`, [ids])
  const byId = new Map(rows.map((r) => [r.member_id, r]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean)
  const givers = ordered.filter((r) => r.bib != null && !r.needs)
  const takers = ordered.filter((r) => r.bib == null && r.needs)
  const done = []
  for (let i = 0; i < Math.min(givers.length, takers.length); i++) {
    await c.query('UPDATE bib_numbers SET member_id = $2, transferred_from = $3, transferred_at = now() WHERE bib_number = $1', [givers[i].bib, takers[i].member_id, givers[i].member_id])
    done.push({ bib: givers[i].bib, from: givers[i].member_id, to: takers[i].member_id })
  }
  return done
}

/** Players holding a number, or needing one. filter: all | assigned | missing | unused. */
export async function listBibs({ filter = 'all', search = '', page = 1, limit = 25, all = false } = {}) {
  const term = String(search ?? '').trim()
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`
  const where = `(b.member_id IS NOT NULL OR ${NEEDS_SQL})
    AND ($1 = 'all' OR ($1 = 'assigned' AND b.member_id IS NOT NULL) OR ($1 = 'missing' AND b.member_id IS NULL)
         OR ($1 = 'unused' AND b.member_id IS NOT NULL AND NOT ${NEEDS_SQL}))
    AND ($2 = '' OR p.name ILIKE $3 OR p.membership_id ILIKE $3 OR cl.club_name ILIKE $3 OR b.bib_number::text = $2 OR lpad(b.bib_number::text, 3, '0') = $2)`
  const base = `FROM players p LEFT JOIN bib_numbers b USING (member_id) LEFT JOIN clubs cl ON cl.club_id = p.club_id WHERE ${where}`
  const params = [filter, term, like]
  const sel = `SELECT p.member_id, p.membership_id, p.name, p.club_id, cl.club_name, b.bib_number, b.assigned_at, b.transferred_from,
      (${NEEDS_SQL}) AS in_bib_event,
      (SELECT coalesce(json_agg(e.sport_name ORDER BY e.sport_day, e.sport_name), '[]') FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = p.member_id AND e.bib_required) AS events
    ${base} ORDER BY b.bib_number NULLS LAST, cl.club_name, p.name, p.member_id`
  const [{ rows }, { rows: [cnt] }] = await Promise.all([
    all ? query(sel, params) : query(`${sel} LIMIT $4 OFFSET $5`, [...params, limit, (page - 1) * limit]),
    query(`SELECT count(*)::int AS n ${base}`, params),
  ])
  return { rows: rows.map((r) => ({ ...r, bib: formatBib(r.bib_number) })), total: cnt.n }
}

export async function getBibForMember(memberId, db = { query }) {
  const { rows: [r] } = await db.query('SELECT bib_number FROM bib_numbers WHERE member_id = $1', [memberId])
  return r ? formatBib(r.bib_number) : null
}
