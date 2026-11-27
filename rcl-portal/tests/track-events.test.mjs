import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/track/service.mjs')

const [A, B, C, D] = [9701, 9702, 9703, 9704]
const sa = { member_id: 940001, permission_level: 'super_admin' }
const adm = { member_id: 940002, permission_level: 'administrator' }
const lowAdmin = { member_id: 940003, permission_level: 'admin' }
const KEYS = ['points.track_individual', 'points.track_team', 'points.track_participation']
let saved = {}, ev = {}, pid = 940100
const players = {}

async function cleanup() {
  await query("DELETE FROM club_points WHERE club_id BETWEEN 9701 AND 9799")
  await query("DELETE FROM track_events WHERE sport_id IN (SELECT sport_id FROM events WHERE sport_name LIKE '\\_\\_tk\\_%')")
  await query("DELETE FROM audit_log WHERE actor_id BETWEEN 940001 AND 940003")
}
const mkEvent = async (name, type) => (await query(
  "INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ($1,$2,'mixed','community','D-03') RETURNING sport_id", [`__tk_${name}`, type])).rows[0].sport_id
async function player(club) {
  const id = ++pid
  await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'M',1)", [id, `TK${id}`, club])
  return id
}
const reg = (m, sport, club, main = true) => query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,$4)', [m, sport, club, main])
const pts = async (sport) => (await query("SELECT club_id, points, place FROM club_points WHERE sport_id = $1 AND kind = 'track' ORDER BY club_id", [sport])).rows

