import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/dashboards/service.mjs')

// ids: clubs 9901-9999, members 960001-969999, events '__db_%'
const [A, B, C, D] = [9901, 9902, 9903, 9904]
const KEYS = ['participation.min_attendance_ratio', 'penalty.tiers', 'penalty.min_players', 'fees.registration_per_player']
const saved = {}
let pid = 960000
const ev = {}

async function cleanup() {
  await query('DELETE FROM club_points WHERE club_id BETWEEN 9901 AND 9999')
  await query('DELETE FROM payment_slips WHERE club_id BETWEEN 9901 AND 9999')
  await query('DELETE FROM day_registrations WHERE member_id BETWEEN 960001 AND 969999')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9901 AND 9999')
  await query('DELETE FROM players WHERE club_id BETWEEN 9901 AND 9999')
}
const mkEvent = async (name, day, type = 'team') => (await query(
  "INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ($1,$2,'mixed','community',$3) RETURNING sport_id", [`__db_${name}`, type, day])).rows[0].sport_id
/** n registered players for a club in a sport (status 1 unless given), the first `attended` checked in on `day` */
async function squad(club, sportId, n, attended, day, { status = 1, reserves = 0 } = {}) {
  const ids = []
  for (let i = 0; i < n + reserves; i++) {
    const id = ++pid; ids.push(id)
    await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'M',$4) ON CONFLICT DO NOTHING", [id, `DB${id}`, club, status])
    await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,$4)', [id, sportId, club, i < n])
  }
  if (day) for (const id of ids.slice(0, attended)) await query('INSERT INTO day_registrations (member_id, day_code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, day])
  return ids
}
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__db_%'"); await cleanup()
  for (const [id, n, cat] of [[A, 'A', 'community'], [B, 'B', 'community'], [C, 'C', 'institute'], [D, 'D', 'community']]) {
    await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,$3,1) ON CONFLICT (club_id) DO UPDATE SET status = 1, category = EXCLUDED.category", [id, `Dash Club ${n}`, cat])
  }
  ev.team = await mkEvent('team', 'D-02'); ev.team2 = await mkEvent('team2', 'D-02'); ev.indiv = await mkEvent('indiv', 'D-03', 'individual')
  ev.track = await mkEvent('track', 'D-03', 'trackIndividual'); ev.noday = await mkEvent('noday', null)
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__db_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9901 AND 9999')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await setSetting('participation.min_attendance_ratio', 0.5)
  await setSetting('penalty.tiers', [{ lt: 50, points: -10 }, { lt: 25, points: -25 }])
  await setSetting('penalty.min_players', 1)
  await setSetting('fees.registration_per_player', 100)
})

// ------------------------------------------------------------------ public registered-events contract
test('registered-events keeps the exact contract keys and counts only events meeting the attendance rule', async () => {
  await squad(A, ev.team, 4, 2, 'D-02')          // 2/4 = 50%: counts
  await squad(A, ev.team2, 4, 1, 'D-02')         // 1/4: does not
  await squad(A, ev.indiv, 1, 1, 'D-03')         // the registered player attended: counts
  await squad(A, ev.noday, 2, 0, null)           // no event day: never counts
  const r = await svc.clubRegisteredEvents(A)
  assert.deepEqual(Object.keys(r), ['club', 'summary', 'events'])
  assert.deepEqual(r.club, { club_id: A, club_name: 'Dash Club A', category: 'community' })
  assert.deepEqual(Object.keys(r.summary), ['event_count', 'eligible_events_count', 'raw_registered_events_count', 'registered_players_count', 'day_registered_players_count'])
  assert.equal(r.summary.event_count, 2)
  assert.equal(r.summary.eligible_events_count, 2)
  assert.equal(r.summary.raw_registered_events_count, 4)
  assert.equal(r.summary.registered_players_count, 11)
  assert.equal(r.summary.day_registered_players_count, 4) // 2 + 1 + 1 (the noday players never attend)
  const e = r.events.find((x) => x.sport_id === ev.team)
  assert.deepEqual(Object.keys(e), ['sport_id', 'sport_name', 'sport_day', 'sport_type', 'min_count', 'registered_player_count', 'day_registered_player_count', 'required_day_registered_count', 'eligible'])
  assert.deepEqual([e.registered_player_count, e.day_registered_player_count, e.required_day_registered_count, e.eligible], [4, 2, 2, true])
  assert.equal(r.events.find((x) => x.sport_id === ev.noday).eligible, false)
  // ordered by day then name, event without a day last
  assert.equal(r.events.at(-1).sport_id, ev.noday)
})

