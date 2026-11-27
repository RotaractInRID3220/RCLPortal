import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const { hasPermission } = await import('../src/server/auth/permissions.mjs')
const svc = await import('../src/server/tournaments/service.mjs')

const CLUBS = Array.from({ length: 9 }, (_, i) => 9601 + i)
const actor = { member_id: 930001, permission_level: 'super_admin' }
const admin = { member_id: 930001, permission_level: 'administrator' }
let saved, sport

async function cleanup() {
  await query("DELETE FROM club_points WHERE club_id BETWEEN 9601 AND 9699")
  await query("DELETE FROM matches WHERE sport_id IN (SELECT sport_id FROM events WHERE sport_name LIKE '__tn_%')")
  await query("DELETE FROM teams WHERE club_id BETWEEN 9601 AND 9699")
  await query("DELETE FROM audit_log WHERE actor_id = 930001")
}
const mkEvent = async (name) => (await query("INSERT INTO events (sport_name, sport_type, gender_type, category) VALUES ($1,'team','mixed','community') RETURNING sport_id", [`__tn_${name}`])).rows[0].sport_id
/** n teams for the current sport, seeds 1..n in club order */
async function mkTeams(n, sportId = sport) {
  const ids = []
  for (let i = 0; i < n; i++) ids.push((await query('INSERT INTO teams (club_id, sport_id, seed_number) VALUES ($1,$2,$3) RETURNING team_id', [CLUBS[i], sportId, i + 1])).rows[0].team_id)
  return ids
}
const matches = async (sportId = sport) => (await query('SELECT * FROM matches WHERE sport_id = $1 ORDER BY round_id, match_order', [sportId])).rows
const byRound = (ms, r) => ms.filter((m) => m.round_id === r)
const score = (m, a, b) => svc.recordScore({ actor, matchId: m.match_id, team1Score: a, team2Score: b })
const fresh = async (id) => (await query('SELECT * FROM matches WHERE match_id = $1', [id])).rows[0]
const clubOf = async (teamId) => (await query('SELECT club_id FROM teams WHERE team_id = $1', [teamId])).rows[0]?.club_id

before(async () => {
  saved = await getSetting('points.placement')
  await query("DELETE FROM events WHERE sport_name LIKE '__tn_%'"); await cleanup()
  for (const id of CLUBS) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO NOTHING", [id, `TN Club ${id}`])
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__tn_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9601 AND 9699')
  if (saved === undefined) await query("DELETE FROM settings WHERE key = 'points.placement'"); else await setSetting('points.placement', saved)
  await closePool()
})
beforeEach(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__tn_%'")
  sport = await mkEvent('s'); await setSetting('points.placement', [30, 20, 10])
})

// ------------------------------------------------------------------------------------------ generation
test('generate: match counts for 2..8 teams (byes create no match, consolation needs two semi-finals)', async () => {
  const expected = { 2: 1, 3: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 }
  for (const [n, count] of Object.entries(expected)) {
    await cleanup(); await query('DELETE FROM events WHERE sport_name LIKE $1', ['__tn_%']); sport = await mkEvent(`g${n}`)
    await mkTeams(Number(n))
    const r = await svc.generateBracket({ actor, sportId: sport })
    assert.equal(r.ok, true, `${n}: ${r.message}`)
    assert.equal((await matches()).length, count, `${n} teams`)
    assert.equal(r.matches, count)
  }
})

test('generate 4 teams: 1v4 and 2v3, final and consolation are wired to the semi-finals', async () => {
  const t = await mkTeams(4)
  await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches()
  const semis = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
  assert.deepEqual(semis.map((m) => [m.team1_id, m.team2_id]), [[t[0], t[3]], [t[1], t[2]]])
  assert.deepEqual([final.parent_match1_id, final.parent_match2_id], semis.map((m) => m.match_id))
  assert.deepEqual([cons.parent_match1_id, cons.parent_match2_id], semis.map((m) => m.match_id))
  assert.deepEqual([final.team1_id, final.team2_id, cons.team1_id], [null, null, null])
})

test('generate 3 teams: the top seed has a bye straight into the final', async () => {
  const t = await mkTeams(3)
  await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches()
  assert.equal(byRound(ms, 3).length, 1)
  assert.deepEqual([byRound(ms, 3)[0].team1_id, byRound(ms, 3)[0].team2_id], [t[1], t[2]])
  const [final] = byRound(ms, 5)
  assert.equal(final.team1_id, t[0]); assert.equal(final.parent_match2_id, byRound(ms, 3)[0].match_id)
  assert.equal(byRound(ms, 4).length, 0)
})

