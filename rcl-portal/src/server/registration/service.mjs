// Registration, un-registration and the read queries around them. Every rule is checked on the
// server inside one transaction; the browser's checks are only for convenience.
//
// Concurrency: the event row is locked (SELECT ... FOR UPDATE) while a registration is made, so
// two clubs/players cannot both take the last slot, and (member_id, sport_id) is UNIQUE so a
// double click can never register twice.
import { tx, query } from '../db.mjs'
import { getSetting } from '../settings.mjs'
import { checkRegistrationLimits } from '../rules/limits.mjs'
import { upsertPlayerFromMirror } from './players.mjs'
import {
  normaliseStatus, normaliseNic, isGeneral, validateRiNumber, memberEligibility, eligibilityInput,
  eventGenderOk, categoryOk, windowStatus, capacityCheck, mixedPairCheck,
} from './eligibility.mjs'

/** Result helpers: `status` is the HTTP status the route should answer with. */
const fail = (status, code, message, extra = {}) => ({ ok: false, status, code, message, ...extra })

const SETTINGS = ['registration.open_at', 'registration.close_at', 'membership.cutoff', 'limits.groups']
async function settingsOn(c, keys) {
  const { rows } = await c.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys])
  const out = Object.fromEntries(keys.map((k) => [k, undefined]))
  for (const r of rows) out[r.key] = r.value
  return out
}

const audit = (c, actorId, action, entityId, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, 'registration', String(entityId), JSON.stringify(detail)])

/**
 * @param {{ actor: {member_id:number}, clubId: number, memberId: number, sportId: number,
 *           mainPlayer?: boolean, riId?: string|null, now?: Date }} input
 */
export async function registerPlayer({ actor, clubId, memberId, sportId, mainPlayer = true, riId = null, now = new Date() }) {
  return tx(async (c) => {
    const settings = await settingsOn(c, SETTINGS)

    const { rows: [event] } = await c.query('SELECT * FROM events WHERE sport_id = $1 FOR UPDATE', [sportId])
    if (!event) return fail(404, 'sport_not_found', 'Sport not found.')

    const win = windowStatus({ openAt: settings['registration.open_at'], eventClose: event.registration_close, closeAt: settings['registration.close_at'], now })
    if (!win.open) return fail(403, win.code, win.message)

    const { rows: [member] } = await c.query('SELECT * FROM rmis_members WHERE member_id = $1', [memberId])
    if (!member) return fail(404, 'member_not_found', 'This member is not known. Ask an admin to refresh the club from RMIS.')
    if (member.club_id !== clubId) return fail(403, 'not_your_club_member', 'This member does not belong to the club.')

    const elig = memberEligibility(
      eligibilityInput(member),
      { cutoff: settings['membership.cutoff'] }
    )
    if (!elig.ok) return fail(422, elig.code, elig.message)

    const { rows: [club] } = await c.query('SELECT category FROM clubs WHERE club_id = $1', [clubId])
    if (!club) return fail(409, 'club_not_synced', 'The club is not set up yet. Ask an admin to sync clubs from RMIS.')
    if (!categoryOk(club.category, event.category)) {
      return fail(422, 'category_mismatch', `This sport is for ${event.category} clubs.`)
    }
    if (!eventGenderOk(event.gender_type, member.gender)) {
      return fail(422, 'gender_mismatch', `This sport is for ${event.gender_type === 'male' ? 'male' : 'female'} players.`)
    }

    const { rows: [existing] } = await c.query('SELECT member_id, club_id, ri_id, converted FROM players WHERE member_id = $1 FOR UPDATE', [memberId])
    // An admin conversion (general -> prospective) sticks: RMIS data must not undo it.
    const norm = existing?.converted ? 5 : normaliseStatus(member.status)

    let ri = null
    if (isGeneral(norm)) {
      const v = validateRiNumber(riId ?? existing?.ri_id)
      if (!v.ok) return fail(422, v.code, v.message)
      ri = v.value
    } else if (riId) {
      ri = String(riId).trim().slice(0, 30) || null // optional for prospective members
    }

    if (existing && existing.club_id !== member.club_id) {
      const { rows: [r] } = await c.query('SELECT 1 FROM registrations WHERE member_id = $1 LIMIT 1', [memberId])
      if (r) return fail(409, 'club_changed', 'This player is registered under another club. An admin must resolve it.')
    }

    const { rows: [counts] } = await c.query(
      `SELECT count(*) FILTER (WHERE main_player)::int AS main, count(*) FILTER (WHERE NOT main_player)::int AS reserve
       FROM registrations WHERE sport_id = $1 AND club_id = $2`, [sportId, clubId])
    const cap = capacityCheck({ event, counts, mainPlayer })
    if (!cap.ok) return fail(409, cap.code, cap.message)

    const { rows: others } = await c.query(
      `SELECT r.main_player, p.gender FROM registrations r JOIN players p USING (member_id) WHERE r.sport_id = $1 AND r.club_id = $2`, [sportId, clubId])
    const pair = mixedPairCheck({ event, mainPlayer, gender: member.gender, others })
    if (!pair.ok) return fail(422, pair.code, pair.message)

    const { rows: current } = await c.query(
      `SELECT r.sport_id, e.sport_day, e.limit_group FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = $1`, [memberId])
    const lim = checkRegistrationLimits({
      existing: current,
      candidate: { sport_id: sportId, sport_day: event.sport_day, limit_group: event.limit_group },
      rules: settings['limits.groups'],
    })
    if (!lim.ok) return fail(lim.code === 'limits_not_configured' ? 503 : lim.code === 'already_registered' ? 409 : 422, lim.code, lim.message)

    await upsertPlayerFromMirror(c, member, norm, ri)

    const { rows: [reg] } = await c.query(
      `INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id, sport_id) DO NOTHING RETURNING id, member_id, sport_id, club_id, main_player, created_at`,
      [memberId, sportId, clubId, mainPlayer])
    if (!reg) return fail(409, 'already_registered', 'This player is already registered for this sport.')

    await audit(c, actor.member_id, 'registration.create', reg.id, { member_id: memberId, sport_id: sportId, club_id: clubId, main_player: mainPlayer })
    return { ok: true, registration: reg }
  })
}

