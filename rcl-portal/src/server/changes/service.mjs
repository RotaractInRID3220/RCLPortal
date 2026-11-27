// Player changes after registration: REPLACEMENT (another club member takes a registered player's
// place), SWAP (two players of a club exchange sports) and MOVE (one player goes to another sport).
//
// A club asks (portal, only inside the replacement window); an admin approves or rejects; an admin
// can also make a change directly. Every path goes through the SAME checks (membership/eligibility,
// gender, category, per-player limits, capacity) and approval re-checks everything against the
// CURRENT data, so a stale request can never be applied. Rows are locked, a request can be decided
// once (status 0 -> 1|2 under a row lock), and one transaction applies the change and records it:
// either everything happens or nothing does.
import { query, tx } from '../db.mjs'
import { checkRegistrationLimits } from '../rules/limits.mjs'
import { handBibsOver } from '../bibs/service.mjs'
import { capacityCheck, categoryOk, eventGenderOk, memberEligibility, eligibilityInput, normaliseStatus, validateRiNumber } from '../registration/eligibility.mjs'
import { upsertPlayerFromMirror } from '../registration/players.mjs'
import { normaliseNic } from '../registration/eligibility.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const SETTING_KEYS = ['replacement.open_at', 'replacement.close_at', 'membership.cutoff', 'limits.groups']

async function settingsOn(c, keys = SETTING_KEYS) {
  const { rows } = await c.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys])
  const out = Object.fromEntries(keys.map((k) => [k, undefined]))
  for (const r of rows) out[r.key] = r.value
  return out
}

/** The replacement/swap window: opens at replacement.open_at (unset = closed), ends at replacement.close_at (unset = no end). */
export function changesWindow({ openAt, closeAt, now = new Date() }) {
  const t = now.getTime()
  if (!openAt || !Number.isFinite(Date.parse(openAt))) return { open: false, code: 'changes_not_open', message: 'Replacements and swaps have not been opened yet.' }
  if (Date.parse(openAt) > t) return { open: false, code: 'changes_not_open', message: 'Replacements and swaps have not opened yet.' }
  if (closeAt && Date.parse(closeAt) <= t) return { open: false, code: 'changes_closed', message: 'The replacement and swap window has closed.' }
  return { open: true }
}

const cleanReason = (v) => { const r = String(v ?? '').trim(); return r.length >= 1 && r.length <= 500 ? r : null }
const cleanLink = (v) => { const l = String(v ?? '').trim(); if (!l) return { ok: true, value: null }; return l.length <= 500 && /^https:\/\/\S+$/.test(l) ? { ok: true, value: l } : { ok: false } }
const audit = (c, actor, action, entity, id, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)', [actor.member_id, action, entity, String(id), JSON.stringify(detail)])

const REG_SQL = `SELECT r.id, r.member_id, r.sport_id, r.club_id, r.main_player, e.sport_name, e.sport_day, e.limit_group, e.gender_type, e.category AS event_category,
                        e.max_count, e.reserve_count
                 FROM registrations r JOIN events e USING (sport_id) WHERE r.id = ANY($1) ORDER BY r.id FOR UPDATE OF r`
async function lockRegistrations(c, ids) { return (await c.query(REG_SQL, [ids])).rows }

async function hasPendingChange(c, regIds) {
  const { rows } = await c.query(
    `SELECT 1 FROM replacement_requests WHERE status = 0 AND registration_id = ANY($1)
     UNION ALL SELECT 1 FROM swap_requests WHERE status = 0 AND (reg1_id = ANY($1) OR reg2_id = ANY($1)) LIMIT 1`, [regIds])
  return rows.length > 0
}

// ================================================================ replacements