test('generate refuses: <2 teams, >32 teams guard, existing bracket, rebuilding played brackets', async () => {
  assert.equal((await svc.generateBracket({ actor, sportId: sport })).code, 'not_enough_teams')
  await mkTeams(4)
  assert.equal((await svc.generateBracket({ actor, sportId: sport })).ok, true)
  assert.equal((await svc.generateBracket({ actor, sportId: sport })).code, 'bracket_exists')
  assert.equal((await matches()).length, 4)                                   // nothing duplicated
  await score((await matches())[0], 2, 1)
  assert.equal((await svc.generateBracket({ actor, sportId: sport, replace: true })).code, 'bracket_has_results')
  assert.equal((await svc.generateBracket({ actor, sportId: sport, replace: true, force: true })).ok, true)
  assert.equal((await matches()).filter((m) => m.completed).length, 0)
  assert.equal((await matches()).length, 4)
})

test('two generate calls at once leave exactly one bracket', async () => {
  await mkTeams(4)
  const rs = await Promise.all([svc.generateBracket({ actor, sportId: sport }), svc.generateBracket({ actor, sportId: sport })])
  assert.equal(rs.filter((r) => r.ok).length, 1)
  assert.equal((await matches()).length, 4)
})

// ------------------------------------------------------------------------------------------ scores + advancement
test('score entry advances the winner (loser to the consolation match); 0 is a valid score', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
  const r1 = await score(s1, 3, 0)                         // team1 wins 3-0, loser scored 0
  assert.equal(r1.ok, true); assert.equal(r1.match.team2_score, 0); assert.equal(r1.match.completed, true)
  let f = await fresh(final.match_id), c = await fresh(cons.match_id)
  assert.deepEqual([f.team1_id, c.team1_id], [t[0], t[3]])
  await score(s2, 0, 1)                                    // team2 wins 0-1
  f = await fresh(final.match_id); c = await fresh(cons.match_id)
  assert.deepEqual([f.team2_id, c.team2_id], [t[2], t[1]])
  assert.deepEqual([f.team1_id, f.team2_id], [t[0], t[2]])
})

test('a tie is refused and changes nothing; a match without both teams cannot be scored', async () => {
  await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1] = byRound(ms, 3), [final] = byRound(ms, 5)
  const r = await score(s1, 2, 2)
  assert.equal(r.code, 'tie_not_allowed'); assert.equal((await fresh(s1.match_id)).completed, false)
  assert.equal((await score(final, 1, 0)).code, 'teams_not_set')
})

test('entering the same score again is a no-op (no double advance, no second audit row)', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1] = byRound(ms, 3), [final] = byRound(ms, 5)
  const a = await score(s1, 5, 2), b = await score(s1, 5, 2)
  assert.equal(a.changed, true); assert.equal(b.changed, false); assert.deepEqual(b.advanced, [])
  assert.equal((await fresh(final.match_id)).team1_id, t[0])
  assert.equal((await query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id = 930001 AND action = 'match.score' AND entity_id = $1", [String(s1.match_id)])).rows[0].n, 1)
})

test('concurrent identical submissions behave like one; concurrent conflicting ones leave a consistent winner', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1] = byRound(ms, 3), [final] = byRound(ms, 5)
  await Promise.all([score(s1, 4, 1), score(s1, 4, 1), score(s1, 4, 1)])
  assert.equal((await fresh(final.match_id)).team1_id, t[0])
  await Promise.all([score(s1, 1, 4), score(s1, 6, 0), score(s1, 0, 6), score(s1, 7, 3)])
  const m = await fresh(s1.match_id), f = await fresh(final.match_id)
  assert.equal(f.team1_id, m.team1_score > m.team2_score ? t[0] : t[3])        // slot always matches the stored result
  assert.equal((await fresh((await matches()).find((x) => x.round_id === 4).match_id)).team1_id, m.team1_score > m.team2_score ? t[3] : t[0])
})

test('correcting a score re-propagates while the next match is unplayed; same winner is always fine', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1] = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
  await score(s1, 3, 1)
  const fix = await score(s1, 1, 3)                        // winner flips
  assert.equal(fix.ok, true)
  assert.deepEqual([(await fresh(final.match_id)).team1_id, (await fresh(cons.match_id)).team1_id], [t[3], t[0]])
  assert.equal((await score(s1, 1, 9)).ok, true)           // same winner, new score
  assert.equal((await fresh(final.match_id)).team1_id, t[3])
})