/** Remove a registration. Allowed only while registration is open for that sport. */
export async function unregisterPlayer({ actor, clubId, memberId, sportId, now = new Date() }) {
  return tx(async (c) => {
    const settings = await settingsOn(c, ['registration.open_at', 'registration.close_at'])
    const { rows: [row] } = await c.query(
      `SELECT r.id, r.club_id, e.registration_close FROM registrations r JOIN events e USING (sport_id)
       WHERE r.member_id = $1 AND r.sport_id = $2 FOR UPDATE OF r`, [memberId, sportId])
    if (!row) return fail(404, 'registration_not_found', 'Registration not found.')
    if (row.club_id !== clubId) return fail(403, 'forbidden', 'This registration belongs to another club.')

    const win = windowStatus({ openAt: settings['registration.open_at'], eventClose: row.registration_close, closeAt: settings['registration.close_at'], now })
    if (!win.open) return fail(403, win.code, win.message)

    const { rows: [hist] } = await c.query(
      `SELECT 1 FROM replacement_requests WHERE registration_id = $1
       UNION ALL SELECT 1 FROM swap_requests WHERE reg1_id = $1 OR reg2_id = $1 LIMIT 1`, [row.id])
    if (hist) return fail(409, 'registration_has_history', 'This registration has a replacement or swap request and cannot be removed.')

    await c.query('DELETE FROM registrations WHERE id = $1', [row.id])
    await audit(c, actor.member_id, 'registration.delete', row.id, { member_id: memberId, sport_id: sportId, club_id: clubId })
    return { ok: true }
  })
}

/** A club's registrations (optionally one sport / one player), with the player and sport details pages show. */
export async function listRegistrations({ clubId, sportId = null, memberId = null }) {
  const { rows } = await query(
    `SELECT r.id, r.member_id, r.sport_id, r.club_id, r.main_player, r.created_at,
            p.name AS player_name, p.status AS player_status, p.ri_id, p.membership_id, p.gender,
            e.sport_name, e.sport_day, e.sport_type, e.limit_group
     FROM registrations r JOIN players p USING (member_id) JOIN events e USING (sport_id)
     WHERE r.club_id = $1 AND ($2::int IS NULL OR r.sport_id = $2) AND ($3::int IS NULL OR r.member_id = $3)
     ORDER BY e.sport_day, e.sport_name, r.main_player DESC, p.name`,
    [clubId, sportId, memberId])
  return rows
}

/** Admin list with server-side paging and search (replaces the 5000-row browser-side list). */
export async function listRegistrationsAdmin({ page = 1, limit = 50, sportId = null, clubId = null, search = '' }) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * lim
  const like = search ? `%${String(search).replace(/[\\%_]/g, '\\$&')}%` : null
  const where = `($1::int IS NULL OR r.sport_id = $1) AND ($2::int IS NULL OR r.club_id = $2)
                 AND ($3::text IS NULL OR p.name ILIKE $3 OR p.nic = upper($4) OR p.membership_id ILIKE $3 OR c.club_name ILIKE $3)`
  const params = [sportId, clubId, like, String(search || '').trim()]
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(
      `SELECT r.id, r.member_id, r.sport_id, r.club_id, r.main_player, r.created_at,
              p.name AS player_name, p.nic, p.birthdate, p.gender, p.status AS player_status, p.ri_id, p.membership_id, p.converted,
              c.club_name, e.sport_name, e.sport_day, e.sport_type, e.gender_type
       FROM registrations r JOIN players p USING (member_id) JOIN clubs c ON c.club_id = r.club_id JOIN events e USING (sport_id)
       WHERE ${where} ORDER BY r.id DESC LIMIT $5 OFFSET $6`, [...params, lim, offset]),
    query(`SELECT count(*)::int AS total FROM registrations r JOIN players p USING (member_id) JOIN clubs c ON c.club_id = r.club_id WHERE ${where}`, params),
  ])
  return { rows, total, page: Math.max(Number(page) || 1, 1), limit: lim, totalPages: Math.ceil(total / lim) }
}

