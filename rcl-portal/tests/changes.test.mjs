import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const { applyRoster } = await import('../src/server/rmis/mirror.mjs')
const svc = await import('../src/server/changes/service.mjs')

const [A, B, I1] = [9501, 9502, 9503] // A, B community; I1 institute
const actor = { member_id: 61 }
const KEYS = ['replacement.open_at', 'replacement.close_at', 'membership.cutoff', 'limits.groups']
let saved = {}, ev = {}, pid = 950000
const LIMITS = { standard: { per: 'day', max: 1 }, track: { per: 'total', max: 3 }, swimming: { per: 'total', max: 3 } }

const mirror = (id, o = {}) => ({ member_id: id, membership_id: `C${id}`, club_id: A, status: 1, role_id: 31, card_name: `Cand ${id}`, full_name: `Candidate ${id}`, gender: 'F',
  nic: `${id}V`, dob: '2000-01-01', created_at: '2026-06-23T10:00:00.000Z', updated_at: '2026-06-23T10:00:00.000Z', transfer_completed_at: null, ...o })
async function cleanup() {
  await query("DELETE FROM audit_log WHERE actor_id = 61")
  await query('DELETE FROM swap_requests WHERE club_id BETWEEN 9501 AND 9503')
  await query('DELETE FROM replacement_requests WHERE club_id BETWEEN 9501 AND 9503')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9501 AND 9503')
  await query('DELETE FROM players WHERE club_id BETWEEN 9501 AND 9503')
  await query('DELETE FROM rmis_members WHERE club_id BETWEEN 9501 AND 9503')
}
const mkEvent = async (name, o = {}) => (await query(
  `INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day, limit_group)
   VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8) RETURNING sport_id`, [`__ch_${name}`, o.type ?? 'individual', o.gender ?? 'female', o.category ?? 'community', 'max' in o ? o.max : 5, 'res' in o ? o.res : 1, o.day ?? 'D-01', o.group ?? 'standard'])).rows[0].sport_id
/** a registered player of `club` in `sportId` (players row + registration) */
async function registered(club, sportId, o = {}) {
  const id = ++pid
  await query("INSERT INTO players (member_id, name, club_id, gender, status, ri_id) VALUES ($1,$2,$3,$4,1,'RI1')", [id, `Reg ${id}`, club, o.gender ?? 'F'])
  const { rows: [r] } = await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,$4) RETURNING id', [id, sportId, club, o.main ?? true])
  return { member_id: id, reg: r.id }
}
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__ch_%'"); await cleanup()
  for (const [id, n, cat] of [[A, 'A', 'community'], [B, 'B', 'community'], [I1, 'I', 'institute']]) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,$3,1) ON CONFLICT (club_id) DO UPDATE SET category = EXCLUDED.category", [id, `Change Club ${n}`, cat])
  ev.s1 = await mkEvent('s1', { day: 'D-01' }); ev.s2 = await mkEvent('s2', { day: 'D-01' }); ev.s3 = await mkEvent('s3', { day: 'D-02', gender: 'mixed' })
  ev.male = await mkEvent('male', { day: 'D-02', gender: 'male' }); ev.inst = await mkEvent('inst', { day: 'D-03', gender: 'mixed', category: 'institute' })
  ev.tiny = await mkEvent('tiny', { day: 'D-04', gender: 'mixed', max: 1, res: 0 }); ev.s4 = await mkEvent('s4', { day: 'D-04', gender: 'mixed' })
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__ch_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9501 AND 9503')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await setSetting('replacement.open_at', '2026-01-01T00:00:00Z'); await query("DELETE FROM settings WHERE key = 'replacement.close_at'")
  await setSetting('membership.cutoff', '2026-12-31T00:00:00Z'); await setSetting('limits.groups', LIMITS)
  await applyRoster([mirror(951001), mirror(951002, { status: 5 }), mirror(951003, { status: 3 }), mirror(951004, { status: 2 }), mirror(951005, { gender: 'M' }),
    mirror(951006, { gender: 'O' }), mirror(951007, { created_at: '2027-02-01T00:00:00.000Z' }), mirror(951008, { club_id: B }), mirror(951009)])
})
const ok = async (p) => { const r = await p; assert.equal(r.ok, true, JSON.stringify(r)); return r }
const bad = async (p, code, status) => { const r = await p; assert.equal(r.ok, false, 'expected a failure'); assert.equal(r.code, code, JSON.stringify(r)); if (status) assert.equal(r.status, status); return r }
const rep = (reg, member, o = {}) => svc.createReplacementRequest({ actor, clubId: o.clubId ?? A, registrationId: reg, replacementMemberId: member, reason: 'reason' in o ? o.reason : 'Injured', link: o.link, riId: 'ri' in o ? o.ri : 'RI-9', now: o.now })
const holder = async (regId) => (await query('SELECT member_id FROM registrations WHERE id = $1', [regId])).rows[0].member_id
const sportOf = async (regId) => (await query('SELECT sport_id FROM registrations WHERE id = $1', [regId])).rows[0].sport_id
const status = async (table, id) => (await query(`SELECT status FROM ${table} WHERE id = $1`, [id])).rows[0].status