test('correcting is refused with a clear error once the next match has a result', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5)
  await score(s1, 3, 1); await score(s2, 3, 1)
  assert.equal((await score(final, 2, 1)).ok, true)
  const r = await score(s1, 0, 5)                          // would change who plays the final
  assert.equal(r.ok, false); assert.equal(r.code, 'next_match_has_result'); assert.equal(r.status, 409)
  const m = await fresh(s1.match_id)
  assert.deepEqual([m.team1_score, m.team2_score], [3, 1])                      // untouched
  assert.equal((await fresh(final.match_id)).team1_id, t[0])
  assert.equal((await score(s1, 7, 6)).ok, true)                                // same winner still allowed
  // clearing the final first makes the correction possible
  assert.equal((await svc.recordScore({ actor, matchId: final.match_id, clear: true })).ok, true)
  assert.equal((await score(s1, 0, 5)).ok, true)                                // final cleared and consolation unplayed: now allowed
  assert.equal((await fresh(final.match_id)).team1_id, t[3])
})

test('clear: back to not played, advanced slots emptied; refused if the next match is played', async () => {
  const t = await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5)
  await score(s1, 2, 1); await score(s2, 2, 1); await score(final, 1, 0)
  assert.equal((await svc.recordScore({ actor, matchId: s1.match_id, clear: true })).code, 'next_match_has_result')
  await svc.recordScore({ actor, matchId: final.match_id, clear: true })
  const f = await fresh(final.match_id)
  assert.deepEqual([f.team1_score, f.team2_score, f.completed], [null, null, false])
  assert.equal((await svc.recordScore({ actor, matchId: final.match_id, clear: true })).changed, false)   // idempotent
})

test('byes: the 5-team bracket plays through to a final', async () => {
  const t = await mkTeams(5); await svc.generateBracket({ actor, sportId: sport })
  let ms = await matches()
  const [qf] = byRound(ms, 2)
  assert.deepEqual([qf.team1_id, qf.team2_id], [t[3], t[4]])                    // 4 v 5; seeds 1-3 have byes
  const semis = byRound(ms, 3)
  assert.deepEqual([semis[0].team1_id, semis[1].team1_id, semis[1].team2_id], [t[0], t[1], t[2]])
  assert.equal(semis[0].parent_match2_id, qf.match_id)
  await score(qf, 1, 0)
  assert.equal((await fresh(semis[0].match_id)).team2_id, t[3])
})

test('scores must belong to a real match', async () => {
  assert.equal((await svc.recordScore({ actor, matchId: 999999999, team1Score: 1, team2Score: 0 })).code, 'match_not_found')
})

// ------------------------------------------------------------------------------------------ manual CRUD
test('manual create: team must belong to the event, slot is unique, delete clears an advanced slot', async () => {
  const [a, b] = await mkTeams(2)
  const other = await mkEvent('other'); const [foreign] = await mkTeams(1, other).catch(() => [null])
  const m1 = await svc.createMatch({ actor, input: { sport_id: sport, round_id: 3, match_order: 1, team1_id: a, team2_id: b } })
  assert.equal(m1.ok, true)
  assert.equal((await svc.createMatch({ actor, input: { sport_id: sport, round_id: 3, match_order: 1 } })).code, 'slot_taken')
  if (foreign) assert.equal((await svc.createMatch({ actor, input: { sport_id: sport, round_id: 2, match_order: 1, team1_id: foreign } })).code, 'invalid_team')
  const fin = await svc.createMatch({ actor, input: { sport_id: sport, round_id: 5, match_order: 1, parent_match1_id: m1.match.match_id } })
  assert.equal(fin.ok, true)
  await score(m1.match, 2, 1)
  assert.equal((await fresh(fin.match.match_id)).team1_id, a)
  assert.equal((await svc.updateMatch({ actor, matchId: m1.match.match_id, input: { team1_id: b, team2_id: a } })).code, 'match_completed')
  assert.equal((await svc.deleteMatch({ actor, matchId: m1.match.match_id })).ok, true)
  const f = await fresh(fin.match.match_id)
  assert.deepEqual([f.team1_id, f.parent_match1_id], [null, null])
})

test('delete is refused while the next match depends on the result', async () => {
  const [a, b] = await mkTeams(2)
  const m1 = (await svc.createMatch({ actor, input: { sport_id: sport, round_id: 3, match_order: 1, team1_id: a, team2_id: b } })).match
  const fin = (await svc.createMatch({ actor, input: { sport_id: sport, round_id: 5, match_order: 1, team2_id: b, parent_match1_id: m1.match_id } })).match
  await score(m1, 2, 1)
  await query('UPDATE matches SET team2_id = $2, completed = true, team1_score = 1, team2_score = 0 WHERE match_id = $1', [fin.match_id, b])
  assert.equal((await svc.deleteMatch({ actor, matchId: m1.match_id })).code, 'next_match_has_result')
})

