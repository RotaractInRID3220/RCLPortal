// Integration tests: real Postgres (local rcl_v2_dev), real transactions, real concurrency.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/registration/service.mjs')
const { applyRoster, applyChanges, reconcilePlayers, listRmisFlags, listEligibleMembers } = await import('../src/server/rmis/mirror.mjs')

const A = 9101, B = 9102, C = 9103 // test clubs: A,B community, C institute
const actor = { member_id: 1 }
const KEYS = ['registration.open_at', 'registration.close_at', 'membership.cutoff', 'limits.groups']
let saved = {}, ev = {}

const member = (id, o = {}) => ({ member_id: id, membership_id: `T${id}`, club_id: A, status: 1, role_id: 31, card_name: `Tester ${id}`, full_name: `Tester Full ${id}`,
  gender: 'F', nic: ` ${id}0000v `, dob: '2000-01-01', created_at: '2026-06-23T10:00:00.000Z', updated_at: '2026-06-23T10:00:00.000Z', transfer_completed_at: null, ...o })
const mkEvent = async (name, o = {}) => (await query(
  `INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, registration_close, sport_day, limit_group)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING sport_id`,
  [`__t_${name}`, o.type ?? 'individual', o.gender ?? 'female', o.category ?? 'community', 'min' in o ? o.min : 1, 'max' in o ? o.max : 5, 'reserve' in o ? o.reserve : 1, o.close ?? null, o.day ?? 'D-01', o.group ?? 'standard'])).rows[0].sport_id

async function cleanup() {
  await query("DELETE FROM audit_log WHERE entity = 'registration' AND actor_id = 1")
  await query('DELETE FROM replacement_requests WHERE club_id = ANY($1)', [[A, B, C]])
  await query('DELETE FROM registrations WHERE club_id = ANY($1)', [[A, B, C]])
  await query('DELETE FROM players WHERE club_id = ANY($1)', [[A, B, C]])
}
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__t_%'")
  await cleanup()
  await query('DELETE FROM rmis_members WHERE club_id = ANY($1)', [[A, B, C]])
  await query(`INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,'T Club A','community',1),($2,'T Club B','community',1),($3,'T Club C','institute',1)
               ON CONFLICT (club_id) DO UPDATE SET category = EXCLUDED.category`, [A, B, C])
  ev.team = await mkEvent('team', { type: 'team', max: 3, reserve: 1, day: 'D-01' })
  ev.same = await mkEvent('same-day', { day: 'D-01' })
  ev.d2 = await mkEvent('d2', { gender: 'mixed', day: 'D-02' })
  ev.d3 = await mkEvent('d3', { gender: 'mixed', day: 'D-03' })
  ev.tr = []; for (let i = 0; i < 4; i++) ev.tr.push(await mkEvent(`track${i}`, { type: 'trackIndividual', gender: 'mixed', day: 'D-03', group: 'track', max: 10 }))
  ev.sw = []; for (let i = 0; i < 4; i++) ev.sw.push(await mkEvent(`swim${i}`, { type: 'trackIndividual', gender: 'mixed', day: 'D-04', group: 'swimming', max: 10 }))
  ev.road = await mkEvent('road', { gender: 'mixed', day: 'D-05' })
  ev.inst = await mkEvent('inst', { gender: 'mixed', category: 'institute' })
  ev.male = await mkEvent('male', { gender: 'male', day: 'D-02' })
  ev.closed = await mkEvent('closed', { gender: 'mixed', day: 'D-02', close: '2020-01-01T00:00:00Z' })
  ev.nomax = await mkEvent('nomax', { gender: 'mixed', day: 'D-02', max: null })
  ev.late = await mkEvent('late', { gender: 'mixed', day: 'D-03', close: '2030-01-01T00:00:00Z' })
})
after(async () => {
  await cleanup()
  await query("DELETE FROM events WHERE sport_name LIKE '__t_%'")
  await query('DELETE FROM rmis_members WHERE club_id = ANY($1)', [[A, B, C]])
  await query('DELETE FROM clubs WHERE club_id = ANY($1)', [[A, B, C]])
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await query('DELETE FROM rmis_members WHERE club_id = ANY($1)', [[A, B, C]])
  await setSetting('registration.open_at', '2026-01-01T00:00:00Z')
  await query("DELETE FROM settings WHERE key = 'registration.close_at'")   // a global close time set in the dev DB must not decide these tests
  await setSetting('membership.cutoff', '2026-12-31T00:00:00Z')
  await setSetting('limits.groups', { standard: { per: 'day', max: 1 }, track: { per: 'total', max: 3 }, swimming: { per: 'total', max: 3 } })
  await applyRoster([member(910001), member(910002, { status: 5 }), member(910003, { status: 3 }), member(910004, { status: 2 }),
    member(910005, { status: 4 }), member(910006, { gender: 'M' }), member(910007, { gender: 'O' }), member(910008, { club_id: B }),
    member(910009, { created_at: '2027-02-01T00:00:00.000Z' }), member(910010, { club_id: C })])
})
const reg = (memberId, sportId, o = {}) => svc.registerPlayer({ actor, clubId: o.clubId ?? A, memberId, sportId, mainPlayer: o.main ?? true, riId: 'ri' in o ? o.ri : '12345', now: o.now })
const ok = async (p) => { const r = await p; assert.equal(r.ok, true, JSON.stringify(r)); return r }
const bad = async (p, code, status) => { const r = await p; assert.equal(r.ok, false, 'expected a failure'); assert.equal(r.code, code, JSON.stringify(r)); if (status) assert.equal(r.status, status); return r }