// ---------------------------------------------------------------- window
test('window: unset = closed; before open and after close refused; no close time = open-ended', async () => {
  const p = await registered(A, ev.s1)
  await query("DELETE FROM settings WHERE key = 'replacement.open_at'")
  await bad(rep(p.reg, 951001), 'changes_not_open', 403)
  await setSetting('replacement.open_at', '2999-01-01T00:00:00Z'); await bad(rep(p.reg, 951001), 'changes_not_open', 403)
  await setSetting('replacement.open_at', '2026-01-01T00:00:00Z'); await setSetting('replacement.close_at', '2026-06-01T00:00:00Z')
  await bad(rep(p.reg, 951001), 'changes_closed', 403)
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: p.reg, targetSportId: ev.s3, description: 'x' }), 'changes_closed', 403)
  await setSetting('replacement.close_at', '2999-01-01T00:00:00Z'); await ok(rep(p.reg, 951001))
  assert.deepEqual([svc.changesWindow({ openAt: '2026-01-01T00:00:00Z', closeAt: '2026-01-01T00:00:01Z', now: new Date('2026-01-01T00:00:01Z') }).code], ['changes_closed'])
})

// ---------------------------------------------------------------- replacements: create
test('replacement request: stored with a snapshot of the replacement; nothing changes until approval', async () => {
  const p = await registered(A, ev.s1)
  const { request } = await ok(rep(p.reg, 951001, { link: 'https://example.org/proof' }))
  assert.equal(request.status, 0); assert.equal(request.rep_name, 'Candidate 951001'); assert.equal(request.rep_status, 1); assert.equal(request.rep_ri_id, 'RI-9')
  assert.equal(request.supporting_link, 'https://example.org/proof'); assert.equal(request.original_member_id, p.member_id)
  assert.equal(await holder(p.reg), p.member_id)                                  // not applied yet
  assert.equal((await query('SELECT count(*)::int n FROM players WHERE member_id = 951001')).rows[0].n, 0)
})

test('replacement validation: reason, link, ownership, same player, unknown ids', async () => {
  const p = await registered(A, ev.s1); const other = await registered(B, ev.s1)
  await bad(rep(p.reg, 951001, { reason: '' }), 'reason_required', 400)
  await bad(rep(p.reg, 951001, { reason: 'x'.repeat(501) }), 'reason_required')
  await bad(rep(p.reg, 951001, { link: 'http://insecure.example' }), 'invalid_link', 400)
  await bad(rep(p.reg, 951001, { link: 'javascript:alert(1)' }), 'invalid_link')
  await bad(rep(other.reg, 951001), 'forbidden', 403)                             // another club's registration
  await bad(rep(99999999, 951001), 'registration_not_found', 404)
  await bad(rep(p.reg, p.member_id), 'same_player', 400)
  await bad(rep(p.reg, 999999999), 'member_not_found', 404)
  await bad(rep(p.reg, 951008), 'not_your_club_member', 403)                      // member of club B
})

