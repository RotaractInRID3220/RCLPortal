import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const svc = await import('../src/server/teams/service.mjs')

const [A, B, C, D, I1] = [9201, 9202, 9203, 9204, 9205] // A,B,C,D community; I1 institute
const actor = { member_id: 31 }
let ev = {}
async function cleanup() {
  await query('DELETE FROM audit_log WHERE entity = $1 AND actor_id = 31', ['team'])
  await query('DELETE FROM matches WHERE sport_id IN (SELECT sport_id FROM events WHERE sport_name LIKE $1)', ['__tm_%'])
  await query('DELETE FROM teams WHERE club_id BETWEEN 9201 AND 9205')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9201 AND 9205')
  await query('DELETE FROM players WHERE club_id BETWEEN 9201 AND 9205')
}
const mkEvent = async (name, o = {}) => (await query(
  `INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day)
   VALUES ($1,$2,'mixed',$3,$4,10,3,'D-01') RETURNING sport_id`, [`__tm_${name}`, o.type ?? 'team', o.category ?? 'community', 'min' in o ? o.min : 3])).rows[0].sport_id
let pid = 700000
async function register(clubId, sportId, n, { reserves = 0 } = {}) {
  for (let i = 0; i < n + reserves; i++) {
    const id = ++pid
    await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'F',1)", [id, `Player ${id}`, clubId])
    await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,$3,$4)', [id, sportId, clubId, i < n])
  }
}
before(async () => {
  await query("DELETE FROM events WHERE sport_name LIKE '__tm_%'")
  await cleanup()
  for (const [id, cat] of [[A, 'community'], [B, 'community'], [C, 'community'], [D, 'community'], [I1, 'institute']])
    await query(`INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,$3,1) ON CONFLICT (club_id) DO UPDATE SET category = EXCLUDED.category, status = 1`, [id, `Team Club ${String.fromCharCode(65 + id - 9201)}`, cat])
  ev.team = await mkEvent('team', { min: 3 })
  ev.nomin = await mkEvent('nomin', { min: null })
  ev.inst = await mkEvent('inst', { min: 2, category: 'institute' })
  ev.track = await mkEvent('trackind', { type: 'trackIndividual', min: 1 })
  ev.trackTeam = await mkEvent('tracksquad', { type: 'trackTeam', min: 2 })
})
after(async () => {
  await cleanup()
  await query("DELETE FROM events WHERE sport_name LIKE '__tm_%'")
  await query('DELETE FROM clubs WHERE club_id BETWEEN 9201 AND 9205')
  await closePool()
})
beforeEach(async () => { await cleanup() })

const ok = async (p) => { const r = await p; assert.equal(r.ok, true, JSON.stringify(r)); return r }
const bad = async (p, code, status) => { const r = await p; assert.equal(r.ok, false); assert.equal(r.code, code, JSON.stringify(r)); if (status) assert.equal(r.status, status); return r }
const teamClubs = async (sportId) => (await query('SELECT club_id FROM teams WHERE sport_id = $1 ORDER BY club_id', [sportId])).rows.map((r) => r.club_id)

test('bulk create: only clubs with at least min_count registrations (reserves count), in the sport\'s category', async () => {
  await register(A, ev.team, 3)                      // exactly min
  await register(B, ev.team, 2, { reserves: 1 })     // 2 main + 1 reserve = 3
  await register(C, ev.team, 2)                      // below min
  await register(I1, ev.team, 5)                     // institute club in a community sport
  const r = await ok(svc.createTeamsBulk({ actor, sportId: ev.team }))
  assert.deepEqual(await teamClubs(ev.team), [A, B])
  assert.deepEqual([r.created, r.skipped], [2, 0])
  assert.equal(r.results[0].created, 2)
})

test('bulk create is idempotent: a second run creates nothing and reports the existing teams as skipped', async () => {
  await register(A, ev.team, 3); await register(B, ev.team, 4)
  await ok(svc.createTeamsBulk({ actor, sportId: ev.team }))
  const again = await ok(svc.createTeamsBulk({ actor, sportId: ev.team }))
  assert.deepEqual([again.created, again.skipped], [0, 2])
  assert.match(again.results[0].message, /already exist/)
  assert.equal((await teamClubs(ev.team)).length, 2)
})

test('4 admins creating teams at once: exactly one team per eligible club', async () => {
  await register(A, ev.team, 3); await register(B, ev.team, 3); await register(C, ev.team, 3)
  const rs = await Promise.all(Array.from({ length: 4 }, () => svc.createTeamsBulk({ actor, sportId: ev.team })))
  assert.ok(rs.every((r) => r.ok))
  assert.deepEqual(await teamClubs(ev.team), [A, B, C])
  assert.equal(rs.reduce((n, r) => n + r.created, 0), 3)
})

test('no min_count means at least one registration is enough; zero registrations is never eligible', async () => {
  await register(A, ev.nomin, 1)
  await ok(svc.createTeamsBulk({ actor, sportId: ev.nomin }))
  assert.deepEqual(await teamClubs(ev.nomin), [A])
})

test('all-sports mode covers team, trackTeam and individual sports but not trackIndividual', async () => {
  await register(A, ev.track, 3); await register(A, ev.trackTeam, 2); await register(A, ev.team, 3); await register(I1, ev.inst, 2)
  const r = await ok(svc.createTeamsBulk({ actor }))
  assert.deepEqual(await teamClubs(ev.track), [])                  // individual track entries are not teams
  assert.deepEqual(await teamClubs(ev.trackTeam), [A])
  assert.deepEqual(await teamClubs(ev.team), [A])
  assert.deepEqual(await teamClubs(ev.inst), [I1])
  assert.ok(r.created >= 3 && r.results.some((x) => x.sport_id === ev.inst && x.created === 1))
})