test('happy path: player row is created from RMIS data, normalised, and audited', async () => {
  const r = await ok(reg(910001, ev.same))
  assert.equal(r.registration.club_id, A)
  const { rows: [p] } = await query('SELECT * FROM players WHERE member_id = 910001')
  assert.equal(p.name, 'Tester Full 910001')
  assert.equal(p.nic, '9100010000V') // trimmed + upper-cased
  assert.equal(p.status, 1)
  assert.equal(p.ri_id, '12345')
  assert.equal(p.rmis_status, 1)
  assert.equal(p.club_id, A)
  const { rows: au } = await query("SELECT action FROM audit_log WHERE entity='registration' AND actor_id=1")
  assert.deepEqual(au.map((x) => x.action), ['registration.create'])
})

test('general members need an RI number; prospective members do not', async () => {
  await bad(reg(910001, ev.same, { ri: '' }), 'ri_number_required', 422)
  await bad(reg(910001, ev.same, { ri: null }), 'ri_number_required', 422)
  await ok(reg(910002, ev.same, { ri: null })) // prospective
  assert.equal((await query('SELECT status FROM players WHERE member_id = 910002')).rows[0].status, 5)
})

test('transferred members (status 3) register as general and need an RI number', async () => {
  await bad(reg(910003, ev.same, { ri: '' }), 'ri_number_required')
  await ok(reg(910003, ev.same))
  const { rows: [p] } = await query('SELECT status, rmis_status FROM players WHERE member_id = 910003')
  assert.deepEqual([p.status, p.rmis_status], [1, 3])
})

test('inactive, terminated, non M/F and after-cutoff members are refused', async () => {
  await bad(reg(910004, ev.same), 'member_not_active', 422)
  await bad(reg(910005, ev.same), 'member_not_active', 422)
  await bad(reg(910007, ev.same), 'gender_not_registrable', 422)
  await bad(reg(910009, ev.same), 'joined_after_cutoff', 422)
  assert.equal((await query('SELECT count(*)::int n FROM registrations WHERE club_id = $1', [A])).rows[0].n, 0)
})

test('a club cannot register another club\'s member; unknown member is 404', async () => {
  await bad(reg(910008, ev.same), 'not_your_club_member', 403)
  await bad(reg(999999, ev.same), 'member_not_found', 404)
})

