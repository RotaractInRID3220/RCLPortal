// Track events (trackIndividual / trackTeam). Admins record the finishing position (and the time
// as text) of every entry; awarding turns positions into club points.
//
// Points (all settings, none hard-coded):
//   individual event: place 1-3 -> points.track_individual[place-1]
//   team event:       place 1-3 -> points.track_team[place-1]
//   any other place   -> points.track_participation
// A club may have several entries in one event (individual events): its points are summed into ONE
// club_points row (kind='track', unique per club + sport), best place kept. Awarding again replaces
// that event's track rows (clubs that no longer score are removed), so it never duplicates.
//
// Decision (participation): src/server/participation/service.mjs only covers team/individual
// sports, never track types, so track participation points are NOT duplicated there; they live in
// the track rows here (points.track_participation). The road race is a normal 'individual' event
// on D-05 and is out of scope for this module.
//
// Places come from the admin's explicit ordering (the old award re-derived them from the score
// text and ignored the saved places). Ties are not supported: a place is unique per event.
import { query, tx } from '../db.mjs'
import { validateSetting } from '../settings/registry.mjs'
import { hasPermission } from '../auth/permissions.mjs'

export const TRACK_TYPES = ['trackIndividual', 'trackTeam']
const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_BASE = 4_206_000_000
const audit = (c, actor, action, id, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)', [actor.member_id, action, 'track_events', String(id), JSON.stringify(detail)])

// 12.34 | 1:02.5 | 1:02:03.4  (lower is better; stored as typed, only checked for shape)
export const SCORE_RE = /^(\d{1,6}(\.\d{1,3})?|\d{1,3}:[0-5]?\d(\.\d{1,3})?|\d{1,3}:[0-5]\d:[0-5]\d(\.\d{1,3})?)$/

async function getSport(sportId, db = { query }) {
  const { rows: [s] } = await db.query('SELECT * FROM events WHERE sport_id = $1', [sportId])
  if (!s) return { error: fail(404, 'sport_not_found', 'Sport not found.') }
  if (!TRACK_TYPES.includes(s.sport_type)) return { error: fail(400, 'not_track_event', 'Sport is not a track event.') }
  return { sport: s }
}

/** Entries of one event with their saved result. `viewer: 'admin'` also returns member ids and team players. */
export async function getEntries({ sportId, admin = false }) {
  const { sport, error } = await getSport(sportId)
  if (error) return error
  const [{ rows: [{ awarded }] }] = await Promise.all([
    query("SELECT count(*)::int AS awarded FROM club_points WHERE sport_id = $1 AND kind = 'track'", [sportId]),
  ])
  let entries, reserves = []
  if (sport.sport_type === 'trackIndividual') {
    const { rows } = await query(
      `SELECT t.id, r.member_id, p.name, r.club_id, c.club_name, r.main_player, t.score, t.place
       FROM registrations r JOIN players p USING (member_id) JOIN clubs c ON c.club_id = r.club_id
       LEFT JOIN track_events t ON t.sport_id = r.sport_id AND t.member_id = r.member_id
       WHERE r.sport_id = $1`, [sportId])
    const shape = (r) => ({ id: r.id ?? null, ...(admin ? { member_id: r.member_id } : {}), name: r.name, club_id: r.club_id, club_name: r.club_name, score: r.score ?? '', place: r.place ?? null, main_player: r.main_player })
    entries = rows.filter((r) => r.main_player).map(shape)
    reserves = admin ? rows.filter((r) => !r.main_player).map(shape) : []
    // entries that have an old result but are now reserves are kept out; they are cleaned by sync
  } else {
    const { rows } = await query(
      `SELECT t.id, tm.team_id, tm.club_id, c.club_name, t.score, t.place
       FROM teams tm JOIN clubs c USING (club_id)
       LEFT JOIN track_events t ON t.sport_id = tm.sport_id AND t.team_id = tm.team_id
       WHERE tm.sport_id = $1`, [sportId])
    let players = new Map()
    if (admin) {
      const { rows: pl } = await query('SELECT r.club_id, r.member_id, p.name FROM registrations r JOIN players p USING (member_id) WHERE r.sport_id = $1 ORDER BY p.name', [sportId])
      for (const p of pl) { if (!players.has(p.club_id)) players.set(p.club_id, []); players.get(p.club_id).push({ member_id: p.member_id, name: p.name }) }
    }
    entries = rows.map((r) => ({ id: r.id ?? null, team_id: r.team_id, club_id: r.club_id, club_name: r.club_name, score: r.score ?? '', place: r.place ?? null, ...(admin ? { players: players.get(r.club_id) ?? [] } : {}) }))
  }
  const key = (e) => (sport.sport_type === 'trackIndividual' ? e.name : e.club_name) || ''
  const sorter = (a, b) => (a.place && b.place ? a.place - b.place : a.place ? -1 : b.place ? 1 : key(a).localeCompare(key(b)))
  entries.sort(sorter); reserves.sort(sorter)
  return { ok: true, data: { sport, entries, reserves, awarded: awarded > 0 } }
}