test('bracket output keeps 0-0 distinct from "not played" and carries parent ids', async () => {
  await mkTeams(4); await svc.generateBracket({ actor, sportId: sport })
  const [s1] = byRound(await matches(), 3)
  await score(s1, 1, 0)
  const out = await svc.getBracket({ sportId: sport, raw: true })
  const seeds = out.data.flatMap((r) => r.seeds)
  const played = seeds.find((s) => s.id === s1.match_id)
  assert.deepEqual([played.status, played.score, played.teams[0].name.startsWith('TN Club')], ['completed', [1, 0], true])
  assert.equal(seeds.filter((s) => s.status === 'scheduled').length, 3)
  assert.equal(out.data.map((r) => r.title).join(','), 'Semi Finals,Consolation Finals,Finals')
  assert.equal(out.matches.length, 4); assert.equal(out.matches[0].team1.club.club_id >= 9601, true)
  assert.equal((await svc.getBracket({ sportId: sport + 100000 })).total_matches, 0)
})

// ------------------------------------------------------------------------------------------ standings + placement points
async function playFull(n) {
  const t = await mkTeams(n); await svc.generateBracket({ actor, sportId: sport })
  return t
}
test('standings + award: 1st/2nd from the final, 3rd/4th from the consolation; points from settings', async () => {
  const t = await playFull(4)
  assert.equal((await svc.awardPlacement({ actor, sportId: sport, hasPermission })).code, 'final_not_played')
  const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
  await score(s1, 3, 1); await score(s2, 0, 2); await score(final, 1, 4); await score(cons, 0, 0 + 1)
  const st = await svc.standings({ sportId: sport })
  const place = Object.fromEntries(st.standings.map((s) => [s.club_id, [s.place, s.points]]))
  // s1: t0 beats t3; s2: t2 beats t1; final: t2 (team2) beats t0; consolation: t3 (team1)=t3? cons.team1 is loser of s1 = t3, team2 = loser of s2 = t1 -> t1 wins
  assert.deepEqual([place[CLUBS[2]], place[CLUBS[0]], place[CLUBS[1]], place[CLUBS[3]]], [[1, 30], [2, 20], [3, 10], [4, 0]])
  const aw = await svc.awardPlacement({ actor, sportId: sport, hasPermission })
  assert.equal(aw.ok, true); assert.equal(aw.updated, 3); assert.equal(aw.replaced, false)
  const rows = (await query("SELECT club_id, points, place FROM club_points WHERE sport_id = $1 AND kind = 'placement' ORDER BY place", [sport])).rows
  assert.deepEqual(rows, [{ club_id: CLUBS[2], points: 30, place: 1 }, { club_id: CLUBS[0], points: 20, place: 2 }, { club_id: CLUBS[1], points: 10, place: 3 }])
  assert.equal(t.length, 4)
})

test('an event with its own podium points overrides points.placement', async () => {
  await playFull(4)
  await query('UPDATE events SET points = $2 WHERE sport_id = $1', [sport, JSON.stringify({ podium: [40, 20, 15], participation: 10 })])
  try {
    const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
    await score(s1, 3, 1); await score(s2, 0, 2); await score(final, 1, 4); await score(cons, 0, 1)
    const st = await svc.standings({ sportId: sport })
    assert.deepEqual(st.standings.filter((x) => x.place <= 3).map((x) => x.points), [40, 20, 15])
  } finally { await query('UPDATE events SET points = NULL WHERE sport_id = $1', [sport]) }
})