test('category and gender must match the sport', async () => {
  await bad(reg(910001, ev.inst), 'category_mismatch', 422) // community club, institute sport
  await ok(reg(910010, ev.inst, { clubId: C }))              // institute club
  await bad(reg(910001, ev.male), 'gender_mismatch', 422)    // female player, male sport
  await ok(reg(910006, ev.male))                              // male player
})

test('window: closed until open_at is set; per-sport close time; cutoff unset fails closed', async () => {
  await query("DELETE FROM settings WHERE key = 'registration.open_at'")
  await bad(reg(910001, ev.same), 'registration_not_open', 403)
  await setSetting('registration.open_at', '2999-01-01T00:00:00Z')
  await bad(reg(910001, ev.same), 'registration_not_open', 403)
  await setSetting('registration.open_at', '2026-01-01T00:00:00Z')
  await bad(reg(910001, ev.closed), 'registration_closed', 403)
  await query("DELETE FROM settings WHERE key = 'membership.cutoff'")
  await bad(reg(910001, ev.same), 'cutoff_not_set', 422)
})

test('a sport without a player limit is not open for registration', async () => {
  await bad(reg(910001, ev.nomax), 'event_not_configured', 409)
})

test('duplicate registration is rejected; 8 parallel attempts register exactly once', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => reg(910001, ev.same)))
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.ok(results.filter((r) => !r.ok).every((r) => r.code === 'already_registered'))
  assert.equal((await query('SELECT count(*)::int n FROM registrations WHERE member_id = 910001')).rows[0].n, 1)
})

test('capacity: team max 3 main + 1 reserve; 10 players racing for it take exactly 3 + 1', async () => {
  const ids = Array.from({ length: 10 }, (_, i) => 910100 + i)
  await applyRoster(ids.map((id) => member(id)))
  const mains = await Promise.all(ids.map((id) => reg(id, ev.team)))
  assert.equal(mains.filter((r) => r.ok).length, 3)
  assert.ok(mains.filter((r) => !r.ok).every((r) => r.code === 'main_full'))
  const res = await Promise.all(ids.map((id) => reg(id, ev.team, { main: false })))
  assert.equal(res.filter((r) => r.ok).length, 1) // one reserve slot
  assert.ok(res.filter((r) => !r.ok).every((r) => ['reserve_full', 'already_registered', 'limit_reached'].includes(r.code)))
  const { rows: [n] } = await query('SELECT count(*) FILTER (WHERE main_player)::int main, count(*) FILTER (WHERE NOT main_player)::int res FROM registrations WHERE sport_id = $1', [ev.team])
  assert.deepEqual([n.main, n.res], [3, 1])
})

test('limit: one standard event per day (other days are fine)', async () => {
  await ok(reg(910001, ev.same))                      // D-01
  await bad(reg(910001, ev.team), 'limit_reached', 422) // another D-01 event
  await ok(reg(910001, ev.d2))                        // D-02
  await ok(reg(910001, ev.d3))                        // D-03
})

test('limit: 3 track events in total, a 4th is refused; swimming has its own 3', async () => {
  for (const s of ev.tr.slice(0, 3)) await ok(reg(910001, s))
  const r = await bad(reg(910001, ev.tr[3]), 'limit_reached', 422)
  assert.equal(r.group ?? 'track', 'track')
  for (const s of ev.sw.slice(0, 3)) await ok(reg(910001, s))           // swimming allowance is separate
  await bad(reg(910001, ev.sw[3]), 'limit_reached', 422)
  await ok(reg(910001, ev.same))                                         // standard still available
})

test('road race (own day D-05) never blocks another day\'s event', async () => {
  await ok(reg(910001, ev.road))
  await ok(reg(910001, ev.same))
  await ok(reg(910001, ev.d2))
})

test('limits are read from settings; missing config fails closed with 503', async () => {
  await setSetting('limits.groups', { standard: { per: 'day', max: 2 }, track: { per: 'total', max: 3 }, swimming: { per: 'total', max: 3 } })
  await ok(reg(910001, ev.same)); await ok(reg(910001, ev.team))
  await query("DELETE FROM settings WHERE key = 'limits.groups'")
  await bad(reg(910001, ev.d2), 'limits_not_configured', 503)
})