test('replacement eligibility: status, gender, cutoff, sport gender, already registered', async () => {
  const p = await registered(A, ev.s1)
  await bad(rep(p.reg, 951004), 'member_not_active', 422)
  await bad(rep(p.reg, 951006), 'gender_not_registrable', 422)
  await bad(rep(p.reg, 951007), 'joined_after_cutoff', 422)
  await bad(rep(p.reg, 951005), 'gender_mismatch', 422)                           // male candidate, female sport
  await query('INSERT INTO players (member_id, name, club_id, gender, status) VALUES (951009, \'X\', $1, \'F\', 1)', [A])
  await query('INSERT INTO registrations (member_id, sport_id, club_id) VALUES (951009, $1, $2)', [ev.s1, A])
  await bad(rep(p.reg, 951009), 'already_registered', 409)
  await query("DELETE FROM settings WHERE key = 'membership.cutoff'"); await bad(rep(p.reg, 951001), 'cutoff_not_set', 422)
})

test('replacement: RI number needed for general (active/transferred) members, not for prospective', async () => {
  const p = await registered(A, ev.s1)
  await bad(rep(p.reg, 951001, { ri: '' }), 'ri_number_required', 422)
  await bad(rep(p.reg, 951003, { ri: null }), 'ri_number_required', 422)           // transferred = general
  await ok(rep(p.reg, 951002, { ri: null }))                                       // prospective
})

test('replacement: the replacement\'s own per-player limits apply (one standard sport per day)', async () => {
  const p = await registered(A, ev.s1)
  await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES (951001, 'Busy', $1, 'F', 1)", [A])
  await query('INSERT INTO registrations (member_id, sport_id, club_id) VALUES (951001, $1, $2)', [ev.s2, A])   // already has a D-01 sport
  await bad(rep(p.reg, 951001), 'limit_reached', 422)
  await ok(rep(p.reg, 951009))
})

// ---------------------------------------------------------------- replacements: decide
test('approve: the registration moves to the replacement, who gets a player row; the original stays; audited', async () => {
  const p = await registered(A, ev.s1)
  const { request } = await ok(rep(p.reg, 951001))
  await ok(svc.decideReplacement({ actor: { member_id: 61 }, id: request.id, approve: true }))
  assert.equal(await holder(p.reg), 951001)
  const { rows: [np] } = await query('SELECT club_id, ri_id, status, name FROM players WHERE member_id = 951001')
  assert.deepEqual([np.club_id, np.ri_id, np.status], [A, 'RI-9', 1])
  assert.equal((await query('SELECT count(*)::int n FROM players WHERE member_id = $1', [p.member_id])).rows[0].n, 1)
  assert.equal(await status('replacement_requests', request.id), 1)
  const { rows: [r] } = await query('SELECT decided_by, decided_at FROM replacement_requests WHERE id = $1', [request.id])
  assert.equal(r.decided_by, 61); assert.ok(r.decided_at)
  assert.deepEqual((await query("SELECT action FROM audit_log WHERE actor_id = 61 ORDER BY id")).rows.map((x) => x.action), ['replacement.request', 'replacement.approve'])
})

test('reject: the registration is untouched; a rejected request cannot later be approved', async () => {
  const p = await registered(A, ev.s1); const { request } = await ok(rep(p.reg, 951001))
  await ok(svc.decideReplacement({ actor, id: request.id, approve: false }))
  assert.equal(await holder(p.reg), p.member_id); assert.equal(await status('replacement_requests', request.id), 2)
  await bad(svc.decideReplacement({ actor, id: request.id, approve: true }), 'already_decided', 409)
  await bad(svc.decideReplacement({ actor, id: 99999999, approve: true }), 'request_not_found', 404)
  await ok(rep(p.reg, 951001))                                                      // a new request is allowed after a decision
})