/** Can `replacementMemberId` take over registration `reg`? Re-run at request time AND at approval. */
async function checkReplacementTarget(c, { reg, replacementMemberId, riId, settings }) {
  if (reg.member_id === replacementMemberId) return fail(400, 'same_player', 'The replacement must be a different player.')
  const { rows: [member] } = await c.query('SELECT * FROM rmis_members WHERE member_id = $1', [replacementMemberId])
  if (!member) return fail(404, 'member_not_found', 'The replacement is not a known member. Refresh the club from RMIS and try again.')
  if (member.club_id !== reg.club_id) return fail(403, 'not_your_club_member', 'The replacement must be a member of the same club.')
  const elig = memberEligibility(eligibilityInput(member), { cutoff: settings['membership.cutoff'] })
  if (!elig.ok) return fail(422, elig.code, elig.message)
  const { rows: [club] } = await c.query('SELECT category FROM clubs WHERE club_id = $1', [reg.club_id])
  if (!club || !categoryOk(club.category, reg.event_category)) return fail(422, 'category_mismatch', `This sport is for ${reg.event_category} clubs.`)
  if (!eventGenderOk(reg.gender_type, member.gender)) return fail(422, 'gender_mismatch', `This sport is for ${reg.gender_type === 'male' ? 'male' : 'female'} players.`)
  const { rows: [dup] } = await c.query('SELECT 1 FROM registrations WHERE member_id = $1 AND sport_id = $2', [replacementMemberId, reg.sport_id])
  if (dup) return fail(409, 'already_registered', 'The replacement is already registered for this sport.')

  const { rows: [existing] } = await c.query('SELECT club_id, ri_id, converted FROM players WHERE member_id = $1', [replacementMemberId])
  if (existing && existing.club_id !== member.club_id) {
    const { rows: [r] } = await c.query('SELECT 1 FROM registrations WHERE member_id = $1 LIMIT 1', [replacementMemberId])
    if (r) return fail(409, 'club_changed', 'This player is registered under another club. An admin must resolve it.')
  }
  const norm = existing?.converted ? 5 : normaliseStatus(member.status)
  let ri = null
  if (norm === 1) {
    const v = validateRiNumber(riId ?? existing?.ri_id)
    if (!v.ok) return fail(422, v.code, v.message)
    ri = v.value
  } else if (riId) ri = String(riId).trim().slice(0, 30) || null

  const { rows: current } = await c.query('SELECT r.sport_id, e.sport_day, e.limit_group FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = $1', [replacementMemberId])
  const lim = checkRegistrationLimits({ existing: current, candidate: { sport_id: reg.sport_id, sport_day: reg.sport_day, limit_group: reg.limit_group }, rules: settings['limits.groups'] })
  if (!lim.ok) return fail(lim.code === 'limits_not_configured' ? 503 : 422, lim.code, lim.message)
  return { ok: true, member, norm, ri }
}

async function applyReplacement(c, reg, target) {
  await upsertPlayerFromMirror(c, target.member, target.norm, target.ri)
  const { rowCount } = await c.query('UPDATE registrations SET member_id = $2 WHERE id = $1 AND member_id = $3', [reg.id, target.member.member_id, reg.member_id])
  if (!rowCount) throw Object.assign(new Error('registration changed'), { stale: true })
  await handBibsOver(c, [reg.member_id, target.member.member_id])   // the bib number follows the replacement
}

const snapshotOf = (t) => [t.member.membership_id, t.member.full_name || t.member.card_name, t.member.gender, t.norm, t.ri, normaliseNic(t.member.nic), t.member.dob]

