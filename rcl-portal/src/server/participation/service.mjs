// Participation points: a club earns `points.participation_per_sport` for each team/individual
// sport on a day where at least `participation.min_attendance_ratio` of its registered players
// (main + reserve) were checked in for that day. Track events have their own participation points
// (points.track_participation), so they are not counted here.
//
// The old version stored these as club_points rows with a negative `place`, which the tournament
// award later overwrote, so re-awarding inserted duplicates. Now they are kind='participation' rows
// under a unique key (club, sport, kind): awarding is idempotent and nothing overwrites them.
import { query, tx } from '../db.mjs'
import { validateSetting } from '../settings/registry.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_BASE = 4_205_000

async function loadConfig(db) {
  const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('participation.min_attendance_ratio', 'points.participation_per_sport', 'checkin.current_day')")
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const ratio = validateSetting('participation.min_attendance_ratio', s['participation.min_attendance_ratio'])
  const points = validateSetting('points.participation_per_sport', s['points.participation_per_sport'])
  if (!ratio.ok || !points.ok) return null // missing/invalid: fail closed
  return { ratio: ratio.value, pointsPerSport: points.value, currentDay: s['checkin.current_day'] ?? null }
}

async function resolveDay(db, day, config) {
  const { rows: days } = await db.query('SELECT day_code, label, event_date, sort_order FROM event_days ORDER BY sort_order')
  const code = day || config.currentDay || days[0]?.day_code
  const found = days.find((d) => d.day_code === code)
  return { days, day: found ?? null }
}

// registered/attended per club and sport for one day, plus eligibility and whether it is already awarded
const PER_SPORT_SQL = `
  WITH reg AS (
    SELECT r.club_id, r.sport_id, r.member_id FROM registrations r JOIN events e USING (sport_id)
    WHERE e.sport_day = $1 AND e.sport_type IN ('team', 'individual')
  ), per AS (
    SELECT reg.club_id, reg.sport_id, count(*)::int AS registered,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM day_registrations d WHERE d.member_id = reg.member_id AND d.day_code = $1))::int AS attended
    FROM reg GROUP BY reg.club_id, reg.sport_id
  )
  SELECT per.club_id, per.sport_id, per.registered, per.attended,
         (per.registered > 0 AND per.attended >= $2::numeric * per.registered) AS eligible,
         EXISTS (SELECT 1 FROM club_points cp WHERE cp.club_id = per.club_id AND cp.sport_id = per.sport_id AND cp.kind = 'participation') AS awarded
  FROM per`

export async function overview({ day = null } = {}) {
  const config = await loadConfig({ query })
  if (!config) return fail(503, 'participation_not_configured', 'The attendance ratio or participation points are not configured.')
  const { days, day: d } = await resolveDay({ query }, day, config)
  if (!d) return fail(400, 'unknown_day', `"${day}" is not a defined event day.`)
  const [{ rows: clubs }, { rows: per }, { rows: attendance }] = await Promise.all([
    query('SELECT club_id, club_name FROM clubs WHERE status = 1 ORDER BY club_name'),
    query(PER_SPORT_SQL, [d.day_code, config.ratio]),
    query(
      `SELECT r.club_id, count(DISTINCT r.member_id)::int AS players,
              count(DISTINCT r.member_id) FILTER (WHERE EXISTS (SELECT 1 FROM day_registrations x WHERE x.member_id = r.member_id AND x.day_code = $1))::int AS checked_in
       FROM registrations r JOIN events e USING (sport_id) WHERE e.sport_day = $1 AND e.sport_type IN ('team', 'individual') GROUP BY r.club_id`, [d.day_code]),
  ])
  const att = Object.fromEntries(attendance.map((a) => [a.club_id, a]))
  const data = clubs.map((c) => {
    const mine = per.filter((p) => p.club_id === c.club_id)
    const eligible = mine.filter((p) => p.eligible)
    const awarded = eligible.filter((p) => p.awarded)
    return {
      club_id: c.club_id, club_name: c.club_name,
      registered_players_count: att[c.club_id]?.players ?? 0, day_registration_count: att[c.club_id]?.checked_in ?? 0,
      registered_sports_count: mine.length, eligible_sports_count: eligible.length,
      awarded_sports_count: awarded.length, pending_sports_count: eligible.length - awarded.length,
      already_awarded: eligible.length > 0 && awarded.length === eligible.length, // nothing left to award
    }
  })
  return { ok: true, data, meta: { sportDay: d.day_code, dayLabel: d.label, days, pointsPerSport: config.pointsPerSport, minAttendanceRatio: config.ratio } }
}