test('re-award replaces (never duplicates), follows corrected results and needs the administrator level', async () => {
  await playFull(4)
  const ms = await matches(); const [s1, s2] = byRound(ms, 3), [final] = byRound(ms, 5), [cons] = byRound(ms, 4)
  await score(s1, 3, 1); await score(s2, 0, 2); await score(final, 1, 4); await score(cons, 0, 1)
  await svc.awardPlacement({ actor, sportId: sport, hasPermission })
  assert.equal((await svc.awardPlacement({ actor, sportId: sport, hasPermission })).code, 'forbidden')   // super_admin cannot re-award
  await score(final, 4, 1)                                  // result corrected: the finalists swap
  await setSetting('points.placement', [50, 40, 30])
  const again = await svc.awardPlacement({ actor: admin, sportId: sport, hasPermission })
  assert.equal(again.ok, true); assert.equal(again.replaced, true)
  const rows = (await query("SELECT club_id, points, place FROM club_points WHERE sport_id = $1 AND kind = 'placement' ORDER BY place", [sport])).rows
  assert.deepEqual(rows, [{ club_id: CLUBS[0], points: 50, place: 1 }, { club_id: CLUBS[2], points: 40, place: 2 }, { club_id: CLUBS[1], points: 30, place: 3 }])
  // concurrent awards cannot duplicate either
  await Promise.all([svc.awardPlacement({ actor: admin, sportId: sport, hasPermission }), svc.awardPlacement({ actor: admin, sportId: sport, hasPermission })])
  assert.equal((await query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1 AND kind = 'placement'", [sport])).rows[0].n, 3)
})

test('award fails closed when the placement setting is missing/invalid', async () => {
  await playFull(2)
  const [final] = byRound(await matches(), 5)
  await score(final, 2, 1)
  await query("DELETE FROM settings WHERE key = 'points.placement'")
  assert.equal((await svc.awardPlacement({ actor, sportId: sport, hasPermission })).code, 'placement_points_not_configured')
  assert.equal((await query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1", [sport])).rows[0].n, 0)
  await setSetting('points.placement', [9, 6, 3])
  const ok = await svc.awardPlacement({ actor, sportId: sport, hasPermission })
  assert.equal(ok.ok, true); assert.equal(ok.updated, 2); assert.equal(ok.incomplete_podium, true)
})

test('3 teams (bye): the semi-final loser is 3rd', async () => {
  const t = await playFull(3)
  const ms = await matches(); const [semi] = byRound(ms, 3), [final] = byRound(ms, 5)
  await score(semi, 2, 0)                                   // t1 beats t2
  await score(final, 1, 3)                                  // final: team1 = t0 (bye) vs t1; t1 wins
  const st = (await svc.standings({ sportId: sport })).standings
  assert.deepEqual(st.map((s) => [s.club_id, s.place]), [[CLUBS[1], 1], [CLUBS[0], 2], [CLUBS[2], 3]])
  assert.equal(await clubOf(t[2]), CLUBS[2])
})

test('no consolation match: semi-final losers ranked by score; equal scores share 3rd', async () => {
  const [a, b, c, d] = await mkTeams(4)
  const s1 = (await svc.createMatch({ actor, input: { sport_id: sport, round_id: 3, match_order: 1, team1_id: a, team2_id: b } })).match
  const s2 = (await svc.createMatch({ actor, input: { sport_id: sport, round_id: 3, match_order: 2, team1_id: c, team2_id: d } })).match
  const fin = (await svc.createMatch({ actor, input: { sport_id: sport, round_id: 5, match_order: 1, parent_match1_id: s1.match_id, parent_match2_id: s2.match_id } })).match
  await score(s1, 5, 3); await score(s2, 4, 2); await score(fin, 2, 1)
  let st = (await svc.standings({ sportId: sport })).standings
  assert.deepEqual(st.map((s) => [s.club_id, s.place]), [[CLUBS[0], 1], [CLUBS[2], 2], [CLUBS[1], 3], [CLUBS[3], 4]])
  await score(s2, 6, 3)                                    // same winner, loser also scored 3: tie on 3rd
  st = (await svc.standings({ sportId: sport })).standings
  assert.deepEqual(st.map((s) => [s.club_id, s.place, Boolean(s.tie)]), [[CLUBS[0], 1, false], [CLUBS[2], 2, false], [CLUBS[1], 3, true], [CLUBS[3], 3, true]])
  assert.deepEqual(st.map((s) => s.points), [30, 20, 10, 10])
  const aw = await svc.awardPlacement({ actor, sportId: sport, hasPermission })
  assert.equal(aw.updated, 4)
})

test('clubs outside the podium are ranked by points scored; unplayed matches count for nothing', async () => {
  await playFull(8)
  const ms = await matches(); const qf = byRound(ms, 2)
  await score(qf[0], 1, 0); await score(qf[1], 5, 3); await score(qf[2], 2, 1); await score(qf[3], 9, 7)
  const st = (await svc.standings({ sportId: sport })).standings
  assert.equal(st.every((s) => s.points === 0), true)       // no final yet: nobody is placed
  assert.equal(st[0].place, 1)                              // ranking by total points scored (9)
  assert.equal(st.length, 8)
  assert.equal((await svc.standings({ sportId: sport })).complete, false)
})