test('registered-events: reserves count in the ratio, exact decimal boundary, empty and unknown club', async () => {
  await squad(A, ev.team, 3, 2, 'D-02', { reserves: 1 })   // 2 of 4 (3 main + 1 reserve) = 50%
  await squad(B, ev.team, 4, 1, 'D-02', { reserves: 0 })   // 25%
  assert.equal((await svc.clubRegisteredEvents(A)).summary.event_count, 1)
  assert.equal((await svc.clubRegisteredEvents(B)).summary.event_count, 0)
  await setSetting('participation.min_attendance_ratio', 0.7)
  await squad(C, ev.team2, 10, 7, 'D-02')                  // 7/10 with ratio 0.7 (float 0.7*10 = 7.000000000000001)
  assert.equal((await svc.clubRegisteredEvents(C)).summary.event_count, 1)
  const empty = await svc.clubRegisteredEvents(D)
  assert.deepEqual(empty.summary, { event_count: 0, eligible_events_count: 0, raw_registered_events_count: 0, registered_players_count: 0, day_registered_players_count: 0 })
  assert.deepEqual(empty.events, [])
  assert.equal(await svc.clubRegisteredEvents(9999), null)
})

test('registered-events follows the ratio setting live (no cached value)', async () => {
  await squad(A, ev.team, 4, 2, 'D-02')
  assert.equal((await svc.clubRegisteredEvents(A)).summary.event_count, 1)
  await setSetting('participation.min_attendance_ratio', 0.75)
  assert.equal((await svc.clubRegisteredEvents(A)).summary.event_count, 0)
  await query("INSERT INTO day_registrations (member_id, day_code) SELECT member_id, 'D-02' FROM registrations WHERE club_id = $1 ON CONFLICT DO NOTHING", [A])
  assert.equal((await svc.clubRegisteredEvents(A)).summary.event_count, 1)
})

// ------------------------------------------------------------------ portal (one club)
test('portal stats: events, players, points with penalty, rank in category, payments, check-in, membership share', async () => {
  await squad(A, ev.team, 3, 2, 'D-02', { status: 1 })
  await squad(A, ev.team2, 1, 0, 'D-02', { status: 5 })       // 3 general + 1 prospective = 75%
  await squad(B, ev.team, 2, 0, null, { status: 5 })           // 0% general
  await query("INSERT INTO club_points (club_id, sport_id, kind, points, place) VALUES ($1,$2,'placement',30,1),($3,$2,'placement',10,2)", [A, ev.team, B])
  await query("INSERT INTO club_points (club_id, kind, points) VALUES ($1,'penalty',-5)", [A])
  await query("INSERT INTO payment_slips (club_id, value, object_key, approved, decided_at) VALUES ($1,100,'k1',true,now()),($1,50,'k2',NULL,NULL),($1,70,'k3',false,now())", [A])
  const s = await svc.portalStats(A)
  assert.equal(s.registeredEvents, 2)
  assert.deepEqual(s.playerBreakdown, { general: 3, prospective: 1, total: 4 })
  assert.equal(s.registeredPlayers, 4)
  assert.equal(s.totalPoints, 25)
  assert.deepEqual(s.clubInfo, { club_id: A, club_name: 'Dash Club A', category: 'community' })
  assert.equal(s.membership.generalPercentage, 75)
  assert.equal(s.membership.target, 50)           // highest tier threshold from settings
  assert.equal(s.membership.deduction, 0)
  assert.equal(s.membership.appliedPenalty, -5)
  assert.equal(s.payments.approvedSlips, 1); assert.equal(s.payments.pendingSlips, 1); assert.equal(s.payments.rejectedSlips, 1)
  assert.equal(s.payments.totalAmount, 400); assert.equal(s.payments.paidAmount, 100); assert.equal(s.payments.remainingAmount, 300)
  const d2 = s.checkin.find((d) => d.sportDay === 'D-02')
  assert.deepEqual([d2.players, d2.checkedIn], [4, 2])
  const b = await svc.portalStats(B)
  assert.equal(b.membership.deduction, -25)      // 0% < 25% -> the lowest matching tier
  assert.equal(b.totalPoints, 10)
  // rank: A has 25, B 10 (among the dev DB's other community clubs there may be more, so rank is relative)
  assert.ok(s.clubRank < b.clubRank)
  assert.equal(await svc.portalStats(9999), null)
})