/** Create missing entry rows from registrations/teams and drop rows whose participant is gone. */
export async function sync({ actor, sportId = null }) {
  return tx(async (c) => {
    const { rows: sports } = await c.query('SELECT sport_id, sport_type FROM events WHERE sport_type = ANY($1) AND ($2::int IS NULL OR sport_id = $2) ORDER BY sport_id', [TRACK_TYPES, sportId])
    if (sportId && !sports.length) return fail(404, 'sport_not_found', 'Track sport not found.')
    let inserted = 0, deleted = 0
    for (const s of sports) {
      await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BASE + s.sport_id])
      if (s.sport_type === 'trackIndividual') {
        const del = await c.query(`DELETE FROM track_events t WHERE t.sport_id = $1 AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.sport_id = t.sport_id AND r.member_id = t.member_id AND r.main_player)`, [s.sport_id])
        const ins = await c.query(`INSERT INTO track_events (sport_id, member_id) SELECT sport_id, member_id FROM registrations WHERE sport_id = $1 AND main_player ON CONFLICT DO NOTHING`, [s.sport_id])
        deleted += del.rowCount; inserted += ins.rowCount
      } else {
        const del = await c.query(`DELETE FROM track_events t WHERE t.sport_id = $1 AND NOT EXISTS (SELECT 1 FROM teams m WHERE m.team_id = t.team_id)`, [s.sport_id])
        const ins = await c.query(`INSERT INTO track_events (sport_id, team_id) SELECT sport_id, team_id FROM teams WHERE sport_id = $1 ON CONFLICT DO NOTHING`, [s.sport_id])
        deleted += del.rowCount; inserted += ins.rowCount
      }
    }
    await audit(c, actor, 'track.sync', sportId ?? 'all', { inserted, deleted, processed: sports.length })
    return { ok: true, inserted, deleted, processed: sports.length }
  })
}

/**
 * Save results for one event (full or partial list; unlisted entries are untouched).
 * results: [{ member_id | team_id, score?: string|null, place?: int|null }]
 * Idempotent: the same payload always leaves the same rows.
 */
export async function saveResults({ actor, sportId, results }) {
  const seenKeys = new Set(), seenPlaces = new Set()
  const clean = []
  for (const r of results) {
    const key = r.member_id != null ? `m${r.member_id}` : `t${r.team_id}`
    if ((r.member_id == null) === (r.team_id == null)) return fail(400, 'invalid_request', 'Each result needs exactly one of member_id or team_id.')
    if (seenKeys.has(key)) return fail(400, 'duplicate_entry', 'The same entry is listed twice.')
    seenKeys.add(key)
    const place = r.place ?? null
    if (place !== null) {
      if (!Number.isInteger(place) || place < 1) return fail(400, 'invalid_place', 'A position must be a whole number, 1 or more.')
      if (seenPlaces.has(place)) return fail(400, 'duplicate_place', `Position ${place} is given to more than one entry.`)
      seenPlaces.add(place)
    }
    const score = r.score == null ? null : String(r.score).trim() || null
    if (score !== null && !SCORE_RE.test(score)) return fail(400, 'invalid_score', `"${score}" is not a valid time (examples: 12.34, 1:02.5).`)
    clean.push({ member_id: r.member_id ?? null, team_id: r.team_id ?? null, score, place })
  }
  try {
    return await tx(async (c) => {
      const { sport, error } = await getSport(sportId, c)
      if (error) return error
      await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BASE + sportId])
      const individual = sport.sport_type === 'trackIndividual'
      if (clean.some((r) => (individual ? r.member_id == null : r.team_id == null))) return fail(400, 'invalid_request', individual ? 'This is an individual event: use member_id.' : 'This is a team event: use team_id.')
      const ids = clean.map((r) => (individual ? r.member_id : r.team_id))
      const { rows: valid } = individual
        ? await c.query('SELECT member_id AS id FROM registrations WHERE sport_id = $1 AND main_player AND member_id = ANY($2)', [sportId, ids])
        : await c.query('SELECT team_id AS id FROM teams WHERE sport_id = $1 AND team_id = ANY($2)', [sportId, ids])
      const ok = new Set(valid.map((v) => v.id))
      const bad = ids.find((i) => !ok.has(i))
      if (bad !== undefined) return fail(400, 'not_an_entry', `${individual ? 'Player' : 'Team'} ${bad} is not an entry of this event.`)
      // clear first: places are unique and the new order may swap them
      await c.query(`UPDATE track_events SET place = NULL WHERE sport_id = $1 AND ${individual ? 'member_id' : 'team_id'} = ANY($2)`, [sportId, ids])
      for (const r of clean) {
        await c.query(
          individual
            ? `INSERT INTO track_events (sport_id, member_id, score, place) VALUES ($1, $2, $3, $4)
               ON CONFLICT (sport_id, member_id) WHERE member_id IS NOT NULL DO UPDATE SET score = EXCLUDED.score, place = EXCLUDED.place`
            : `INSERT INTO track_events (sport_id, team_id, score, place) VALUES ($1, $2, $3, $4)
               ON CONFLICT (sport_id, team_id) WHERE team_id IS NOT NULL DO UPDATE SET score = EXCLUDED.score, place = EXCLUDED.place`,
          [sportId, individual ? r.member_id : r.team_id, r.score, r.place])
      }
      const { rows: [{ n }] } = await c.query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1 AND kind = 'track'", [sportId])
      await audit(c, actor, 'track.save_results', sportId, { entries: clean.length, ranked: seenPlaces.size, results: clean })
      return { ok: true, saved: clean.length, awarded: n > 0 }
    })
  } catch (err) {
    if (err.code === '23505') return fail(409, 'duplicate_place', 'Another entry already holds one of these positions; reload and try again.')
    throw err
  }
}