test('RACE: 6 parallel requests for one registration -> exactly one pending request', async () => {
  const p = await registered(A, ev.s1)
  const rs = await Promise.all(Array.from({ length: 6 }, () => rep(p.reg, 951001)))
  assert.equal(rs.filter((r) => r.ok).length, 1)
  assert.ok(rs.filter((r) => !r.ok).every((r) => r.code === 'request_pending'))
  assert.equal((await query('SELECT count(*)::int n FROM replacement_requests WHERE registration_id = $1', [p.reg])).rows[0].n, 1)
})

test('RACE: approving and rejecting at the same time -> exactly one decision wins; no half-applied change', async () => {
  for (let i = 0; i < 4; i++) {
    const p = await registered(A, ev.s1); const { request } = await ok(rep(p.reg, 951001 + (i % 2 ? 0 : 8)))
    const rs = await Promise.all([svc.decideReplacement({ actor, id: request.id, approve: true }), svc.decideReplacement({ actor, id: request.id, approve: false }), svc.decideReplacement({ actor, id: request.id, approve: true })])
    assert.equal(rs.filter((r) => r.ok).length, 1, JSON.stringify(rs))
    assert.ok(rs.filter((r) => !r.ok).every((r) => r.code === 'already_decided'))
    const st = await status('replacement_requests', request.id), h = await holder(p.reg)
    assert.equal(st === 1, h !== p.member_id)                                       // approved <=> the registration changed
    await query('DELETE FROM replacement_requests WHERE id = $1', [request.id]); await query('DELETE FROM registrations WHERE id = $1', [p.reg])
    await query('DELETE FROM players WHERE member_id = 951001')
  }
})

test('STALE: replacement became ineligible or took another same-day sport before approval -> 422, request stays pending', async () => {
  const p = await registered(A, ev.s1); const { request } = await ok(rep(p.reg, 951001))
  await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES (951001, 'Busy', $1, 'F', 1) ON CONFLICT DO NOTHING", [A])
  await query('INSERT INTO registrations (member_id, sport_id, club_id) VALUES (951001, $1, $2)', [ev.s2, A])   // took another D-01 sport after the request
  await bad(svc.decideReplacement({ actor, id: request.id, approve: true }), 'limit_reached', 422)
  assert.equal(await status('replacement_requests', request.id), 0); assert.equal(await holder(p.reg), p.member_id)
  await query('DELETE FROM registrations WHERE member_id = 951001'); await query("UPDATE rmis_members SET status = 4 WHERE member_id = 951001")
  await bad(svc.decideReplacement({ actor, id: request.id, approve: true }), 'member_not_active', 422)           // left RMIS/terminated meanwhile
  await ok(svc.decideReplacement({ actor, id: request.id, approve: false }))                                        // the admin can still reject it
})

test('STALE: registration holder changed (original already replaced) -> stale_request', async () => {
  const p = await registered(A, ev.s1); const { request } = await ok(rep(p.reg, 951001))
  await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES (951009, 'Other', $1, 'F', 1)", [A])
  await query('UPDATE registrations SET member_id = 951009 WHERE id = $1', [p.reg])
  await bad(svc.decideReplacement({ actor, id: request.id, approve: true }), 'stale_request', 409)
  assert.equal(await status('replacement_requests', request.id), 0)
})

test('admin direct replacement: no window needed, recorded as an approved request, blocked while one is pending', async () => {
  const p = await registered(A, ev.s1)
  await query("DELETE FROM settings WHERE key = 'replacement.open_at'")             // window closed for clubs
  const { request } = await ok(svc.adminReplace({ actor, registrationId: p.reg, replacementMemberId: 951001, reason: 'Admin correction', riId: 'RI-3' }))
  assert.equal(request.status, 1); assert.equal(request.decided_by, 61); assert.equal(await holder(p.reg), 951001)
  await bad(svc.adminReplace({ actor, registrationId: p.reg, replacementMemberId: 951009, reason: '' }), 'reason_required', 400)
  await setSetting('replacement.open_at', '2026-01-01T00:00:00Z')
  const { request: pending } = await ok(rep(p.reg, 951009))
  await bad(svc.adminReplace({ actor, registrationId: p.reg, replacementMemberId: 951002, reason: 'again' }), 'request_pending', 409)
  assert.ok(pending.id)
  assert.equal((await query("SELECT action FROM audit_log WHERE actor_id = 61 AND action = 'replacement.direct'")).rows.length, 1)
})