test('portal stats never mixes clubs: another club registered players do not leak into the figures', async () => {
  await squad(B, ev.team, 5, 5, 'D-02')
  const a = await svc.portalStats(A)
  assert.deepEqual([a.registeredEvents, a.registeredPlayers, a.totalPoints], [0, 0, 0])
  assert.ok(a.checkin.every((d) => d.players === 0 && d.checkedIn === 0))
})

test('portal overview: leaderboard defaults to the club category, ties share a rank, limit applies', async () => {
  await query("INSERT INTO club_points (club_id, kind, points) VALUES ($1,'manual',1000),($2,'manual',1000),($3,'manual',999)", [A, B, D])
  const o = await svc.portalOverview({ clubId: A, limit: 3 })
  assert.equal(o.leaderboard.length, 3)
  assert.ok(o.leaderboard.every((c) => c.category === 'community'))
  const [x, y, z] = o.leaderboard
  assert.deepEqual([x.club_id, y.club_id].sort(), [A, B])
  assert.equal(x.rank, 1); assert.equal(y.rank, 1); assert.equal(z.rank, 3); assert.equal(z.club_id, D)
  const inst = await svc.leaderboard({ category: 'institute', limit: 200 })
  assert.ok(inst.every((c) => c.category === 'institute'))
})

// ------------------------------------------------------------------ admin
test('admin stats: counts move by exactly what was added (single aggregate statement)', async () => {
  const before = await svc.adminStats()
  await squad(A, ev.team, 2, 0, null, { status: 1 })
  await squad(C, ev.indiv, 1, 0, null, { status: 5 })
  await query("INSERT INTO payment_slips (club_id, value, object_key, approved, decided_at) VALUES ($1,10,'a1',true,now())", [A])
  await query("INSERT INTO payment_slips (club_id, value, object_key) VALUES ($1,10,'a2')", [B])
  const after = await svc.adminStats()
  assert.equal(after.totalPlayers - before.totalPlayers, 3)
  assert.equal(after.totalRegistrations - before.totalRegistrations, 3)
  assert.equal(after.registrationsByCategory.team - before.registrationsByCategory.team, 2)
  assert.equal(after.registrationsByCategory.individual - before.registrationsByCategory.individual, 1)
  assert.equal(after.playersByGender.male - before.playersByGender.male, 3)
  assert.equal(after.totalPayments - before.totalPayments, 1)
  assert.equal(after.registeredClubs.community.registered - before.registeredClubs.community.registered, 1)
  assert.equal(after.registeredClubs.institute.registered - before.registeredClubs.institute.registered, 1)
  assert.equal(after.totalClubs, after.communityClubs + after.instituteClubs)
})

test('admin overview: payments by status, check-in per day, clubs under the membership threshold', async () => {
  await squad(A, ev.team, 1, 1, 'D-02', { status: 1 })
  await squad(A, ev.team2, 3, 0, 'D-02', { status: 5 })     // 1 of 4 = 25% -> below 50
  await squad(B, ev.team, 4, 0, null, { status: 1 })        // 100%
  await query("INSERT INTO payment_slips (club_id, value, object_key) VALUES ($1,10,'p1'),($1,20,'p2')", [A])
  const o = await svc.adminOverview({ category: 'community', limit: 5 })
  assert.ok(o.payments.pendingSlips >= 2)
  assert.ok(o.checkin.some((d) => d.sportDay === 'D-02' && d.dayRegistered >= 1))
  assert.equal(o.membership.target, 50)
  // belowTarget in the overview is capped (10, worst first): read the uncapped list to find club A
  const full = await svc.membershipSummary({ listLimit: 1000 })
  const a = full.belowTarget.find((c) => c.club_id === A)
  assert.ok(a, 'club A (25% general) is under the target')
  assert.deepEqual([a.general, a.total, a.percentage, a.deduction], [1, 4, 25, -10])
  assert.ok(!full.belowTarget.some((c) => c.club_id === B))
  assert.equal(o.pendingRequests, o.stats.pendingRequests)
  assert.ok(o.leaderboard.length <= 5)
})

test('administration overview: registrations per sport and per club come from aggregates', async () => {
  await squad(A, ev.team, 3, 0, null, { reserves: 1 })
  await squad(B, ev.team, 2, 0, null)
  const o = await svc.administrationOverview()
  const s = o.registrationsBySport.find((x) => x.sport_id === ev.team)
  assert.deepEqual([s.registrations, s.clubs, s.main_players, s.reserves], [6, 2, 5, 1])
  const a = o.registrationsByClub.find((x) => x.club_id === A)
  assert.deepEqual([a.players, a.registrations, a.sports], [4, 4, 1])
  assert.ok(o.payments && o.checkin && o.membership)
})