test('a failed registration leaves nothing behind (player row included)', async () => {
  await bad(reg(910008, ev.same), 'not_your_club_member')
  await bad(reg(910002, ev.nomax, { ri: null }), 'event_not_configured')
  assert.equal((await query('SELECT count(*)::int n FROM players WHERE member_id = ANY($1)', [[910008, 910002]])).rows[0].n, 0)
})

test('unregister: removes it, and the slot is free again', async () => {
  await ok(reg(910001, ev.same))
  await ok(svc.unregisterPlayer({ actor, clubId: A, memberId: 910001, sportId: ev.same }))
  assert.equal((await query('SELECT count(*)::int n FROM registrations WHERE member_id = 910001')).rows[0].n, 0)
  await ok(reg(910001, ev.same))
})

test('unregister: other club is forbidden, unknown is 404, closed window and history block it', async () => {
  await ok(reg(910001, ev.same))
  await bad(svc.unregisterPlayer({ actor, clubId: B, memberId: 910001, sportId: ev.same }), 'forbidden', 403)
  await bad(svc.unregisterPlayer({ actor, clubId: A, memberId: 910001, sportId: ev.d3 }), 'registration_not_found', 404)
  await ok(reg(910001, ev.late))                                  // closes 2030-01-01
  await bad(svc.unregisterPlayer({ actor, clubId: A, memberId: 910001, sportId: ev.late, now: new Date('2031-01-01') }), 'registration_closed', 403)
  await ok(svc.unregisterPlayer({ actor, clubId: A, memberId: 910001, sportId: ev.late }))  // still fine before the close
  const { rows: [r] } = await query('SELECT id FROM registrations WHERE member_id = 910001')
  await query(`INSERT INTO replacement_requests (sport_id, registration_id, club_id, original_member_id, replacement_member_id, rep_name, rep_gender, rep_status, reason)
               VALUES ($1,$2,$3,910001,910002,'x','F',5,'r')`, [ev.same, r.id, A])
  await bad(svc.unregisterPlayer({ actor, clubId: A, memberId: 910001, sportId: ev.same }), 'registration_has_history', 409)
})

test('list queries: club registrations, admin paging/search', async () => {
  await ok(reg(910001, ev.same)); await ok(reg(910002, ev.d2, { ri: null }))
  const mine = await svc.listRegistrations({ clubId: A })
  assert.equal(mine.length, 2)
  assert.ok(mine.every((r) => r.club_id === A && r.player_name && r.sport_name))
  assert.equal((await svc.listRegistrations({ clubId: A, sportId: ev.same })).length, 1)
  assert.equal((await svc.listRegistrations({ clubId: B })).length, 0)
  const adm = await svc.listRegistrationsAdmin({ page: 1, limit: 1, clubId: A })
  assert.equal(adm.total, 2); assert.equal(adm.rows.length, 1); assert.equal(adm.totalPages, 2)
  assert.equal((await svc.listRegistrationsAdmin({ search: '9100010000v', clubId: A })).total, 1) // exact NIC, any case
  assert.equal((await svc.listRegistrationsAdmin({ limit: 99999 })).limit, 200)                  // capped
})

test('convert: general -> prospective (status 5, converted, audited); only general players, once', async () => {
  await ok(reg(910001, ev.same)); await ok(reg(910002, ev.d2, { ri: null }))   // general + prospective
  await bad(svc.convertPlayer({ actor, memberId: 910002 }), 'not_general', 409)  // prospective cannot be converted
  await ok(svc.convertPlayer({ actor, memberId: 910001 }))
  const { rows: [p] } = await query('SELECT status, converted, converted_by FROM players WHERE member_id = 910001')
  assert.deepEqual([p.status, p.converted, p.converted_by], [5, true, 1])
  await bad(svc.convertPlayer({ actor, memberId: 910001 }), 'already_converted', 409)
  await bad(svc.convertPlayer({ actor, memberId: 123456789 }), 'player_not_found', 404)
})