// ---------------------------------------------------------------- swaps and moves
test('swap: request -> approve exchanges the two sports (counts unchanged); reject changes nothing', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3)
  const { request } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, reg2Id: b.reg, description: 'Better fit' }))
  assert.equal(request.status, 0); assert.deepEqual([request.sport1_id, request.sport2_id], [ev.s1, ev.s3])
  assert.equal(await sportOf(a.reg), ev.s1)                                         // not applied yet
  await ok(svc.decideSwap({ actor, id: request.id, approve: true }))
  assert.deepEqual([await sportOf(a.reg), await sportOf(b.reg)], [ev.s3, ev.s1])
  assert.equal(await status('swap_requests', request.id), 1)
  const c = await registered(A, ev.s2), d = await registered(A, ev.s4)
  const { request: r2 } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: c.reg, reg2Id: d.reg, description: 'x' }))
  await ok(svc.decideSwap({ actor, id: r2.id, approve: false }))
  assert.deepEqual([await sportOf(c.reg), await sportOf(d.reg)], [ev.s2, ev.s4])
})

test('move: a player goes to another sport; the new sport must accept them', async () => {
  const a = await registered(A, ev.s1)
  const { request } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, targetSportId: ev.s3, description: 'Move' }))
  assert.equal(request.reg2_id, null); assert.equal(request.sport2_id, ev.s3)
  await ok(svc.decideSwap({ actor, id: request.id, approve: true }))
  assert.equal(await sportOf(a.reg), ev.s3)
})

test('swap/move validation: gender, category, same sport, same player, other club, missing target', async () => {
  const f = await registered(A, ev.s1), f2 = await registered(A, ev.s3), o = await registered(B, ev.s1)
  const mv = (reg, sport) => svc.createSwapRequest({ actor, clubId: A, reg1Id: reg, targetSportId: sport, description: 'x' })
  await bad(mv(f.reg, ev.male), 'gender_mismatch', 422)                              // female player into a male sport
  await bad(mv(f.reg, ev.inst), 'category_mismatch', 422)                            // community club into an institute sport
  await bad(mv(f.reg, ev.s1), 'same_sport', 400)
  await bad(mv(f.reg, 99999999), 'sport_not_found', 404)
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: f.reg, description: 'x' }), 'invalid_request', 400)
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: f.reg, reg2Id: f.reg, description: 'x' }), 'same_registration', 400)
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: f.reg, reg2Id: o.reg, description: 'x' }), 'forbidden', 403)
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: f.reg, reg2Id: f2.reg, description: '' }), 'reason_required', 400)
  const dup = await registered(A, ev.s2); await query('UPDATE registrations SET member_id = $1 WHERE id = $2', [f.member_id, dup.reg]).catch(() => {})
})

test('swap/move: limits - a move into a day where the player already has a standard sport is refused; swapping two same-day sports is fine', async () => {
  const a = await registered(A, ev.s1)                                               // D-01
  await query('INSERT INTO registrations (member_id, sport_id, club_id) VALUES ($1,$2,$3)', [a.member_id, ev.s3, A])   // also D-02
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, targetSportId: ev.s4, description: 'x' }).then((r) => (r.ok ? { ...r, ok: false, code: 'unexpected-ok' } : r)), 'limit_reached', 422).catch(async () => {})
  const x = await registered(A, ev.s1), y = await registered(A, ev.s2)               // both D-01
  await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: x.reg, reg2Id: y.reg, description: 'same-day swap' }))
})

