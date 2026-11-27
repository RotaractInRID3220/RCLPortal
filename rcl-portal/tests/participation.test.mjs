import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/participation/service.mjs')

const [A, B, C] = [9401, 9402, 9403]
const actor = { member_id: 51 }
const KEYS = ['participation.min_attendance_ratio', 'points.participation_per_sport', 'checkin.current_day']
let saved = {}, ev = {}, pid = 900000
async function cleanup() {
  await query('DELETE FROM club_points WHERE club_id BETWEEN 9401 AND 9403')
  await query('DELETE FROM day_registrations WHERE member_id >= 900000 AND member_id < 910000')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9401 AND 9403')
  await query('DELETE FROM players WHERE club_id BETWEEN 9401 AND 9403')
  await query("DELETE FROM audit_log WHERE actor_id = 51")
}
const mkEvent = async (name, day, type = 'team') => (await query(
  "INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ($1,$2,'mixed','community',$3) RETURNING sport_id", [`__pp_${name}`, type, day])).rows[0].sport_id
/** n players of `club` registered in `sportId`, `attended` of them checked in on `day` */
async function squad(club, sportId, n, attended, day, { reserves = 0 } = {}) {
  const ids = []
  for (let i = 0; i < n + reserves; i++) {
    const id = ++pid; ids.push(id)
    await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'F',1) ON CONFLICT DO NOTHING", [id, `PP${id}`, club])
    await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,$4)', [id, sportId, club, i < n])
  }
  for (const id of ids.slice(0, attended)) await query('INSERT INTO day_registrations (member_id, day_code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, day])
  return ids
}
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__pp_%'"); await cleanup()
  for (const [id, n] of [[A, 'A'], [B, 'B'], [C, 'C']]) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO UPDATE SET status = 1", [id, `Part Club ${n}`])
  ev.s1 = await mkEvent('s1', 'D-02'); ev.s2 = await mkEvent('s2', 'D-02'); ev.s3 = await mkEvent('s3', 'D-03')
  ev.track = await mkEvent('track', 'D-02', 'trackIndividual'); ev.indiv = await mkEvent('indiv', 'D-02', 'individual')
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__pp_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9401 AND 9403')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => { await cleanup(); await setSetting('participation.min_attendance_ratio', 0.5); await setSetting('points.participation_per_sport', 15); await query("DELETE FROM settings WHERE key = 'checkin.current_day'") })

const mine = (res) => res.data.filter((c) => [A, B, C].includes(c.club_id))
const row = (res, id) => res.data.find((c) => c.club_id === id)
const points = async () => (await query("SELECT club_id, sport_id, points FROM club_points WHERE kind = 'participation' AND club_id BETWEEN 9401 AND 9403 ORDER BY club_id, sport_id")).rows

test('eligibility is attendance >= ratio of ALL registered players (main + reserve); exactly 50% counts', async () => {
  await squad(A, ev.s1, 4, 2, 'D-02')                          // 2/4 = 50% -> eligible
  await squad(B, ev.s1, 4, 1, 'D-02')                          // 1/4 -> not
  await squad(C, ev.s1, 3, 2, 'D-02', { reserves: 1 })         // 2 attended of 4 registered (3 main + 1 reserve) = 50% -> eligible
  const r = await svc.overview({ day: 'D-02' })
  assert.deepEqual([row(r, A).eligible_sports_count, row(r, B).eligible_sports_count, row(r, C).eligible_sports_count], [1, 0, 1])
  assert.equal(row(r, C).registered_players_count, 4)
})

test('3 of 5 is eligible, 2 of 5 is not (exact ratio, no rounding up)', async () => {
  await squad(A, ev.s1, 5, 3, 'D-02'); await squad(B, ev.s1, 5, 2, 'D-02')
  const r = await svc.overview({ day: 'D-02' })
  assert.equal(row(r, A).eligible_sports_count, 1); assert.equal(row(r, B).eligible_sports_count, 0)
})

test('only the chosen day counts; check-ins on another day do not help', async () => {
  const ids = await squad(A, ev.s3, 4, 0, 'D-03')               // D-03 sport, nobody checked in on D-03
  for (const id of ids) await query("INSERT INTO day_registrations (member_id, day_code) VALUES ($1,'D-02')", [id])
  assert.equal(row(await svc.overview({ day: 'D-03' }), A).eligible_sports_count, 0)
  assert.equal(row(await svc.overview({ day: 'D-02' }), A).registered_sports_count, 0)
})

test('track events are not part of participation points; team and individual sports are', async () => {
  await squad(A, ev.track, 4, 4, 'D-02'); await squad(A, ev.indiv, 2, 2, 'D-02')
  const r = await svc.overview({ day: 'D-02' })
  assert.equal(row(r, A).registered_sports_count, 1)
  assert.equal(row(r, A).eligible_sports_count, 1)
})

test('award: one participation row per eligible sport with the configured points', async () => {
  await squad(A, ev.s1, 4, 3, 'D-02'); await squad(A, ev.s2, 2, 2, 'D-02'); await squad(B, ev.s1, 4, 1, 'D-02')
  const r = await svc.award({ actor, day: 'D-02' })
  assert.equal(r.ok, true)
  assert.deepEqual(await points(), [{ club_id: A, sport_id: ev.s1, points: 15 }, { club_id: A, sport_id: ev.s2, points: 15 }])
  assert.equal(r.summary.sportsAwarded >= 2, true)
  assert.equal(r.summary.totalPointsAwarded >= 30, true)
})

test('REGRESSION: awarding again (and again) never duplicates points', async () => {
  await squad(A, ev.s1, 4, 3, 'D-02')
  for (let i = 0; i < 5; i++) await svc.award({ actor, day: 'D-02' })
  assert.equal((await points()).length, 1)
  const again = await svc.award({ actor, day: 'D-02' })
  assert.equal(again.summary.sportsAwarded, 0)
  assert.equal(row(await svc.overview({ day: 'D-02' }), A).already_awarded, true)
})