before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '\\_\\_tk\\_%'")
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9701 AND 9799'); await cleanup()
  await query('DELETE FROM players WHERE club_id BETWEEN 9701 AND 9799')
  for (const [id, n] of [[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']]) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO UPDATE SET status = 1", [id, `Track Club ${n}`])
  ev.ind = await mkEvent('100m', 'trackIndividual'); ev.team = await mkEvent('relay', 'trackTeam'); ev.normal = await mkEvent('plain', 'individual')
  for (const [k, club] of [['a1', A], ['a2', A], ['b1', B], ['c1', C], ['d1', D]]) { players[k] = await player(club); await reg(players[k], ev.ind, club) }
  players.cres = await player(C); await reg(players.cres, ev.ind, C, false)
  for (const club of [A, B, C]) await query('INSERT INTO teams (club_id, sport_id) VALUES ($1,$2)', [club, ev.team])
})
after(async () => {
  await query('DELETE FROM teams WHERE club_id BETWEEN 9701 AND 9799')
  await cleanup(); await query('DELETE FROM registrations WHERE club_id BETWEEN 9701 AND 9799')
  await query("DELETE FROM events WHERE sport_name LIKE '\\_\\_tk\\_%'"); await query('DELETE FROM players WHERE club_id BETWEEN 9701 AND 9799'); await query('DELETE FROM clubs WHERE club_id BETWEEN 9701 AND 9799')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await setSetting('points.track_individual', [85, 50, 30]); await setSetting('points.track_team', [100, 75, 50]); await setSetting('points.track_participation', 15)
})
const m = (k, score, place) => ({ member_id: players[k], score, place })

test('entries: registered main players listed without sync, reserves separate, portal view hides member ids', async () => {
  const r = await svc.getEntries({ sportId: ev.ind, admin: true })
  assert.equal(r.data.entries.length, 5); assert.equal(r.data.reserves.length, 1)
  assert.ok(r.data.entries.every((e) => e.id === null && e.place === null && e.score === ''))
  const pub = await svc.getEntries({ sportId: ev.ind, admin: false })
  assert.equal(pub.data.entries[0].member_id, undefined); assert.deepEqual(pub.data.reserves, [])
  assert.equal((await svc.getEntries({ sportId: ev.normal })).status, 400)
  assert.equal((await svc.getEntries({ sportId: 99999999 })).status, 404)
})

test('save is idempotent, upserts, and can reorder (swap places) in one go', async () => {
  const p1 = [m('a1', '10.5', 1), m('b1', '10.9', 2), m('c1', '11.0', 3)]
  assert.equal((await svc.saveResults({ actor: adm, sportId: ev.ind, results: p1 })).ok, true)
  assert.equal((await svc.saveResults({ actor: adm, sportId: ev.ind, results: p1 })).ok, true)
  assert.equal((await query('SELECT count(*)::int n FROM track_events WHERE sport_id = $1', [ev.ind])).rows[0].n, 3)
  const swapped = [m('a1', '10.5', 2), m('b1', '10.9', 1), m('c1', '11.0', 3)]
  assert.equal((await svc.saveResults({ actor: adm, sportId: ev.ind, results: swapped })).ok, true)
  const e = (await svc.getEntries({ sportId: ev.ind, admin: true })).data.entries
  assert.deepEqual(e.slice(0, 3).map((x) => x.member_id), [players.b1, players.a1, players.c1])
  assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE action = 'track.save_results' AND actor_id = $1", [adm.member_id])).rows[0].n, 3)
})

test('validation: duplicate positions, non-integer, zero, bad score, outsiders, wrong id kind', async () => {
  const bad = async (results, code) => { const r = await svc.saveResults({ actor: adm, sportId: ev.ind, results }); assert.equal(r.ok, false); assert.equal(r.code, code, JSON.stringify(results)) }
  await bad([m('a1', '10', 1), m('b1', '11', 1)], 'duplicate_place')
  await bad([m('a1', '10', 1.5)], 'invalid_place')
  await bad([m('a1', '10', 0)], 'invalid_place')
  await bad([m('a1', '10', -2)], 'invalid_place')
  await bad([m('a1', 'fast', 1)], 'invalid_score')
  await bad([m('a1', '10', 1), m('a1', '11', 2)], 'duplicate_entry')
  await bad([m('cres', '10', 1)], 'not_an_entry')             // reserve is not an entry
  await bad([{ member_id: 1, score: '1', place: 1 }], 'not_an_entry')
  await bad([{ team_id: 1, score: '1', place: 1 }], 'invalid_request')
  assert.equal((await query('SELECT count(*)::int n FROM track_events WHERE sport_id = $1', [ev.ind])).rows[0].n, 0, 'nothing partially saved')
  assert.equal((await svc.saveResults({ actor: adm, sportId: ev.normal, results: [m('a1', '10', 1)] })).code, 'not_track_event')
  for (const s of ['12.34', '1:02.5', '0:59.99', '1:02:03.4', '9']) assert.ok(svc.SCORE_RE.test(s), s)
})

test('a failing save rolls back completely (one bad row among good ones)', async () => {
  await svc.saveResults({ actor: adm, sportId: ev.ind, results: [m('a1', '10.5', 1)] })
  const r = await svc.saveResults({ actor: adm, sportId: ev.ind, results: [m('b1', '10', 2), { member_id: 1, score: '1', place: 3 }] })
  assert.equal(r.ok, false)
  const rows = (await query('SELECT member_id, place FROM track_events WHERE sport_id = $1', [ev.ind])).rows
  assert.deepEqual(rows.map((x) => x.member_id), [players.a1]); assert.equal(rows[0].place, 1)
})

test('award individual: 1/2/3 from settings, others participation, club with 2 entries summed in ONE row, unranked get nothing', async () => {
  await svc.saveResults({ actor: sa, sportId: ev.ind, results: [m('a1', '10', 1), m('b1', '11', 2), m('c1', '12', 3), m('a2', '13', 4), m('d1', '14', 5), { member_id: players.cres, score: null, place: null }].slice(0, 5) })
  const r = await svc.award({ actor: sa, sportId: ev.ind })
  assert.equal(r.ok, true); assert.equal(r.updated, 4)
  assert.deepEqual(await pts(ev.ind), [
    { club_id: A, points: 85 + 15, place: 1 }, { club_id: B, points: 50, place: 2 }, { club_id: C, points: 30, place: 3 }, { club_id: D, points: 15, place: 5 }])
})

test('award team uses points.track_team; points follow settings changes', async () => {
  await setSetting('points.track_team', [10, 7, 5]); await setSetting('points.track_participation', 2)
  const t = (await query('SELECT team_id, club_id FROM teams WHERE sport_id = $1', [ev.team])).rows
  const team = (club) => t.find((x) => x.club_id === club).team_id
  await svc.saveResults({ actor: sa, sportId: ev.team, results: [{ team_id: team(B), score: '40.1', place: 1 }, { team_id: team(A), score: '41', place: 2 }, { team_id: team(C), score: '42', place: 4 }] })
  await svc.award({ actor: sa, sportId: ev.team })
  assert.deepEqual(await pts(ev.team), [{ club_id: A, points: 7, place: 2 }, { club_id: B, points: 10, place: 1 }, { club_id: C, points: 2, place: 4 }])
  assert.equal((await svc.saveResults({ actor: sa, sportId: ev.team, results: [{ member_id: players.a1, place: 1 }] })).code, 'invalid_request')
})

test('awarding twice replaces (no duplicates); edited results + re-award; dropped clubs removed', async () => {
  await svc.saveResults({ actor: sa, sportId: ev.ind, results: [m('a1', '10', 1), m('b1', '11', 2), m('c1', '12', 3)] })
  await svc.award({ actor: sa, sportId: ev.ind })
  const again = await svc.award({ actor: adm, sportId: ev.ind })
  assert.equal(again.ok, true); assert.equal(again.summary.reaward, true)
  assert.equal((await pts(ev.ind)).length, 3)
  await svc.saveResults({ actor: adm, sportId: ev.ind, results: [m('a1', '10', 2), m('b1', '11', 1), m('c1', null, null)] })
  const r = await svc.award({ actor: adm, sportId: ev.ind })
  assert.equal(r.summary.removed, 1)
  assert.deepEqual(await pts(ev.ind), [{ club_id: A, points: 50, place: 2 }, { club_id: B, points: 85, place: 1 }])
  assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE action IN ('track.award','track.reaward') AND actor_id IN (940001, 940002)")).rows[0].n, 3)
})

test('permissions: first award needs super_admin, re-award needs administrator', async () => {
  await svc.saveResults({ actor: lowAdmin, sportId: ev.ind, results: [m('a1', '10', 1)] })   // saving results: any admin
  assert.equal((await svc.award({ actor: lowAdmin, sportId: ev.ind })).status, 403)
  assert.equal((await svc.award({ actor: sa, sportId: ev.ind })).ok, true)
  assert.equal((await svc.award({ actor: sa, sportId: ev.ind })).status, 403)                // super_admin cannot re-award
  assert.equal((await svc.award({ actor: adm, sportId: ev.ind })).ok, true)
  assert.equal((await pts(ev.ind)).length, 1)
})

test('concurrent awards and saves never duplicate or deadlock', async () => {
  await svc.saveResults({ actor: sa, sportId: ev.ind, results: [m('a1', '10', 1), m('b1', '11', 2)] })
  await svc.award({ actor: sa, sportId: ev.ind })
  const rs = await Promise.all([1, 2, 3, 4].map(() => svc.award({ actor: adm, sportId: ev.ind })))
  assert.ok(rs.every((r) => r.ok))
  assert.equal((await pts(ev.ind)).length, 2)
  const saves = await Promise.all([1, 2, 3].map(() => svc.saveResults({ actor: adm, sportId: ev.ind, results: [m('a1', '10', 2), m('b1', '11', 1)] })))
  assert.ok(saves.every((r) => r.ok))
})

test('award fails closed when point settings are missing; other kinds are never touched', async () => {
  await query("DELETE FROM settings WHERE key = 'points.track_participation'")
  await svc.saveResults({ actor: sa, sportId: ev.ind, results: [m('a1', '10', 1)] })
  assert.equal((await svc.award({ actor: sa, sportId: ev.ind })).status, 503)
  await setSetting('points.track_participation', 15)
  await query("INSERT INTO club_points (club_id, sport_id, kind, points) VALUES ($1,$2,'participation',15)", [A, ev.ind])
  await svc.award({ actor: sa, sportId: ev.ind })
  assert.equal((await query("SELECT count(*)::int n FROM club_points WHERE sport_id = $1 AND kind = 'participation'", [ev.ind])).rows[0].n, 1)
})

test('sync adds missing entries, keeps results, drops entries whose player was unregistered', async () => {
  const r1 = await svc.sync({ actor: adm, sportId: ev.ind })
  assert.equal(r1.inserted, 5)
  await svc.saveResults({ actor: adm, sportId: ev.ind, results: [m('a1', '10', 1)] })
  await query('DELETE FROM registrations WHERE member_id = $1 AND sport_id = $2', [players.d1, ev.ind])
  const r2 = await svc.sync({ actor: adm, sportId: ev.ind })
  assert.deepEqual([r2.inserted, r2.deleted], [0, 1])
  assert.equal((await query('SELECT place FROM track_events WHERE member_id = $1 AND sport_id = $2', [players.a1, ev.ind])).rows[0].place, 1)
  await reg(players.d1, ev.ind, D)
  assert.equal((await svc.sync({ actor: adm, sportId: 99999999 })).status, 404)
})

test('pointsForPlace maps 1-3 to the podium and everything else to participation', () => {
  assert.deepEqual([1, 2, 3, 4, 20].map((p) => svc.pointsForPlace(p, [9, 6, 3], 1)), [9, 6, 3, 1, 1])
})