export async function clubDetail({ clubId, day = null }) {
  const config = await loadConfig({ query })
  if (!config) return fail(503, 'participation_not_configured', 'The attendance ratio or participation points are not configured.')
  const { day: d } = await resolveDay({ query }, day, config)
  if (!d) return fail(400, 'unknown_day', `"${day}" is not a defined event day.`)
  const { rows: [club] } = await query('SELECT club_id, club_name FROM clubs WHERE club_id = $1', [clubId])
  if (!club) return fail(404, 'club_not_found', 'Club not found.')
  const { rows } = await query(
    `SELECT e.sport_id, e.sport_name, p.member_id, p.name, p.gender, p.membership_id, r.main_player,
            EXISTS (SELECT 1 FROM day_registrations x WHERE x.member_id = r.member_id AND x.day_code = $2) AS day_registered
     FROM registrations r JOIN events e USING (sport_id) JOIN players p USING (member_id)
     WHERE r.club_id = $1 AND e.sport_day = $2 AND e.sport_type IN ('team', 'individual') ORDER BY e.sport_name, r.main_player DESC, p.name`, [clubId, d.day_code])
  const { rows: per } = await query(PER_SPORT_SQL, [d.day_code, config.ratio])
  const flags = Object.fromEntries(per.filter((p) => p.club_id === clubId).map((p) => [p.sport_id, p]))
  const sports = []
  const players = new Map()
  for (const r of rows) {
    let s = sports.find((x) => x.sport_id === r.sport_id)
    if (!s) { s = { sport_id: r.sport_id, sport_name: r.sport_name, players: [], eligible: Boolean(flags[r.sport_id]?.eligible), awarded: Boolean(flags[r.sport_id]?.awarded) }; sports.push(s) }
    s.players.push({ member_id: r.member_id, name: r.name, gender: r.gender, membership_id: r.membership_id, main_player: r.main_player, day_registered: r.day_registered })
    if (!players.has(r.member_id)) players.set(r.member_id, { member_id: r.member_id, name: r.name, gender: r.gender, membership_id: r.membership_id, sports: [], day_registered: r.day_registered })
    players.get(r.member_id).sports.push(r.sport_id)
  }
  const plist = [...players.values()].sort((a, b) => (b.day_registered - a.day_registered) || a.name.localeCompare(b.name))
  return { ok: true, data: { club, sports, players: plist, summary: { total_players: plist.length, day_registered_count: plist.filter((p) => p.day_registered).length, total_sports: sports.length, sport_day: d.day_code, min_attendance_ratio: config.ratio } } }
}

/** Award for every club with eligible sports that have not been awarded yet. Safe to repeat. */
export async function award({ actor, day }) {
  return tx(async (c) => {
    const config = await loadConfig(c)
    if (!config) return fail(503, 'participation_not_configured', 'The attendance ratio or participation points are not configured.')
    const { day: d } = await resolveDay(c, day, config)
    if (!d || !day) return fail(400, 'unknown_day', `"${day ?? ''}" is not a defined event day.`)
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BASE + d.sort_order])
    const { rows: made } = await c.query(
      `INSERT INTO club_points (club_id, sport_id, kind, points, note, created_by)
       SELECT s.club_id, s.sport_id, 'participation', $3, $4, $5 FROM (${PER_SPORT_SQL}) s WHERE s.eligible AND NOT s.awarded
       ON CONFLICT DO NOTHING RETURNING club_id, sport_id, points`, [d.day_code, config.ratio, config.pointsPerSport, `Participation ${d.day_code}`, actor.member_id])
    const { rows: eligibleClubs } = await c.query(`SELECT DISTINCT club_id FROM (${PER_SPORT_SQL}) s WHERE s.eligible`, [d.day_code, config.ratio])
    const awardedClubs = new Set(made.map((m) => m.club_id))
    const summary = { clubsAwarded: awardedClubs.size, clubsSkipped: eligibleClubs.filter((e) => !awardedClubs.has(e.club_id)).length,
      totalPointsAwarded: made.reduce((n, m) => n + m.points, 0), sportsAwarded: made.length, sportDay: d.day_code }
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'participation.award', 'club_points', d.day_code, JSON.stringify(summary)])
    return { ok: true, summary }
  })
}
