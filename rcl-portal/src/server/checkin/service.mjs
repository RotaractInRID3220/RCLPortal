// On-the-day check-in and player numbers.
//   check-in      : staff scan/search a player and mark them present for the CURRENT day (day_registrations)
//   player number : <day code><registration id padded to 4>, e.g. D-01 + 0032 = D-010032. One per
//                   (player, sport) registration. Derived, never stored.
// Check-in is what participation points count (see participation/service.mjs).
import { query, tx } from '../db.mjs'
import { getSetting } from '../settings.mjs'
import { normaliseNic } from '../registration/eligibility.mjs'
import { getBibForMember, formatBib } from '../bibs/service.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })

export const formatPlayerNumber = (dayCode, registrationId) => `${dayCode}${String(registrationId).padStart(4, '0')}`

/** Split "D-010032" into { dayCode: 'D-01', registrationId: 32 } using the known day codes (longest first). */
export function parsePlayerNumber(text, dayCodes) {
  const t = String(text ?? '').trim().toUpperCase()
  for (const code of [...dayCodes].sort((a, b) => b.length - a.length)) {
    const c = code.toUpperCase()
    if (!t.startsWith(c)) continue
    const rest = t.slice(c.length)
    if (/^\d{1,9}$/.test(rest)) return { dayCode: code, registrationId: Number(rest) }
  }
  return null
}

export async function listDays(db = { query }) {
  const { rows } = await db.query('SELECT day_code, label, sort_order, event_date FROM event_days ORDER BY sort_order')
  return rows
}

/** What the check-in screens need to know: is it open, which day. */
export async function checkinState() {
  const [open, currentDay, days] = await Promise.all([getSetting('checkin.open'), getSetting('checkin.current_day'), listDays()])
  return { open: open === true, currentDay: currentDay ?? null, days }
}

/** A player reference from a URL or search box: a member id (digits) or a membership id (text). */
async function resolvePlayer(ref, db) {
  const text = String(ref ?? '').trim()
  if (!text) return null
  const { rows: [p] } = /^\d+$/.test(text)
    ? await db.query('SELECT p.member_id, p.membership_id, p.name, p.nic, p.club_id, c.club_name, c.category FROM players p LEFT JOIN clubs c USING (club_id) WHERE p.member_id = $1', [Number(text)])
    : await db.query('SELECT p.member_id, p.membership_id, p.name, p.nic, p.club_id, c.club_name, c.category FROM players p LEFT JOIN clubs c USING (club_id) WHERE upper(p.membership_id) = upper($1)', [text])
  return p ?? null
}

/**
 * One call for the check-in screen: the player (member id or membership id), their sports on the day
 * and whether they are checked in. Shapes keep the field names the pages already read (`id`, `events`, `clubs`).
 */
export async function verifyPlayer(ref, dayCode, db = { query }) {
  const player = await resolvePlayer(ref, db)
  if (!player) return null
  const { rows: sports } = await db.query(
    `SELECT r.id AS registration_id, r.sport_id, r.main_player, r.created_at, e.sport_name, e.sport_type, e.gender_type, e.category, e.sport_day
     FROM registrations r JOIN events e USING (sport_id)
     WHERE r.member_id = $1 AND e.sport_day = $2 ORDER BY e.sport_name`, [player.member_id, dayCode])
  const { rows: [reg] } = await db.query('SELECT id, member_id, day_code, approved_by, created_at FROM day_registrations WHERE member_id = $1 AND day_code = $2', [player.member_id, dayCode])
  const club = { club_name: player.club_name, category: player.category }
  return {
    player: { ...player, RMIS_ID: player.membership_id ?? String(player.member_id), NIC: player.nic, club, clubs: club },
    sports: sports.map((s) => ({
      id: s.registration_id, registration_id: s.registration_id, sport_id: s.sport_id, main_player: s.main_player, created_at: s.created_at,
      player_number: formatPlayerNumber(dayCode, s.registration_id),
      events: { sport_name: s.sport_name, sport_type: s.sport_type, gender_type: s.gender_type, category: s.category, sport_day: s.sport_day },
    })),
    registration: { isRegistered: Boolean(reg), registration: reg ?? null },
    bib_number: await getBibForMember(player.member_id, db),
  }
}