async function insertReplacementRow(c, { reg, replacementMemberId, target, reason, link, actor, decided }) {
  const { rows: [row] } = await c.query(
    `INSERT INTO replacement_requests (sport_id, registration_id, club_id, original_member_id, replacement_member_id,
       rep_membership_id, rep_name, rep_gender, rep_status, rep_ri_id, rep_nic, rep_birthdate, reason, supporting_link, status, requested_by, decided_by, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [reg.sport_id, reg.id, reg.club_id, reg.member_id, replacementMemberId, ...snapshotOf(target), reason, link, decided ? 1 : 0, actor.member_id,
     decided ? actor.member_id : null, decided ? new Date() : null])
  return row
}

export async function createReplacementRequest({ actor, clubId, registrationId, replacementMemberId, reason, link, riId = null, now = new Date() }) {
  const why = cleanReason(reason); if (!why) return fail(400, 'reason_required', 'A reason is required (up to 500 characters).')
  const lnk = cleanLink(link); if (!lnk.ok) return fail(400, 'invalid_link', 'The supporting link must be a valid https URL.')
  try {
    return await tx(async (c) => {
      const settings = await settingsOn(c)
      const win = changesWindow({ openAt: settings['replacement.open_at'], closeAt: settings['replacement.close_at'], now })
      if (!win.open) return fail(403, win.code, win.message)
      const [reg] = await lockRegistrations(c, [registrationId])
      if (!reg) return fail(404, 'registration_not_found', 'Registration not found.')
      if (reg.club_id !== clubId) return fail(403, 'forbidden', 'This registration belongs to another club.')
      if (await hasPendingChange(c, [reg.id])) return fail(409, 'request_pending', 'A request is already pending for this player.')
      const target = await checkReplacementTarget(c, { reg, replacementMemberId, riId, settings })
      if (!target.ok) return target
      const row = await insertReplacementRow(c, { reg, replacementMemberId, target, reason: why, link: lnk.value, actor })
      await audit(c, actor, 'replacement.request', 'replacement_request', row.id, { registration_id: reg.id, from: reg.member_id, to: replacementMemberId })
      return { ok: true, request: row }
    })
  } catch (e) {
    if (e.code === '23505') return fail(409, 'request_pending', 'A request is already pending for this player.')
    throw e
  }
}

export async function decideReplacement({ actor, id, approve }) {
  try {
    return await tx(async (c) => {
      const { rows: [req] } = await c.query('SELECT * FROM replacement_requests WHERE id = $1 FOR UPDATE', [id])
      if (!req) return fail(404, 'request_not_found', 'Request not found.')
      if (req.status !== 0) return fail(409, 'already_decided', `This request was already ${req.status === 1 ? 'approved' : 'rejected'}.`)
      if (approve) {
        const settings = await settingsOn(c)
        const [reg] = await lockRegistrations(c, [req.registration_id])
        if (!reg || reg.member_id !== req.original_member_id) return fail(409, 'stale_request', 'The registration has changed since this request was made. Reject it and ask the club to submit it again.')
        const target = await checkReplacementTarget(c, { reg, replacementMemberId: req.replacement_member_id, riId: req.rep_ri_id, settings })
        if (!target.ok) return target
        await applyReplacement(c, reg, target)
      }
      await c.query('UPDATE replacement_requests SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1', [id, approve ? 1 : 2, actor.member_id])
      await audit(c, actor, approve ? 'replacement.approve' : 'replacement.reject', 'replacement_request', id, { registration_id: req.registration_id, from: req.original_member_id, to: req.replacement_member_id })
      return { ok: true }
    })
  } catch (e) {
    if (e.stale) return fail(409, 'stale_request', 'The registration has changed since this request was made.')
    throw e
  }
}

/** Admin changes a player directly (no club request, no window). The change is recorded as an approved request. */
export async function adminReplace({ actor, registrationId, replacementMemberId, reason, riId = null }) {
  const why = cleanReason(reason); if (!why) return fail(400, 'reason_required', 'A reason is required (up to 500 characters).')
  try {
    return await tx(async (c) => {
      const settings = await settingsOn(c)
      const [reg] = await lockRegistrations(c, [registrationId])
      if (!reg) return fail(404, 'registration_not_found', 'Registration not found.')
      if (await hasPendingChange(c, [reg.id])) return fail(409, 'request_pending', 'A request is pending for this player. Decide it first.')
      const target = await checkReplacementTarget(c, { reg, replacementMemberId, riId, settings })
      if (!target.ok) return target
      await applyReplacement(c, reg, target)
      const row = await insertReplacementRow(c, { reg, replacementMemberId, target, reason: why, link: null, actor, decided: true })
      await audit(c, actor, 'replacement.direct', 'replacement_request', row.id, { registration_id: reg.id, from: reg.member_id, to: replacementMemberId })
      return { ok: true, request: row }
    })
  } catch (e) {
    if (e.stale) return fail(409, 'stale_request', 'The registration changed while processing. Try again.')
    throw e
  }
}

// ================================================================ swaps and moves

/** Can registration `reg` (a player of the club) go to sport `destSportId`? `leaving` = registrations that stop occupying their sport in this change. */
async function checkPlacement(c, { reg, destSportId, leavingIds, settings }) {
  if (destSportId === reg.sport_id) return fail(400, 'same_sport', 'The destination is the sport the player is already in.')
  const { rows: [dest] } = await c.query('SELECT * FROM events WHERE sport_id = $1', [destSportId])
  if (!dest) return fail(404, 'sport_not_found', 'Destination sport not found.')
  const { rows: [club] } = await c.query('SELECT category FROM clubs WHERE club_id = $1', [reg.club_id])
  if (!club || !categoryOk(club.category, dest.category)) return fail(422, 'category_mismatch', `${dest.sport_name} is for ${dest.category} clubs.`)
  const { rows: [player] } = await c.query('SELECT name, gender FROM players WHERE member_id = $1', [reg.member_id])
  if (!player || !eventGenderOk(dest.gender_type, player.gender)) return fail(422, 'gender_mismatch', `${player?.name ?? 'This player'} cannot play ${dest.sport_name} (${dest.gender_type} sport).`)
  const { rows: current } = await c.query('SELECT r.sport_id, e.sport_day, e.limit_group FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = $1', [reg.member_id])
  const lim = checkRegistrationLimits({ existing: current, candidate: { sport_id: dest.sport_id, sport_day: dest.sport_day, limit_group: dest.limit_group }, rules: settings['limits.groups'], ignoreSportIds: [reg.sport_id] })
  if (!lim.ok) return fail(lim.code === 'limits_not_configured' ? 503 : lim.code === 'already_registered' ? 409 : 422, lim.code, `${player.name}: ${lim.message}`)
  const { rows: [counts] } = await c.query(
    `SELECT count(*) FILTER (WHERE main_player)::int AS main, count(*) FILTER (WHERE NOT main_player)::int AS reserve
     FROM registrations WHERE sport_id = $1 AND club_id = $2 AND NOT (id = ANY($3))`, [dest.sport_id, reg.club_id, leavingIds])
  const cap = capacityCheck({ event: dest, counts, mainPlayer: reg.main_player })
  if (!cap.ok) return fail(409, cap.code, `${dest.sport_name}: ${cap.message}`)
  return { ok: true }
}

/** reg2 null = MOVE reg1 to targetSportId; otherwise SWAP the sports of reg1 and reg2. */
async function planChange(c, { reg1, reg2, targetSportId, settings }) {
  const leaving = [reg1.id, reg2?.id ?? -1]
  const first = await checkPlacement(c, { reg: reg1, destSportId: reg2 ? reg2.sport_id : targetSportId, leavingIds: leaving, settings })
  if (!first.ok) return first
  if (reg2) {
    if (reg2.sport_id === reg1.sport_id) return fail(400, 'same_sport', 'Both players are already in the same sport.')
    const second = await checkPlacement(c, { reg: reg2, destSportId: reg1.sport_id, leavingIds: leaving, settings })
    if (!second.ok) return second
  }
  return { ok: true }
}

async function applyChange(c, { reg1, reg2, targetSportId }) {
  const sport2 = reg2 ? reg2.sport_id : targetSportId
  const a = await c.query('UPDATE registrations SET sport_id = $2 WHERE id = $1 AND sport_id = $3', [reg1.id, sport2, reg1.sport_id])
  if (!a.rowCount) throw Object.assign(new Error('stale'), { stale: true })
  if (reg2) {
    const b = await c.query('UPDATE registrations SET sport_id = $2 WHERE id = $1 AND sport_id = $3', [reg2.id, reg1.sport_id, reg2.sport_id])
    if (!b.rowCount) throw Object.assign(new Error('stale'), { stale: true })
  }
  await handBibsOver(c, [reg1.member_id, ...(reg2 ? [reg2.member_id] : [])])   // a number whose player left every bib event moves to the player who took the place
}

async function loadPair(c, { reg1Id, reg2Id }) {
  const ids = [reg1Id, ...(reg2Id ? [reg2Id] : [])]
  const rows = await lockRegistrations(c, ids)
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
  return { reg1: byId[reg1Id], reg2: reg2Id ? byId[reg2Id] : null, ok: rows.length === ids.length }
}

async function insertSwapRow(c, { reg1, reg2, targetSportId, description, actor, decided }) {
  const { rows: [row] } = await c.query(
    `INSERT INTO swap_requests (club_id, reg1_id, reg2_id, sport1_id, sport2_id, description, status, requested_by, decided_by, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [reg1.club_id, reg1.id, reg2?.id ?? null, reg1.sport_id, reg2 ? reg2.sport_id : targetSportId, description, decided ? 1 : 0, actor.member_id, decided ? actor.member_id : null, decided ? new Date() : null])
  return row
}

async function preflightSwap(c, { clubId, reg1Id, reg2Id, targetSportId }) {
  if (reg2Id && reg2Id === reg1Id) return fail(400, 'same_registration', 'Choose two different registrations.')
  if (!reg2Id && !targetSportId) return fail(400, 'invalid_request', 'Choose a second player or a destination sport.')
  const pair = await loadPair(c, { reg1Id, reg2Id })
  if (!pair.ok) return fail(404, 'registration_not_found', 'Registration not found.')
  const { reg1, reg2 } = pair
  if (clubId != null && (reg1.club_id !== clubId || (reg2 && reg2.club_id !== clubId))) return fail(403, 'forbidden', 'These registrations belong to another club.')
  if (reg2 && reg2.club_id !== reg1.club_id) return fail(409, 'different_clubs', 'Swaps are only possible inside one club.')
  if (reg2 && reg2.member_id === reg1.member_id) return fail(400, 'same_player', 'Choose two different players.')
  if (await hasPendingChange(c, [reg1.id, ...(reg2 ? [reg2.id] : [])])) return fail(409, 'request_pending', 'A request is already pending for one of these players.')
  return { ok: true, reg1, reg2 }
}

export async function createSwapRequest({ actor, clubId, reg1Id, reg2Id = null, targetSportId = null, description, now = new Date() }) {
  const why = cleanReason(description); if (!why) return fail(400, 'reason_required', 'A reason is required (up to 500 characters).')
  try {
    return await tx(async (c) => {
      const settings = await settingsOn(c)
      const win = changesWindow({ openAt: settings['replacement.open_at'], closeAt: settings['replacement.close_at'], now })
      if (!win.open) return fail(403, win.code, win.message)
      const pre = await preflightSwap(c, { clubId, reg1Id, reg2Id, targetSportId })
      if (!pre.ok) return pre
      const plan = await planChange(c, { reg1: pre.reg1, reg2: pre.reg2, targetSportId, settings })
      if (!plan.ok) return plan
      const row = await insertSwapRow(c, { reg1: pre.reg1, reg2: pre.reg2, targetSportId, description: why, actor })
      await audit(c, actor, pre.reg2 ? 'swap.request' : 'move.request', 'swap_request', row.id, { reg1: pre.reg1.id, reg2: pre.reg2?.id ?? null, to: row.sport2_id })
      return { ok: true, request: row }
    })
  } catch (e) {
    if (e.code === '23505') return fail(409, 'request_pending', 'A request is already pending for one of these players.')
    throw e
  }
}

export async function decideSwap({ actor, id, approve }) {
  try {
    return await tx(async (c) => {
      const { rows: [req] } = await c.query('SELECT * FROM swap_requests WHERE id = $1 FOR UPDATE', [id])
      if (!req) return fail(404, 'request_not_found', 'Request not found.')
      if (req.status !== 0) return fail(409, 'already_decided', `This request was already ${req.status === 1 ? 'approved' : 'rejected'}.`)
      if (approve) {
        const settings = await settingsOn(c)
        const pair = await loadPair(c, { reg1Id: req.reg1_id, reg2Id: req.reg2_id })
        if (!pair.ok || pair.reg1.sport_id !== req.sport1_id || (pair.reg2 && pair.reg2.sport_id !== req.sport2_id)) {
          return fail(409, 'stale_request', 'The registrations have changed since this request was made. Reject it and ask the club to submit it again.')
        }
        const plan = await planChange(c, { reg1: pair.reg1, reg2: pair.reg2, targetSportId: req.sport2_id, settings })
        if (!plan.ok) return plan
        await applyChange(c, { reg1: pair.reg1, reg2: pair.reg2, targetSportId: req.sport2_id })
      }
      await c.query('UPDATE swap_requests SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1', [id, approve ? 1 : 2, actor.member_id])
      await audit(c, actor, `${req.reg2_id ? 'swap' : 'move'}.${approve ? 'approve' : 'reject'}`, 'swap_request', id, { reg1: req.reg1_id, reg2: req.reg2_id, to: req.sport2_id })
      return { ok: true }
    })
  } catch (e) {
    if (e.stale) return fail(409, 'stale_request', 'The registrations changed while processing.')
    throw e
  }
}

/** Admin swap/move done directly: validated like a request, applied at once, recorded as approved. */
export async function adminSwapOrMove({ actor, clubId = null, reg1Id, reg2Id = null, targetSportId = null, reason }) {
  const why = cleanReason(reason); if (!why) return fail(400, 'reason_required', 'A reason is required (up to 500 characters).')
  try {
    return await tx(async (c) => {
      const settings = await settingsOn(c)
      const pre = await preflightSwap(c, { clubId, reg1Id, reg2Id, targetSportId })
      if (!pre.ok) return pre
      const plan = await planChange(c, { reg1: pre.reg1, reg2: pre.reg2, targetSportId, settings })
      if (!plan.ok) return plan
      await applyChange(c, { reg1: pre.reg1, reg2: pre.reg2, targetSportId })
      const row = await insertSwapRow(c, { reg1: pre.reg1, reg2: pre.reg2, targetSportId, description: why, actor, decided: true })
      await audit(c, actor, pre.reg2 ? 'swap.direct' : 'move.direct', 'swap_request', row.id, { reg1: pre.reg1.id, reg2: pre.reg2?.id ?? null, to: row.sport2_id })
      return { ok: true, request: row }
    })
  } catch (e) {
    if (e.stale) return fail(409, 'stale_request', 'The registrations changed while processing. Try again.')
    throw e
  }
}

// ================================================================ reads

const PLAYER_JOIN = 'JOIN players p ON p.member_id = r.member_id'

/** Everything the club pages need: its registrations, its requests, the sports it can move to, and the window. */
export async function clubContext({ clubId, now = new Date() }) {
  const settings = await settingsOn({ query })
  const win = changesWindow({ openAt: settings['replacement.open_at'], closeAt: settings['replacement.close_at'], now })
  const [regs, reps, swaps, club] = await Promise.all([
    query(`SELECT r.id, r.member_id, r.sport_id, r.club_id, r.main_player, p.name AS player_name, p.status AS player_status, p.gender AS player_gender,
                  p.membership_id, p.ri_id, e.sport_name, e.sport_day, e.sport_type, e.gender_type, e.limit_group,
                  (EXISTS (SELECT 1 FROM replacement_requests q WHERE q.registration_id = r.id AND q.status = 0)
                   OR EXISTS (SELECT 1 FROM swap_requests s WHERE s.status = 0 AND (s.reg1_id = r.id OR s.reg2_id = r.id))) AS has_pending
           FROM registrations r ${PLAYER_JOIN} JOIN events e USING (sport_id) WHERE r.club_id = $1 ORDER BY e.sport_day, e.sport_name, p.name`, [clubId]),
    query(`SELECT q.id, q.status, q.registration_id, q.sport_id, e.sport_name, q.original_member_id, po.name AS original_name,
                  q.replacement_member_id, q.rep_name, q.rep_status, q.rep_ri_id, q.rep_membership_id, q.reason, q.supporting_link, q.created_at, q.decided_at
           FROM replacement_requests q JOIN events e USING (sport_id) LEFT JOIN players po ON po.member_id = q.original_member_id
           WHERE q.club_id = $1 ORDER BY q.created_at DESC, q.id DESC`, [clubId]),
    query(`SELECT s.id, s.status, s.reg1_id, s.reg2_id, s.sport1_id, s.sport2_id, e1.sport_name AS sport1_name, e2.sport_name AS sport2_name,
                  p1.name AS player1_name, p2.name AS player2_name, s.description, s.created_at, s.decided_at
           FROM swap_requests s JOIN events e1 ON e1.sport_id = s.sport1_id JOIN events e2 ON e2.sport_id = s.sport2_id
           JOIN registrations r1 ON r1.id = s.reg1_id JOIN players p1 ON p1.member_id = r1.member_id
           LEFT JOIN registrations r2 ON r2.id = s.reg2_id LEFT JOIN players p2 ON p2.member_id = r2.member_id
           WHERE s.club_id = $1 ORDER BY s.created_at DESC, s.id DESC`, [clubId]),
    query('SELECT category FROM clubs WHERE club_id = $1', [clubId]),
  ])
  const { rows: events } = club.rows[0]
    ? await query('SELECT sport_id, sport_name, sport_day, sport_type, gender_type, max_count, reserve_count FROM events WHERE category = $1 ORDER BY sport_day, sport_name', [club.rows[0].category])
    : { rows: [] }
  return { registrations: regs.rows, replacements: reps.rows, swaps: swaps.rows.map((s) => ({ ...s, kind: s.reg2_id ? 'swap' : 'move' })), events,
           window: { open: win.open, code: win.code ?? null, message: win.message ?? null, openAt: settings['replacement.open_at'] ?? null, closeAt: settings['replacement.close_at'] ?? null } }
}

const TAB_STATUS = { pending: 0, approved: 1, rejected: 2 }
const like = (s) => (s ? `%${String(s).replace(/[\\%_]/g, '\\$&')}%` : null)

export async function listReplacementsAdmin({ tab = 'pending', page = 1, limit = 10, search = '' }) {
  const st = TAB_STATUS[tab] ?? 0
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 100), pg = Math.max(Number(page) || 1, 1), pat = like(search)
  const where = `q.status = $1 AND ($2::text IS NULL OR c.club_name ILIKE $2 OR e.sport_name ILIKE $2 OR q.rep_name ILIKE $2 OR po.name ILIKE $2)`
  const base = `FROM replacement_requests q JOIN clubs c USING (club_id) JOIN events e ON e.sport_id = q.sport_id LEFT JOIN players po ON po.member_id = q.original_member_id WHERE ${where}`
  const [{ rows }, { rows: [{ total }] }, { rows: counts }] = await Promise.all([
    query(`SELECT q.id, q.status, q.club_id, c.club_name, q.sport_id, e.sport_name, e.sport_day, q.registration_id, q.original_member_id, po.name AS original_name,
                  q.replacement_member_id, q.rep_name, q.rep_status, q.rep_ri_id, q.reason, q.supporting_link, q.created_at, q.decided_at, q.decided_by ${base}
           ORDER BY q.created_at DESC, q.id DESC LIMIT $3 OFFSET $4`, [st, pat, lim, (pg - 1) * lim]),
    query(`SELECT count(*)::int AS total ${base}`, [st, pat]),
    query('SELECT status, count(*)::int AS n FROM replacement_requests GROUP BY status'),
  ])
  return { requests: rows, totalCount: total, totalPages: Math.ceil(total / lim), currentPage: pg, counts: { pending: counts.find((x) => x.status === 0)?.n ?? 0, approved: counts.find((x) => x.status === 1)?.n ?? 0, rejected: counts.find((x) => x.status === 2)?.n ?? 0 } }
}