/**
 * Admin: convert a GENERAL player to PROSPECTIVE (status 5) and mark them `converted`. The mark
 * keeps RMIS syncs and later registrations from turning them back into a general member.
 */
export async function convertPlayer({ actor, memberId }) {
  return tx(async (c) => {
    const { rows: [p] } = await c.query('SELECT member_id, status, converted FROM players WHERE member_id = $1 FOR UPDATE', [memberId])
    if (!p) return fail(404, 'player_not_found', 'Player not found.')
    if (p.converted) return fail(409, 'already_converted', 'This player has already been converted.')
    if (p.status !== 1) return fail(409, 'not_general', 'Only general members can be converted.')
    await c.query('UPDATE players SET status = 5, converted = true, converted_by = $2 WHERE member_id = $1', [memberId, actor.member_id])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'player.convert', 'player', String(memberId), JSON.stringify({ from: 1, to: 5 })])
    return { ok: true }
  })
}

/** A club's players (own club): status, RI number, registrations count and RMIS flags. */
export async function listPlayersByClub(clubId) {
  const cutoff = await getSetting('membership.cutoff')
  const { rows } = await query(
    `SELECT p.member_id, p.membership_id, p.name, p.club_id, p.status, p.ri_id, p.nic, p.gender, p.converted,
            p.rmis_status, p.rmis_club_id,
            CASE WHEN p.rmis_status IS NOT NULL AND p.rmis_status NOT IN (1, 3, 5) THEN 'not_active_in_rmis'
                 WHEN p.rmis_club_id IS NOT NULL AND p.rmis_club_id <> p.club_id THEN 'club_changed_in_rmis'
                 WHEN m.transfer_completed_at IS NOT NULL AND $2::timestamptz IS NOT NULL AND m.transfer_completed_at > $2::timestamptz THEN 'transferred_after_cutoff' END AS flag,
            (SELECT count(*)::int FROM registrations r WHERE r.member_id = p.member_id) AS registrations
     FROM players p LEFT JOIN rmis_members m USING (member_id) WHERE p.club_id = $1 ORDER BY p.name`, [clubId, cutoff || null])
  return rows
}

/** Admin: remove players that have no registrations (single statement, no row limits). */
export async function cleanUnregisteredPlayers({ clubId = null } = {}) {
  const { rows } = await query(
    `DELETE FROM players p WHERE NOT EXISTS (SELECT 1 FROM registrations r WHERE r.member_id = p.member_id)
       AND NOT EXISTS (SELECT 1 FROM bib_numbers b WHERE b.member_id = p.member_id)
       AND ($1::int IS NULL OR p.club_id = $1) RETURNING p.member_id, p.name, p.club_id`, [clubId])
  return rows
}

// ---- public QR lookup (no login). NIC is an exact-match KEY but is never returned. ------------

const publicShape = (r) => ({
  member_id: r.member_id, name: r.name, club_id: r.club_id, club_name: r.club_name,
  membership_id: r.membership_id, gender: r.gender, status: r.status,
  masked_nic: r.nic ? `•••••${String(r.nic).slice(-4)}` : null,
})

export async function searchPlayersPublic({ name, nic, membershipId }) {
  const n = String(name ?? '').trim()
  const id = normaliseNic(nic)
  const mid = String(membershipId ?? '').trim()
  if (!id && !mid && n.length < 3) return { ok: true, players: [], reason: 'query_too_short' }
  const clauses = [], params = []
  if (id) { params.push(id); clauses.push(`p.nic = $${params.length}`) }
  if (mid) { params.push(mid); clauses.push(`upper(p.membership_id) = upper($${params.length})`) }
  if (n.length >= 3) { params.push(`%${n.replace(/[\\%_]/g, '\\$&')}%`); clauses.push(`p.name ILIKE $${params.length}`) }
  const { rows } = await query(
    `SELECT p.member_id, p.name, p.club_id, c.club_name, p.membership_id, p.gender, p.status, p.nic
     FROM players p JOIN clubs c USING (club_id)
     WHERE (${clauses.join(' OR ')}) AND EXISTS (SELECT 1 FROM registrations r WHERE r.member_id = p.member_id)
     ORDER BY p.name LIMIT 20`, params)
  return { ok: true, players: rows.map(publicShape) }
}

export async function getPlayerPublic(memberId) {
  const { rows: [p] } = await query(
    `SELECT p.member_id, p.name, p.club_id, c.club_name, p.membership_id, p.gender, p.status, p.nic
     FROM players p JOIN clubs c USING (club_id) WHERE p.member_id = $1`, [memberId])
  if (!p) return null
  const { rows: sports } = await query(
    `SELECT e.sport_id, e.sport_name, e.sport_day, r.main_player FROM registrations r JOIN events e USING (sport_id)
     WHERE r.member_id = $1 ORDER BY e.sport_day, e.sport_name`, [memberId])
  return { ...publicShape(p), sports }
}