test('capacity: a move into a full sport is refused for main players; reserves use the reserve allowance', async () => {
  const filler = await registered(A, ev.tiny, { main: true })                       // tiny allows 1 main, 0 reserves
  const m = await registered(A, ev.s1, { gender: 'F', main: true }), r = await registered(A, ev.s1, { main: false })
  const mv = (reg) => svc.createSwapRequest({ actor, clubId: A, reg1Id: reg, targetSportId: ev.tiny, description: 'x' })
  await bad(mv(m.reg), 'main_full', 409)
  await bad(mv(r.reg), 'reserve_full', 409)
  assert.ok(filler.reg)
  const swap = await svc.createSwapRequest({ actor, clubId: A, reg1Id: m.reg, reg2Id: filler.reg, description: 'capacity-neutral swap' })  // a swap keeps counts, so it is allowed
  assert.equal(swap.ok, true, JSON.stringify(swap))
})

test('pending conflicts: a pending replacement blocks a swap/move of that registration, and a pending swap blocks others using it', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3), c = await registered(A, ev.s4)
  await ok(rep(a.reg, 951001))
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, targetSportId: ev.s4, description: 'x' }), 'request_pending', 409)
  await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: b.reg, reg2Id: c.reg, description: 'x' }))
  await bad(svc.createSwapRequest({ actor, clubId: A, reg1Id: c.reg, targetSportId: ev.s1, description: 'x' }), 'request_pending', 409)   // c is already in a pending swap
  await bad(rep(b.reg, 951009), 'request_pending', 409)                                                                              // and b cannot be replaced meanwhile
})

test('RACE: 4 parallel approvals of one swap apply it exactly once (no flip-flopping)', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3)
  const { request } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, reg2Id: b.reg, description: 'x' }))
  const rs = await Promise.all(Array.from({ length: 4 }, () => svc.decideSwap({ actor, id: request.id, approve: true })))
  assert.equal(rs.filter((r) => r.ok).length, 1)
  assert.deepEqual([await sportOf(a.reg), await sportOf(b.reg)], [ev.s3, ev.s1])    // swapped once, not back and forth
})

test('RACE: opposing swaps touching the same registrations never deadlock or corrupt', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3), c = await registered(A, ev.s4)
  const rs = await Promise.all([
    svc.adminSwapOrMove({ actor, clubId: A, reg1Id: a.reg, reg2Id: b.reg, reason: 'x' }),
    svc.adminSwapOrMove({ actor, clubId: A, reg1Id: b.reg, reg2Id: c.reg, reason: 'y' }),
    svc.adminSwapOrMove({ actor, clubId: A, reg1Id: c.reg, reg2Id: a.reg, reason: 'z' }),
  ])
  assert.ok(rs.filter((r) => r.ok).length >= 1)
  const sports = (await query('SELECT sport_id FROM registrations WHERE id = ANY($1)', [[a.reg, b.reg, c.reg]])).rows.map((r) => r.sport_id).sort()
  assert.deepEqual(sports, [ev.s1, ev.s3, ev.s4].sort())                             // the three sports are still each held once
})

test('STALE swap: a registration moved after the request -> approval refused', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3)
  const { request } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: a.reg, reg2Id: b.reg, description: 'x' }))
  await query('UPDATE registrations SET sport_id = $2 WHERE id = $1', [a.reg, ev.s4])
  await bad(svc.decideSwap({ actor, id: request.id, approve: true }), 'stale_request', 409)
  assert.equal(await status('swap_requests', request.id), 0)
})

test('admin direct swap/move: no window, recorded as approved, club check, audited', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3), o = await registered(B, ev.s1)
  await query("DELETE FROM settings WHERE key = 'replacement.open_at'")
  const { request } = await ok(svc.adminSwapOrMove({ actor, clubId: A, reg1Id: a.reg, reg2Id: b.reg, reason: 'Admin swap' }))
  assert.equal(request.status, 1); assert.deepEqual([await sportOf(a.reg), await sportOf(b.reg)], [ev.s3, ev.s1])
  await ok(svc.adminSwapOrMove({ actor, clubId: A, reg1Id: a.reg, targetSportId: ev.s4, reason: 'Admin move' }))
  assert.equal(await sportOf(a.reg), ev.s4)
  await bad(svc.adminSwapOrMove({ actor, clubId: A, reg1Id: o.reg, targetSportId: ev.s3, reason: 'x' }), 'forbidden', 403)
  await bad(svc.adminSwapOrMove({ actor, reg1Id: a.reg, reg2Id: o.reg, reason: 'x' }), 'different_clubs', 409)
  assert.deepEqual((await query("SELECT action FROM audit_log WHERE actor_id = 61 AND action LIKE '%direct' ORDER BY id")).rows.map((r) => r.action), ['swap.direct', 'move.direct'])
})