/**
 * Check a player in for the current day. One transaction, idempotent on (player, day): a second scan
 * answers 409 already_checked_in with the original record. Only the day set as "current" can be
 * checked in, and only while check-in is open.
 */
export async function checkIn({ actor, memberId, dayCode }) {
  return tx(async (c) => {
    const { rows: s } = await c.query(`SELECT key, value FROM settings WHERE key IN ('checkin.open', 'checkin.current_day', 'checkin.require_registration')`)
    const st = Object.fromEntries(s.map((r) => [r.key, r.value]))
    if (st['checkin.open'] !== true) return fail(403, 'checkin_closed', 'Check-in is currently closed.')
    if (!st['checkin.current_day']) return fail(409, 'no_current_day', 'No check-in day has been selected yet.')
    if (dayCode && dayCode !== st['checkin.current_day']) return fail(409, 'wrong_day', `Check-in is open for ${st['checkin.current_day']}, not ${dayCode}.`)
    const day = st['checkin.current_day']
    const { rows: [p] } = await c.query('SELECT member_id FROM players WHERE member_id = $1', [memberId])
    if (!p) return fail(404, 'player_not_found', 'This player is not registered for any event.')
    if (st['checkin.require_registration'] !== false) {
      const { rows } = await c.query('SELECT 1 FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = $1 AND e.sport_day = $2 LIMIT 1', [memberId, day])
      if (!rows.length) return fail(422, 'not_registered_for_day', `This player has no registered sport on ${day}.`)
    }
    const { rows: [row] } = await c.query(
      `INSERT INTO day_registrations (member_id, day_code, approved_by) VALUES ($1, $2, $3)
       ON CONFLICT (member_id, day_code) DO NOTHING RETURNING id, member_id, day_code, approved_by, created_at`,
      [memberId, day, actor.member_id])
    if (!row) {
      const { rows: [prev] } = await c.query('SELECT id, member_id, day_code, approved_by, created_at FROM day_registrations WHERE member_id = $1 AND day_code = $2', [memberId, day])
      return { ...fail(409, 'already_checked_in', 'This player is already checked in for today.'), registration: prev }
    }
    return { ok: true, registration: row }
  })
}

export async function getCheckin(memberId, dayCode) {
  const { rows: [r] } = await query('SELECT id, member_id, day_code, approved_by, created_at FROM day_registrations WHERE member_id = $1 AND day_code = $2', [memberId, dayCode])
  return { isRegistered: Boolean(r), registration: r ?? null }
}

/** Admin: events of a day (or one event) with the players checked in for them. Two aggregate statements. */
export async function listDayCheckins({ dayCode = null, sportId = null } = {}) {
  const { rows: events } = await query(
    `SELECT e.sport_id, e.sport_name, e.sport_type, e.gender_type, e.category, e.sport_day,
            coalesce(json_agg(json_build_object(
              'id', d.id, 'member_id', p.member_id, 'membership_id', p.membership_id, 'name', p.name, 'club_id', p.club_id,
              'club_name', c.club_name, 'main_player', r.main_player, 'checked_in_at', d.created_at, 'approved_by', d.approved_by
            ) ORDER BY d.created_at DESC) FILTER (WHERE d.id IS NOT NULL), '[]') AS registrations
     FROM events e
     LEFT JOIN registrations r ON r.sport_id = e.sport_id
     LEFT JOIN day_registrations d ON d.member_id = r.member_id AND d.day_code = e.sport_day
     LEFT JOIN players p ON p.member_id = r.member_id
     LEFT JOIN clubs c ON c.club_id = p.club_id
     WHERE ($1::text IS NULL OR e.sport_day = $1) AND ($2::int IS NULL OR e.sport_id = $2)
     GROUP BY e.sport_id ORDER BY e.sport_name`, [dayCode, sportId])
  const { rows: [sum] } = await query(
    `SELECT count(*)::int AS total, count(DISTINCT member_id)::int AS unique_players FROM day_registrations WHERE ($1::text IS NULL OR day_code = $1)`, [dayCode])
  const { rows: byDayRows } = await query(`SELECT day_code, count(*)::int AS n FROM day_registrations WHERE ($1::text IS NULL OR day_code = $1) GROUP BY day_code`, [dayCode])
  return {
    events: events.map((e) => ({ ...e, registrationCount: e.registrations.length })),
    summary: { totalRegistrations: sum.total, uniquePlayers: sum.unique_players, byDay: Object.fromEntries(byDayRows.map((r) => [r.day_code, r.n])) },
  }
}