export async function getReplacementAdmin(id) {
  const { rows: [q] } = await query(
    `SELECT q.*, c.club_name, c.category AS club_category, e.sport_name, e.sport_day, e.sport_type, e.gender_type,
            po.name AS original_name, po.nic AS original_nic, po.status AS original_status, po.gender AS original_gender, po.ri_id AS original_ri_id, po.membership_id AS original_membership_id,
            r.member_id AS current_holder_member_id
     FROM replacement_requests q JOIN clubs c USING (club_id) JOIN events e ON e.sport_id = q.sport_id
     LEFT JOIN players po ON po.member_id = q.original_member_id LEFT JOIN registrations r ON r.id = q.registration_id WHERE q.id = $1`, [id])
  if (!q) return null
  const { rows: [m] } = await query('SELECT status, club_id, card_name FROM rmis_members WHERE member_id = $1', [q.replacement_member_id])
  return { ...q, replacement_rmis_status: m?.status ?? null, replacement_rmis_club_id: m?.club_id ?? null, still_applicable: q.status !== 0 || q.current_holder_member_id === q.original_member_id }
}

export async function listSwapsAdmin({ tab = 'pending', page = 1, limit = 10, search = '' }) {
  const st = TAB_STATUS[tab] ?? 0
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 100), pg = Math.max(Number(page) || 1, 1), pat = like(search)
  const base = `FROM swap_requests s JOIN clubs c USING (club_id) JOIN events e1 ON e1.sport_id = s.sport1_id JOIN events e2 ON e2.sport_id = s.sport2_id
                JOIN registrations r1 ON r1.id = s.reg1_id JOIN players p1 ON p1.member_id = r1.member_id
                LEFT JOIN registrations r2 ON r2.id = s.reg2_id LEFT JOIN players p2 ON p2.member_id = r2.member_id
                WHERE s.status = $1 AND ($2::text IS NULL OR c.club_name ILIKE $2 OR p1.name ILIKE $2 OR p2.name ILIKE $2 OR e1.sport_name ILIKE $2 OR e2.sport_name ILIKE $2)`
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(`SELECT s.id, s.status, s.club_id, c.club_name, s.reg1_id, s.reg2_id, s.sport1_id, s.sport2_id, e1.sport_name AS sport1_name, e2.sport_name AS sport2_name,
                  p1.name AS player1_name, p2.name AS player2_name, s.description, s.created_at, s.decided_at, s.decided_by,
                  (s.reg1_id IS NOT NULL AND s.reg2_id IS NULL) AS is_move ${base} ORDER BY s.created_at DESC, s.id DESC LIMIT $3 OFFSET $4`, [st, pat, lim, (pg - 1) * lim]),
    query(`SELECT count(*)::int AS total ${base}`, [st, pat]),
  ])
  return { requests: rows, totalCount: total, totalPages: Math.ceil(total / lim), currentPage: pg }
}
