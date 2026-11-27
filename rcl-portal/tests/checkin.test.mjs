import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/checkin/service.mjs')

const [A, B] = [9501, 9502]
const actor = { member_id: 52 }
const KEYS = ['checkin.open', 'checkin.current_day', 'checkin.require_registration']
let saved = {}, ev = {}
const P = { a: 920001, b: 920002, c: 920003, d: 920004 }
async function cleanup() {
  await query('DELETE FROM day_registrations WHERE member_id BETWEEN 920001 AND 920099')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9501 AND 9502')
  await query('DELETE FROM players WHERE club_id BETWEEN 9501 AND 9502')
}
const mkEvent = async (name, day) => (await query(
  "INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ($1,'team','mixed','community',$2) RETURNING sport_id", [`__ci_${name}`, day])).rows[0].sport_id
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__ci_%'"); await cleanup()
  for (const [id, n] of [[A, 'A'], [B, 'B']]) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO UPDATE SET status = 1", [id, `Checkin Club ${n}`])
  ev.d1 = await mkEvent('d1', 'D-01'); ev.d2 = await mkEvent('d2', 'D-02')
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__ci_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9501 AND 9502')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await query("INSERT INTO players (member_id, membership_id, name, nic, club_id, gender, status) VALUES ($1,'CIA1','Ann One','111111111V',$2,'F',1), ($3,'CIA2','Bob Two','222222222V',$2,'M',1), ($4,'CIB1','Cy Three','333333333V',$5,'M',1), ($6,'CIB2','Di Four','444444444V',$5,'F',1)",
    [P.a, A, P.b, P.c, B, P.d])
  await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,true), ($4,$2,$3,true), ($5,$6,$7,true)', [P.a, ev.d1, A, P.b, P.c, ev.d2, B])
  await setSetting('checkin.open', true); await setSetting('checkin.current_day', 'D-01'); await query("DELETE FROM settings WHERE key = 'checkin.require_registration'")
})

test('player numbers: day code + registration id padded to 4, parsed back using the known day codes', () => {
  assert.equal(svc.formatPlayerNumber('D-01', 32), 'D-010032')
  assert.equal(svc.formatPlayerNumber('D-05', 12345), 'D-0512345')
  const days = ['D-01', 'D-02', 'D-05']
  assert.deepEqual(svc.parsePlayerNumber('d-010032', days), { dayCode: 'D-01', registrationId: 32 })
  assert.deepEqual(svc.parsePlayerNumber(' D-0512345 ', days), { dayCode: 'D-05', registrationId: 12345 })
  assert.equal(svc.parsePlayerNumber('D-99001', days), null)
  assert.equal(svc.parsePlayerNumber('D-01', days), null)
  assert.equal(svc.parsePlayerNumber('D-01abc', days), null)
})

test('check-in: needs check-in open, a current day, and the right day', async () => {
  await setSetting('checkin.open', false)
  assert.equal((await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })).code, 'checkin_closed')
  await setSetting('checkin.open', true)
  assert.equal((await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-02' })).code, 'wrong_day')
  await query("DELETE FROM settings WHERE key = 'checkin.current_day'")
  assert.equal((await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })).code, 'no_current_day')
  assert.equal((await query('SELECT count(*)::int n FROM day_registrations WHERE member_id = $1', [P.a])).rows[0].n, 0)
})

test('check-in: first scan works, second answers already_checked_in with the original record', async () => {
  const r1 = await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })
  assert.equal(r1.ok, true); assert.equal(r1.registration.approved_by, 52); assert.equal(r1.registration.day_code, 'D-01')
  const r2 = await svc.checkIn({ actor: { member_id: 53 }, memberId: P.a, dayCode: 'D-01' })
  assert.equal(r2.ok, false); assert.equal(r2.code, 'already_checked_in'); assert.equal(r2.status, 409)
  assert.equal(r2.registration.id, r1.registration.id); assert.equal(r2.registration.approved_by, 52)
})

test('check-in: simultaneous scans of the same player create exactly one record', async () => {
  const res = await Promise.all(Array.from({ length: 8 }, () => svc.checkIn({ actor, memberId: P.b, dayCode: 'D-01' })))
  assert.equal(res.filter((r) => r.ok).length, 1)
  assert.equal(res.filter((r) => r.code === 'already_checked_in').length, 7)
  assert.equal((await query('SELECT count(*)::int n FROM day_registrations WHERE member_id = $1', [P.b])).rows[0].n, 1)
})

test('check-in: unknown player, and a player with no sport that day (switchable)', async () => {
  assert.equal((await svc.checkIn({ actor, memberId: 929999, dayCode: 'D-01' })).code, 'player_not_found')
  assert.equal((await svc.checkIn({ actor, memberId: P.c, dayCode: 'D-01' })).code, 'not_registered_for_day')   // Cy only plays D-02
  await setSetting('checkin.require_registration', false)
  assert.equal((await svc.checkIn({ actor, memberId: P.c, dayCode: 'D-01' })).ok, true)
})