const PN_SELECT = `
  SELECT r.id AS registration_id, r.member_id, p.membership_id, b.bib_number, r.sport_id, r.main_player, p.name AS player_name, p.club_id, c.club_name,
         e.sport_name, e.sport_day, EXISTS (SELECT 1 FROM day_registrations d WHERE d.member_id = r.member_id AND d.day_code = e.sport_day) AS is_day_registered
  FROM registrations r JOIN events e USING (sport_id) JOIN players p USING (member_id) LEFT JOIN clubs c ON c.club_id = p.club_id
  LEFT JOIN bib_numbers b ON b.member_id = r.member_id AND e.bib_required
  WHERE e.sport_day = $1`

const shapeNumber = (r) => ({
  playerNumber: formatPlayerNumber(r.sport_day, r.registration_id), registrationId: r.registration_id, rmisId: r.membership_id ?? String(r.member_id), memberId: r.member_id,
  bib: formatBib(r.bib_number),
  playerName: r.player_name, clubName: r.club_name ?? '-', clubId: r.club_id, sportName: r.sport_name, sportId: r.sport_id,
  isMainPlayer: r.main_player, isDayRegistered: r.is_day_registered,
})

/** Player numbers of a day. Without `search` the whole day (the page filters client-side); with it, a page. */
export async function listPlayerNumbers({ dayCode, search = '', page = 1, limit = 10 }) {
  const term = String(search ?? '').trim()
  if (!term) {
    const { rows } = await query(`${PN_SELECT} ORDER BY c.club_name, p.name, r.id`, [dayCode])
    return { data: rows.map(shapeNumber), totalCount: rows.length, totalPages: Math.ceil(rows.length / limit), currentPage: 1, isFullDataset: true }
  }
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`
  const filter = `AND (p.name ILIKE $2 OR p.membership_id ILIKE $2 OR c.club_name ILIKE $2 OR p.member_id::text = $3)`
  const [{ rows }, { rows: [cnt] }] = await Promise.all([
    query(`${PN_SELECT} ${filter} ORDER BY c.club_name, p.name, r.id LIMIT $4 OFFSET $5`, [dayCode, like, term, limit, (page - 1) * limit]),
    query(`SELECT count(*)::int AS n FROM registrations r JOIN events e USING (sport_id) JOIN players p USING (member_id) LEFT JOIN clubs c ON c.club_id = p.club_id WHERE e.sport_day = $1 ${filter}`, [dayCode, like, term]),
  ])
  return { data: rows.map(shapeNumber), totalCount: cnt.n, totalPages: Math.ceil(cnt.n / limit), currentPage: page, isFullDataset: false }
}

export async function exportPlayerNumbers({ dayCode }) {
  const { rows } = await query(`${PN_SELECT} ORDER BY c.club_name, p.name, r.id`, [dayCode])
  return rows.map((r) => { const s = shapeNumber(r); return { playerNumber: s.playerNumber, bib: s.bib, rmisId: s.rmisId, playerName: s.playerName, clubName: s.clubName, sportName: s.sportName } })
}

/** Registered vs checked-in players for every event day, in one statement. */
export async function dayStats() {
  const { rows } = await query(
    `SELECT d.day_code, d.label,
            coalesce(x.registrations, 0)::int AS registrations, coalesce(x.players, 0)::int AS players, coalesce(x.checked_in, 0)::int AS checked_in
     FROM event_days d
     LEFT JOIN LATERAL (
       SELECT count(*) AS registrations, count(DISTINCT r.member_id) AS players,
              count(DISTINCT r.member_id) FILTER (WHERE EXISTS (SELECT 1 FROM day_registrations dr WHERE dr.member_id = r.member_id AND dr.day_code = d.day_code)) AS checked_in
       FROM registrations r JOIN events e USING (sport_id) WHERE e.sport_day = d.day_code) x ON true
     ORDER BY d.sort_order`)
  return rows.map((r) => ({
    sportDay: r.day_code, label: r.label, totalRegistrations: r.registrations, uniquePlayers: r.players,
    dayRegistered: r.checked_in, notDayRegistered: r.players - r.checked_in,
    dayRegistrationRate: r.players ? Math.round((r.checked_in / r.players) * 100) : 0,
  }))
}

/**
 * Find a player's registrations for a day by player number, member id / membership id, or NIC.
 * `searchType`: playerNumber | rmisId (member id or membership id) | nic | auto.
 */
export async function lookupPlayer({ queryText, searchType = 'auto', dayCode }) {
  const text = String(queryText ?? '').trim()
  if (!text) return fail(400, 'invalid_request', 'Query parameter is required')
  const days = (await listDays()).map((d) => d.day_code)
  let type = searchType
  if (type === 'auto') type = parsePlayerNumber(text, days) ? 'playerNumber' : 'rmisId'
  let where, params
  if (type === 'playerNumber') {
    const pn = parsePlayerNumber(text, days)
    if (!pn) return fail(400, 'invalid_player_number', 'Invalid player number format')
    where = 'r.id = $2'; params = [dayCode, pn.registrationId]
  } else if (type === 'nic') {
    const nic = normaliseNic(text)
    if (!nic) return fail(400, 'invalid_request', 'Enter a NIC.')
    where = 'upper(replace(p.nic, \' \', \'\')) = $2'; params = [dayCode, nic]
  } else {
    where = '(p.membership_id ILIKE $2 OR p.member_id::text = $2)'; params = [dayCode, text]
  }
  const { rows } = await query(
    `SELECT r.id AS registration_id, r.sport_id, r.main_player, r.created_at, p.member_id, p.membership_id, p.name, p.nic, p.club_id, c.club_name, c.category AS club_category,
            e.sport_name, e.sport_type, e.gender_type, e.category, e.sport_day
     FROM registrations r JOIN events e USING (sport_id) JOIN players p USING (member_id) LEFT JOIN clubs c ON c.club_id = p.club_id
     WHERE e.sport_day = $1 AND ${where} ORDER BY e.sport_name`, params)
  if (!rows.length) return fail(404, 'not_found', type === 'playerNumber' ? 'Player number not found for this sport day' : 'Player not found for this sport day')
  const first = rows[0]
  if (rows.some((r) => r.member_id !== first.member_id)) return fail(409, 'ambiguous', 'More than one player matches. Search by player number or NIC.')
  const sports = rows.map((r) => ({
    id: r.registration_id, sportId: r.sport_id, name: r.sport_name, type: r.sport_type, genderType: r.gender_type, category: r.category,
    sportDay: r.sport_day, isMainPlayer: r.main_player, registeredAt: r.created_at, playerNumber: formatPlayerNumber(r.sport_day, r.registration_id),
  }))
  return {
    ok: true,
    data: {
      bib_number: await getBibForMember(first.member_id),
      player: { RMIS_ID: first.membership_id ?? String(first.member_id), member_id: first.member_id, membership_id: first.membership_id, name: first.name, NIC: first.nic, club: { club_name: first.club_name, category: first.club_category } },
      sports, playerNumber: sports[0].playerNumber, registrationId: sports[0].id,
      sport: { name: sports[0].name, type: sports[0].type, genderType: sports[0].genderType, category: sports[0].category, sportDay: sports[0].sportDay },
      registration: { isMainPlayer: sports[0].isMainPlayer, registeredAt: sports[0].registeredAt },
    },
  }
}