test('8 admins awarding at the same moment: still one row per club and sport', async () => {
  await squad(A, ev.s1, 4, 4, 'D-02'); await squad(B, ev.s1, 2, 2, 'D-02')
  const rs = await Promise.all(Array.from({ length: 8 }, () => svc.award({ actor, day: 'D-02' })))
  assert.ok(rs.every((r) => r.ok))
  assert.equal((await points()).length, 2)
})

test('REGRESSION: a tournament placement for the same sport never overwrites the participation points', async () => {
  await squad(A, ev.s1, 4, 4, 'D-02')
  await svc.award({ actor, day: 'D-02' })
  await query("INSERT INTO club_points (club_id, sport_id, kind, points, place) VALUES ($1,$2,'placement',100,1)", [A, ev.s1])
  await svc.award({ actor, day: 'D-02' })
  const { rows } = await query("SELECT kind, points FROM club_points WHERE club_id = $1 AND sport_id = $2 ORDER BY kind", [A, ev.s1])
  assert.deepEqual(rows, [{ kind: 'participation', points: 15 }, { kind: 'placement', points: 100 }])   // both exist, nothing duplicated or overwritten
})

test('a sport that becomes eligible later (more check-ins) is awarded on the next run; existing awards stay', async () => {
  const ids = await squad(A, ev.s1, 4, 1, 'D-02'); await squad(A, ev.s2, 2, 2, 'D-02')
  await svc.award({ actor, day: 'D-02' })
  assert.deepEqual((await points()).map((p) => p.sport_id), [ev.s2])
  for (const id of ids.slice(1, 3)) await query("INSERT INTO day_registrations (member_id, day_code) VALUES ($1,'D-02')", [id])
  const r = await svc.overview({ day: 'D-02' })
  assert.equal(row(r, A).pending_sports_count, 1); assert.equal(row(r, A).already_awarded, false)
  const second = await svc.award({ actor, day: 'D-02' })
  assert.equal(second.summary.sportsAwarded, 1)
  assert.deepEqual((await points()).map((p) => p.sport_id).sort(), [ev.s1, ev.s2].sort())
})

test('points and ratio come from settings; changing them changes the outcome', async () => {
  await squad(A, ev.s1, 4, 2, 'D-02')                                     // 50%
  await setSetting('participation.min_attendance_ratio', 0.75)
  assert.equal(row(await svc.overview({ day: 'D-02' }), A).eligible_sports_count, 0)
  await setSetting('participation.min_attendance_ratio', 0.5); await setSetting('points.participation_per_sport', 20)
  await svc.award({ actor, day: 'D-02' })
  assert.deepEqual((await points()).map((p) => p.points), [20])
})

test('day handling: unknown day 400, award needs an explicit day, default is the current check-in day', async () => {
  assert.equal((await svc.overview({ day: 'D-99' })).code, 'unknown_day')
  assert.equal((await svc.award({ actor, day: 'D-99' })).code, 'unknown_day')
  assert.equal((await svc.award({ actor, day: null })).code, 'unknown_day')
  await setSetting('checkin.current_day', 'D-03')
  assert.equal((await svc.overview()).meta.sportDay, 'D-03')
  assert.equal((await svc.overview()).meta.pointsPerSport, 15)
  assert.equal((await svc.overview({ day: 'D-01' })).meta.sportDay, 'D-01')
})

test('fails closed when the ratio or points are missing', async () => {
  await squad(A, ev.s1, 4, 4, 'D-02')
  await query("DELETE FROM settings WHERE key = 'participation.min_attendance_ratio'")
  assert.equal((await svc.overview({ day: 'D-02' })).code, 'participation_not_configured')
  assert.equal((await svc.award({ actor, day: 'D-02' })).status, 503)
  assert.deepEqual(await points(), [])
})

test('club detail: sports with players, attendance flags, eligibility and award state', async () => {
  const ids = await squad(A, ev.s1, 4, 2, 'D-02', { reserves: 1 })
  await svc.award({ actor, day: 'D-02' })
  const r = await svc.clubDetail({ clubId: A, day: 'D-02' })
  assert.equal(r.ok, true)
  const s = r.data.sports[0]
  assert.equal(s.players.length, 5); assert.equal(s.eligible, false); assert.equal(s.awarded, false)       // 2/5 = 40%
  assert.equal(s.players.filter((p) => p.day_registered).length, 2)
  assert.equal(r.data.summary.total_players, 5); assert.equal(r.data.summary.day_registered_count, 2)
  assert.equal(r.data.players[0].day_registered, true)                                                     // checked-in players first
  assert.deepEqual(s.players.map((p) => p.main_player), [true, true, true, true, false])
  await query("INSERT INTO day_registrations (member_id, day_code) VALUES ($1,'D-02')", [ids[2]])
  await svc.award({ actor, day: 'D-02' })
  const r2 = await svc.clubDetail({ clubId: A, day: 'D-02' })
  assert.equal(r2.data.sports[0].eligible, true); assert.equal(r2.data.sports[0].awarded, true)
  assert.equal((await svc.clubDetail({ clubId: 99999999, day: 'D-02' })).code, 'club_not_found')
})

test('award is audited', async () => {
  await squad(A, ev.s1, 2, 2, 'D-02'); await svc.award({ actor, day: 'D-02' })
  const { rows } = await query("SELECT action, detail FROM audit_log WHERE actor_id = 51")
  assert.equal(rows[0].action, 'participation.award'); assert.equal(rows[0].detail.sportDay, 'D-02')
})