test('a conversion sticks: RMIS sync and a later registration do not turn the player back into general', async () => {
  await ok(reg(910001, ev.same)); await ok(svc.convertPlayer({ actor, memberId: 910001 }))
  await applyChanges([member(910001, { status: 1, updated_at: '2026-09-01T00:00:00.000Z' })])  // RMIS still says general
  await reconcilePlayers({ clubId: A })
  assert.equal((await query('SELECT status FROM players WHERE member_id = 910001')).rows[0].status, 5)
  await ok(reg(910001, ev.d2, { ri: null }))   // converted players are prospective: no RI number needed
  assert.equal((await query('SELECT status, converted FROM players WHERE member_id = 910001')).rows[0].status, 5)
})

test('clean: removes only players without registrations (and respects the club filter)', async () => {
  await ok(reg(910001, ev.same))
  await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES (910050,'Orphan A',$1,'F',1),(910051,'Orphan B',$2,'F',1)", [A, B])
  const gone = await svc.cleanUnregisteredPlayers({ clubId: B })
  assert.deepEqual(gone.map((g) => g.member_id), [910051])
  const gone2 = await svc.cleanUnregisteredPlayers({})
  assert.ok(gone2.some((g) => g.member_id === 910050))
  assert.equal((await query('SELECT count(*)::int n FROM players WHERE member_id = 910001')).rows[0].n, 1) // registered player kept
})

test('public lookup: by NIC (exact), membership id (exact), name (>= 3 chars); NIC never returned', async () => {
  await ok(reg(910001, ev.same))
  const byNic = await svc.searchPlayersPublic({ nic: ' 9100010000v ' })
  assert.equal(byNic.players.length, 1)
  assert.equal((await svc.searchPlayersPublic({ nic: '91000100' })).players.length, 0)        // partial NIC finds nothing
  assert.equal((await svc.searchPlayersPublic({ nic: '9100010000' })).players.length, 0)
  assert.equal((await svc.searchPlayersPublic({ membershipId: 't910001' })).players.length, 1)
  assert.equal((await svc.searchPlayersPublic({ membershipId: 'T9100' })).players.length, 0)  // exact only
  assert.equal((await svc.searchPlayersPublic({ name: 'full 9100' })).players.length, 1)
  assert.equal((await svc.searchPlayersPublic({ name: 'fu' })).players.length, 0)
  assert.equal((await svc.searchPlayersPublic({ name: '%%%' })).players.length, 0)            // wildcards are escaped
  assert.ok(!JSON.stringify(byNic).includes('9100010000V'))                                    // full NIC absent
  assert.equal(byNic.players[0].masked_nic, '•••••000V')
  assert.equal(Object.keys(byNic.players[0]).includes('nic'), false)
  const one = await svc.getPlayerPublic(910001)
  assert.equal(one.sports.length, 1)
  assert.ok(!('nic' in one))
  assert.equal(await svc.getPlayerPublic(424242), null)
})

test('public lookup only finds players who are registered for something', async () => {
  await query("INSERT INTO players (member_id, name, club_id, gender, status, nic) VALUES (910060,'Unregistered Person',$1,'F',1,'ZZ99')", [A])
  assert.equal((await svc.searchPlayersPublic({ nic: 'zz99' })).players.length, 0)
})

test('eligible members list: cutoff, status, gender; cutoff unset = nobody', async () => {
  const { members, cutoffSet } = await listEligibleMembers(A)
  assert.equal(cutoffSet, true)
  const ids = members.map((m) => m.member_id)
  assert.deepEqual(ids.sort(), [910001, 910002, 910003, 910006].sort())      // not: inactive, terminated, O, after-cutoff, other clubs
  assert.equal(members.find((m) => m.member_id === 910003).status, 1)         // transferred shown as general
  assert.equal(members.find((m) => m.member_id === 910003).rmis_status, 3)
  await query("DELETE FROM settings WHERE key = 'membership.cutoff'")
  assert.deepEqual(await listEligibleMembers(A), { cutoffSet: false, members: [], excluded: [] })
})