test('bulk create for an unknown sport is 404', async () => {
  await bad(svc.createTeamsBulk({ actor, sportId: 99999999 }), 'sport_not_found', 404)
})

test('manual add: allowed below the minimum; category must match; duplicates are 409; unknowns are 404', async () => {
  await register(D, ev.team, 1)
  await ok(svc.addTeamManual({ actor, sportId: ev.team, clubId: D }))
  assert.deepEqual(await teamClubs(ev.team), [D])
  await bad(svc.addTeamManual({ actor, sportId: ev.team, clubId: D }), 'team_exists', 409)
  await bad(svc.addTeamManual({ actor, sportId: ev.team, clubId: I1 }), 'category_mismatch', 422)
  await bad(svc.addTeamManual({ actor, sportId: ev.team, clubId: 99999999 }), 'club_not_found', 404)
  await bad(svc.addTeamManual({ actor, sportId: 99999999, clubId: A }), 'sport_not_found', 404)
  const rs = await Promise.all(Array.from({ length: 5 }, () => svc.addTeamManual({ actor, sportId: ev.nomin, clubId: A })))
  assert.equal(rs.filter((r) => r.ok).length, 1)
})

test('delete: removes the team; blocked once matches reference it; unknown is 404; audited', async () => {
  await register(A, ev.team, 3); await register(B, ev.team, 3)
  await ok(svc.createTeamsBulk({ actor, sportId: ev.team }))
  const [{ team_id: a }, { team_id: b }] = (await query('SELECT team_id FROM teams WHERE sport_id = $1 ORDER BY club_id', [ev.team])).rows
  await query('INSERT INTO matches (sport_id, round_id, team1_id, team2_id) VALUES ($1, 0, $2, $3)', [ev.team, a, b])
  await bad(svc.deleteTeam({ actor, teamId: a }), 'team_in_use', 409)
  assert.equal((await teamClubs(ev.team)).length, 2)                    // nothing was removed
  await query('DELETE FROM matches WHERE sport_id = $1', [ev.team])
  await ok(svc.deleteTeam({ actor, teamId: a }))
  assert.deepEqual(await teamClubs(ev.team), [B])
  await bad(svc.deleteTeam({ actor, teamId: a }), 'team_not_found', 404)
  const { rows } = await query("SELECT action FROM audit_log WHERE entity = 'team' AND actor_id = 31 ORDER BY id")
  assert.deepEqual(rows.map((r) => r.action), ['team.create_bulk', 'team.delete'])
})

test('team list: nested registrations with player names (main first), counts, eligible clubs exclude clubs that have a team; search', async () => {
  await register(A, ev.team, 3, { reserves: 1 }); await register(B, ev.team, 3); await register(C, ev.team, 3)
  await ok(svc.addTeamManual({ actor, sportId: ev.team, clubId: A })); await ok(svc.addTeamManual({ actor, sportId: ev.team, clubId: B }))
  const res = await ok(svc.listTeamsForSport({ sportId: ev.team }))
  assert.equal(res.sport_name, '__tm_team')
  assert.deepEqual(res.teams.map((t) => t.club_id), [A, B])                 // most players first
  const t = res.teams[0]
  assert.equal(t.player_count, 4); assert.equal(t.clubs.club_name, 'Team Club A')
  assert.deepEqual(t.registrations.map((r) => r.main_player), [true, true, true, false])
  assert.ok(t.registrations.every((r) => r.players.name.startsWith('Player ') && r.member_id))
  assert.deepEqual(res.eligible_clubs.map((c) => c.club_id), [C])           // C qualifies but has no team yet
  assert.equal(res.eligible_clubs[0].count, 3)
  assert.deepEqual((await ok(svc.listTeamsForSport({ sportId: ev.team, search: 'club b' }))).teams.map((x) => x.club_id), [B])
  assert.equal((await ok(svc.listTeamsForSport({ sportId: ev.team, search: '%%%' }))).teams.length, 0)
  await bad(svc.listTeamsForSport({ sportId: 99999999 }), 'sport_not_found', 404)
})

test('non-eligible: clubs with some but too few registrations and no team, most registrations first', async () => {
  await register(A, ev.team, 2); await register(B, ev.team, 1); await register(C, ev.team, 3); await register(D, ev.team, 2)
  await ok(svc.addTeamManual({ actor, sportId: ev.team, clubId: D }))     // has a team -> not listed
  const r = await ok(svc.nonEligibleClubs(ev.team))
  assert.deepEqual(r.non_eligible_clubs.map((c) => [c.club_id, c.registration_count]), [[A, 2], [B, 1]])
  assert.equal(r.min_count, 3)
})

test('available clubs: category clubs only, clubs without a team first, then by registrations, then name', async () => {
  await register(A, ev.team, 1); await register(B, ev.team, 4); await register(C, ev.team, 2)
  await ok(svc.addTeamManual({ actor, sportId: ev.team, clubId: B }))
  const r = await ok(svc.availableClubs(ev.team))
  const mine = r.available_clubs.filter((c) => [A, B, C, D, I1].includes(c.club_id))
  assert.deepEqual(mine.map((c) => [c.club_id, c.has_team]), [[C, false], [A, false], [D, false], [B, true]])
  assert.ok(!mine.some((c) => c.club_id === I1))                           // institute club not offered for a community sport
})