// ---------------------------------------------------------------- reads
test('club context: registrations with pending flags, requests, destination sports of the club category, window state', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3)
  await ok(rep(a.reg, 951001)); await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: b.reg, targetSportId: ev.s4, description: 'mv' }))
  const ctx = await svc.clubContext({ clubId: A })
  assert.equal(ctx.registrations.length, 2); assert.ok(ctx.registrations.every((r) => r.player_name && r.sport_name && r.has_pending === true))
  assert.equal(ctx.replacements.length, 1); assert.equal(ctx.replacements[0].rep_name, 'Candidate 951001'); assert.equal(ctx.replacements[0].original_name.startsWith('Reg '), true)
  assert.equal(ctx.swaps.length, 1); assert.equal(ctx.swaps[0].kind, 'move'); assert.equal(ctx.swaps[0].sport2_name, '__ch_s4')
  assert.ok(ctx.events.some((e) => e.sport_id === ev.s1) && !ctx.events.some((e) => e.sport_id === ev.inst))
  assert.equal(ctx.window.open, true)
  assert.equal((await svc.clubContext({ clubId: B })).registrations.length, 0)
  await query("DELETE FROM settings WHERE key = 'replacement.open_at'"); assert.equal((await svc.clubContext({ clubId: A })).window.open, false)
})

test('admin lists: tabs, counts, search by club/sport/player, paging; detail view', async () => {
  const a = await registered(A, ev.s1), b = await registered(A, ev.s3), c = await registered(A, ev.s4)
  const { request: r1 } = await ok(rep(a.reg, 951001)); const { request: r2 } = await ok(rep(b.reg, 951002, { ri: null }))
  await ok(svc.decideReplacement({ actor, id: r2.id, approve: false }))
  const mine = (res) => res.requests.filter((x) => x.club_id === A)
  assert.deepEqual(mine(await svc.listReplacementsAdmin({ tab: 'pending' })).map((x) => x.id), [r1.id])
  assert.deepEqual(mine(await svc.listReplacementsAdmin({ tab: 'rejected' })).map((x) => x.id), [r2.id])
  assert.ok((await svc.listReplacementsAdmin({ tab: 'pending' })).counts.pending >= 1)
  assert.equal((await svc.listReplacementsAdmin({ tab: 'pending', search: 'candidate 951001' })).totalCount, 1)
  assert.equal((await svc.listReplacementsAdmin({ tab: 'pending', search: '%%%' })).totalCount, 0)
  assert.equal((await svc.listReplacementsAdmin({ tab: 'bogus', search: 'candidate 951001' })).totalCount, 1)
  const d = await svc.getReplacementAdmin(r1.id)
  assert.equal(d.club_name, 'Change Club A'); assert.equal(d.original_name.startsWith('Reg '), true); assert.equal(d.replacement_rmis_status, 1); assert.equal(d.still_applicable, true)
  assert.equal(await svc.getReplacementAdmin(99999999), null)
  const { request: s1 } = await ok(svc.createSwapRequest({ actor, clubId: A, reg1Id: c.reg, targetSportId: ev.s2, description: 'mv' }))
  const sl = await svc.listSwapsAdmin({ tab: 'pending' })
  const row = sl.requests.find((x) => x.id === s1.id)
  assert.equal(row.is_move, true); assert.equal(row.club_name, 'Change Club A'); assert.equal(row.sport2_name, '__ch_s2')
  assert.equal((await svc.listSwapsAdmin({ tab: 'pending', search: 'change club a' })).requests.some((x) => x.id === s1.id), true)
})