test('verifyPlayer: by member id or membership id, sports of that day only, old field names kept', async () => {
  const byId = await svc.verifyPlayer(String(P.a), 'D-01')
  const byMid = await svc.verifyPlayer('cia1', 'D-01')
  assert.equal(byId.player.member_id, P.a); assert.equal(byMid.player.member_id, P.a)
  assert.equal(byId.player.RMIS_ID, 'CIA1'); assert.equal(byId.player.NIC, '111111111V'); assert.equal(byId.player.clubs.club_name, 'Checkin Club A')
  assert.equal(byId.sports.length, 1); assert.equal(byId.sports[0].events.sport_day, 'D-01'); assert.equal(byId.sports[0].player_number, svc.formatPlayerNumber('D-01', byId.sports[0].id))
  assert.equal(byId.registration.isRegistered, false)
  assert.equal((await svc.verifyPlayer(String(P.a), 'D-02')).sports.length, 0)
  await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })
  assert.equal((await svc.verifyPlayer('CIA1', 'D-01')).registration.isRegistered, true)
  assert.equal(await svc.verifyPlayer('nobody', 'D-01'), null)
})

test('list of checked-in players per event, with summary', async () => {
  await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })
  const r = await svc.listDayCheckins({ dayCode: 'D-01' })
  const e = r.events.find((x) => x.sport_id === ev.d1)
  assert.equal(e.registrationCount, 1); assert.equal(e.registrations[0].member_id, P.a); assert.equal(e.registrations[0].club_name, 'Checkin Club A')
  assert.equal(r.events.find((x) => x.sport_id === ev.d2), undefined)             // D-02 event not in a D-01 filter
  assert.ok(r.summary.byDay['D-01'] >= 1)
  const one = await svc.listDayCheckins({ sportId: ev.d1 })
  assert.deepEqual(one.events.map((x) => x.sport_id), [ev.d1])
})

test('player numbers list: whole day, search page, export, and checked-in flag', async () => {
  await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })
  const all = await svc.listPlayerNumbers({ dayCode: 'D-01' })
  const mine = all.data.filter((x) => [P.a, P.b].includes(x.memberId))
  assert.equal(mine.length, 2); assert.equal(all.isFullDataset, true)
  assert.equal(mine.find((x) => x.memberId === P.a).isDayRegistered, true); assert.equal(mine.find((x) => x.memberId === P.b).isDayRegistered, false)
  assert.match(mine[0].playerNumber, /^D-01\d{4,}$/)
  const s = await svc.listPlayerNumbers({ dayCode: 'D-01', search: 'ann one', page: 1, limit: 10 })
  assert.deepEqual(s.data.map((x) => x.memberId), [P.a]); assert.equal(s.totalCount, 1); assert.equal(s.isFullDataset, false)
  assert.equal((await svc.listPlayerNumbers({ dayCode: 'D-01', search: '100%_' })).totalCount, 0)   // wildcards are literal
  const exp = await svc.exportPlayerNumbers({ dayCode: 'D-02' })
  assert.ok(exp.some((x) => x.rmisId === 'CIB1'))                                   // the full RMIS ID with the club prefix, not the numeric id
  assert.equal(mine.find((x) => x.memberId === P.a).rmisId, 'CIA1')
  assert.equal(mine.find((x) => x.memberId === P.a).bib, null)                      // chess day: no bib event
})

test('lookup: by player number, membership id, member id and NIC; ambiguous and unknown', async () => {
  const { data: first } = (await svc.lookupPlayer({ queryText: 'CIA1', dayCode: 'D-01' }))
  const number = first.playerNumber
  assert.match(number, /^D-01\d{4,}$/)
  for (const [q, type] of [[number, 'playerNumber'], [number.toLowerCase(), 'auto'], ['CIA1', 'rmisId'], [String(P.a), 'rmisId'], ['111111111v', 'nic'], [' 1111 11111V ', 'nic']]) {
    const r = await svc.lookupPlayer({ queryText: q, searchType: type, dayCode: 'D-01' })
    assert.equal(r.ok, true, `${type} ${q}: ${JSON.stringify(r)}`); assert.equal(r.data.player.member_id, P.a); assert.equal(r.data.sports[0].playerNumber, number)
  }
  assert.equal((await svc.lookupPlayer({ queryText: 'CIA1', dayCode: 'D-02' })).status, 404)      // not playing on D-02
  assert.equal((await svc.lookupPlayer({ queryText: 'D-019999', dayCode: 'D-01' })).status, 404)
  assert.equal((await svc.lookupPlayer({ queryText: 'D-99', searchType: 'playerNumber', dayCode: 'D-01' })).status, 400)
  assert.equal((await svc.lookupPlayer({ queryText: '  ', dayCode: 'D-01' })).status, 400)
})

test('day stats: registered vs checked-in per day, in one pass', async () => {
  await svc.checkIn({ actor, memberId: P.a, dayCode: 'D-01' })
  const before = (await svc.dayStats()).find((s) => s.sportDay === 'D-01')
  assert.ok(before.dayRegistered >= 1 && before.uniquePlayers >= 2)
  assert.equal(before.dayRegistered + before.notDayRegistered, before.uniquePlayers)
  assert.equal(before.dayRegistrationRate, Math.round((before.dayRegistered / before.uniquePlayers) * 100))
  assert.ok((await svc.dayStats()).length >= 4)
})