async function loadPoints(db) {
  const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('points.track_individual', 'points.track_team', 'points.track_participation')")
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const ind = validateSetting('points.track_individual', s['points.track_individual'])
  const team = validateSetting('points.track_team', s['points.track_team'])
  const part = validateSetting('points.track_participation', s['points.track_participation'])
  if (!ind.ok || !team.ok || !part.ok) return null // missing/invalid: fail closed
  return { individual: ind.value, team: team.value, participation: part.value }
}

export const pointsForPlace = (place, podium, participation) => (place <= 3 ? podium[place - 1] : participation)

/**
 * Turn the saved positions of one event into club points (kind='track'). Repeatable: the event's
 * track rows are replaced. First award needs super_admin; re-awarding (rows exist) needs administrator.
 */
export async function award({ actor, sportId }) {
  return tx(async (c) => {
    const { sport, error } = await getSport(sportId, c)
    if (error) return error
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BASE + sportId])
    const { rows: [{ n: existing }] } = await c.query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1 AND kind = 'track'", [sportId])
    const needed = existing > 0 ? 'administrator' : 'super_admin'
    if (!hasPermission(actor.permission_level, needed)) return fail(403, 'forbidden', existing > 0 ? 'Re-awarding an event needs the administrator level.' : 'Awarding needs the super admin level.')
    const pts = await loadPoints(c)
    if (!pts) return fail(503, 'track_points_not_configured', 'The track point settings are missing or invalid.')
    const podium = sport.sport_type === 'trackIndividual' ? pts.individual : pts.team
    const { rows: ranked } = await c.query(
      `SELECT t.place, COALESCE(p.club_id, m.club_id) AS club_id
       FROM track_events t LEFT JOIN players p ON p.member_id = t.member_id LEFT JOIN teams m ON m.team_id = t.team_id
       WHERE t.sport_id = $1 AND t.place IS NOT NULL`, [sportId])
    const byClub = new Map()
    for (const r of ranked) {
      const cur = byClub.get(r.club_id) ?? { points: 0, place: r.place }
      cur.points += pointsForPlace(r.place, podium, pts.participation)
      cur.place = Math.min(cur.place, r.place)
      byClub.set(r.club_id, cur)
    }
    const clubIds = [...byClub.keys()]
    const del = await c.query("DELETE FROM club_points WHERE sport_id = $1 AND kind = 'track' AND NOT (club_id = ANY($2))", [sportId, clubIds])
    for (const [clubId, v] of byClub) {
      await c.query(
        `INSERT INTO club_points (club_id, sport_id, kind, points, place, note, created_by) VALUES ($1, $2, 'track', $3, $4, $5, $6)
         ON CONFLICT (club_id, sport_id, kind) WHERE kind IN ('placement', 'participation', 'track')
         DO UPDATE SET points = EXCLUDED.points, place = EXCLUDED.place, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now()`,
        [clubId, sportId, v.points, v.place, `Track: ${sport.sport_name}`, actor.member_id])
    }
    const summary = { sportId, clubsAwarded: byClub.size, removed: del.rowCount, totalPoints: [...byClub.values()].reduce((n, v) => n + v.points, 0), reaward: existing > 0 }
    await audit(c, actor, existing > 0 ? 'track.reaward' : 'track.award', sportId, summary)
    return { ok: true, updated: byClub.size, summary, sport }
  })
}