test('mirror: change feed only applies newer state; reconcile updates registered players and flags problems', async () => {
  await ok(reg(910001, ev.same)); await ok(reg(910003, ev.d2))
  // older change must not overwrite newer state
  await applyChanges([member(910001, { card_name: 'Newer', updated_at: '2026-07-02T00:00:00.000Z' })])
  await applyChanges([member(910001, { card_name: 'Older', updated_at: '2026-07-01T00:00:00.000Z' })])
  assert.equal((await query('SELECT card_name FROM rmis_members WHERE member_id = 910001')).rows[0].card_name, 'Newer')
  // 910001 becomes inactive, 910003 transfers to another club in RMIS
  await applyChanges([member(910001, { status: 2, updated_at: '2026-08-01T00:00:00.000Z' }), member(910003, { status: 3, club_id: B, updated_at: '2026-08-01T00:00:00.000Z' })])
  const changed = await reconcilePlayers({ clubId: A })
  assert.equal(changed.length, 2)
  const flags = await listRmisFlags()
  const f = Object.fromEntries(flags.filter((x) => [910001, 910003].includes(x.member_id)).map((x) => [x.member_id, x.flag]))
  assert.deepEqual(f, { 910001: 'not_active_in_rmis', 910003: 'club_changed_in_rmis' })
  // the registered player is NOT moved silently
  assert.equal((await query('SELECT club_id FROM players WHERE member_id = 910003')).rows[0].club_id, A)
  assert.equal((await query('SELECT count(*)::int n FROM registrations WHERE member_id = 910003')).rows[0].n, 1)
  // idempotent: running it again changes nothing
  assert.equal((await reconcilePlayers({ clubId: A })).length, 0)
})

test('transfer after cutoff: refused at registration, hidden from eligible list with a reason, flagged once registered', async () => {
  await applyRoster([
    member(910070, { status: 3, transfer_completed_at: '2026-12-15T00:00:00.000Z' }),   // before the 2026-12-31 cutoff
    member(910071, { status: 3, transfer_completed_at: '2027-01-05T00:00:00.000Z' }),   // after the cutoff
    member(910072, { status: 3 }),                                                      // legacy, field present (null)
  ])
  await ok(reg(910070, ev.same))
  await bad(reg(910071, ev.same), 'transfer_after_cutoff', 422)
  await ok(reg(910072, ev.d2))
  const { members, excluded } = await listEligibleMembers(A)
  const ids = members.map((m) => m.member_id)
  assert.ok(ids.includes(910070) && ids.includes(910072) && !ids.includes(910071))
  assert.deepEqual(excluded.filter((e) => [910070, 910071, 910072].includes(e.member_id)).map((e) => [e.member_id, e.reason]), [[910071, 'transfer_after_cutoff']])
  // old RMIS that omits the field: status 3 is refused, flagged as unavailable; active is fine
  const legacy = member(910073, { status: 3 }); delete legacy.transfer_completed_at
  const legacyActive = member(910074, { status: 1 }); delete legacyActive.transfer_completed_at
  await applyRoster([legacy, legacyActive])
  await bad(reg(910073, ev.same), 'transfer_info_unavailable', 422)
  await ok(reg(910074, ev.d2))
  assert.equal((await listEligibleMembers(A)).excluded.find((e) => e.member_id === 910073).reason, 'transfer_info_unavailable')
  // a registered player whose transfer RMIS later reports as after-cutoff is flagged for the admin
  await applyRoster([member(910070, { status: 3, transfer_completed_at: '2027-02-01T00:00:00.000Z' })])
  const flags = await listRmisFlags()
  assert.equal(flags.find((x) => x.member_id === 910070).flag, 'transferred_after_cutoff')
  assert.equal(flags.find((x) => x.member_id === 910072), undefined)
  const list = await svc.listPlayersByClub(A)
  assert.equal(list.find((x) => x.member_id === 910070).flag, 'transferred_after_cutoff')
})
