import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/penalties/service.mjs')
const { RmisError } = await import('../src/server/rmis/client.mjs')

const [A, B, C, D] = [9301, 9302, 9303, 9304]
const actor = { member_id: 41 }
const KEYS = ['penalty.tiers', 'penalty.min_players', 'rmis.changes_watermark']
let saved = {}, evId, pid = 800000
const noRefresh = { actor, refresh: false }
const mine = (res) => res.results.filter((r) => [A, B, C, D].includes(r.club_id))
const penaltyRows = async () => (await query("SELECT club_id, points FROM club_points WHERE kind = 'penalty' AND club_id BETWEEN 9301 AND 9304 ORDER BY club_id")).rows

async function cleanup() {
  await query("DELETE FROM club_points WHERE club_id BETWEEN 9301 AND 9304")
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9301 AND 9304')
  await query('DELETE FROM players WHERE club_id BETWEEN 9301 AND 9304')
  await query("DELETE FROM audit_log WHERE actor_id = 41")
}
/** `general` players with status 1 and `prospective` with status 5, all registered unless unregistered:true */
async function club(clubId, general, prospective, { unregistered = 0 } = {}) {
  const mk = async (status, registered) => {
    const id = ++pid
    await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'F',$4)", [id, `P${id}`, clubId, status])
    if (registered) await query('INSERT INTO registrations (member_id, sport_id, club_id) VALUES ($1,$2,$3)', [id, evId, clubId])
  }
  for (let i = 0; i < general; i++) await mk(1, true)
  for (let i = 0; i < prospective; i++) await mk(5, true)
  for (let i = 0; i < unregistered; i++) await mk(5, false)
}
before(async () => {
  for (const k of KEYS) saved[k] = await getSetting(k)
  await query("DELETE FROM events WHERE sport_name LIKE '__pn_%'")
  await cleanup()
  for (const [id, n] of [[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']]) await query(`INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO UPDATE SET status = 1`, [id, `Penalty Club ${n}`])
  evId = (await query("INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ('__pn_ev','individual','mixed','community','D-01') RETURNING sport_id")).rows[0].sport_id
})
after(async () => {
  await cleanup()
  await query("DELETE FROM events WHERE sport_name LIKE '__pn_%'")
  await query('DELETE FROM clubs WHERE club_id BETWEEN 9301 AND 9304')
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => {
  await cleanup()
  await setSetting('penalty.tiers', [{ lt: 62, points: -80 }, { lt: 67, points: -50 }, { lt: 70, points: -25 }])
  await setSetting('penalty.min_players', 5)
})

test('preview: figures and the penalty the rules give; nothing is written', async () => {
  await club(A, 6, 4); await club(B, 7, 3); await club(C, 1, 3)       // 60%, 70%, 25% but only 4 players
  const p = await svc.previewMembership()
  const row = (id) => p.clubs.find((c) => c.club_id === id)
  assert.deepEqual([row(A).general_members_count, row(A).prospective_members_count, row(A).total_players_count, row(A).deduction], [6, 4, 10, -80])
  assert.equal(row(A).general_member_percentage, 60)
  assert.equal(row(B).deduction, 0)                                    // exactly 70%
  assert.equal(row(C).deduction, 0)                                    // below the 5-player minimum
  assert.equal(row(A).pending_change, true); assert.equal(row(B).pending_change, false)
  assert.deepEqual(await penaltyRows(), [])
})

test('apply sets one penalty row per club; clubs at or above the target get none', async () => {
  await club(A, 6, 4); await club(B, 7, 3); await club(C, 20, 10); await club(D, 1, 3)   // -80, 0, 66.7% -> -50, too small
  const r = await svc.applyMembershipRules(noRefresh)
  assert.equal(r.ok, true)
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -80 }, { club_id: C, points: -50 }])
  assert.equal(mine(r).find((x) => x.club_id === A).changed, true)
  assert.equal(r.penalised >= 2, true)
})

test('REGRESSION (the original bug): applying again and again never stacks penalties', async () => {
  await club(A, 6, 4)
  for (let i = 0; i < 6; i++) await svc.applyMembershipRules(noRefresh)
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -80 }])        // one row, -80, not -480
  const { rows } = await query("SELECT sum(points)::int AS s FROM club_points WHERE club_id = $1", [A])
  assert.equal(rows[0].s, -80)
  const again = await svc.applyMembershipRules(noRefresh)
  assert.equal(again.changed === 0 || mine(again).every((x) => !x.changed), true) // second pass reports no change for our clubs
})

test('8 admins applying at the same moment: still one row, same value', async () => {
  await club(A, 6, 4); await club(C, 20, 10)
  const rs = await Promise.all(Array.from({ length: 8 }, () => svc.applyMembershipRules(noRefresh)))
  assert.ok(rs.every((r) => r.ok))
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -80 }, { club_id: C, points: -50 }])
})

test('the penalty follows the club: it is raised, lowered and removed as the share changes', async () => {
  await club(A, 6, 4)                                                          // 60% -> -80
  await svc.applyMembershipRules(noRefresh)
  await club(A, 1, 0)                                                          // 7/11 = 63.6% -> -50
  let r = await svc.applyMembershipRules(noRefresh)
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -50 }])
  assert.equal(mine(r).find((x) => x.club_id === A).previous, -80)
  await club(A, 6, 0)                                                          // 13/17 = 76% -> none
  r = await svc.applyMembershipRules(noRefresh)
  assert.deepEqual(await penaltyRows(), [])
  assert.equal(mine(r).find((x) => x.club_id === A).changed, true)
})

test('clean step: unregistered players are removed first, which can change the result', async () => {
  await club(A, 6, 0, { unregistered: 6 })                                     // 6 general / 12 players = 50% -> -80 if the 6 stay
  const kept = await svc.applyMembershipRules({ actor, refresh: false, clean: false })
  assert.equal(mine(kept).find((x) => x.club_id === A).deduction, -80)
  await svc.revokePenalties({ actor, clubId: A })
  const cleaned = await svc.applyMembershipRules({ actor, refresh: false, clean: true })
  assert.equal(cleaned.cleaned >= 6, true)
  assert.equal(mine(cleaned).find((x) => x.club_id === A).total_players_count, 6)
  assert.equal(mine(cleaned).find((x) => x.club_id === A).deduction, 0)        // 6/6 = 100%
  assert.deepEqual(await penaltyRows(), [])
})

test('converted (general -> prospective) players count as prospective', async () => {
  await club(A, 7, 3)                                                          // 70% -> none
  await svc.applyMembershipRules(noRefresh)
  assert.deepEqual(await penaltyRows(), [])
  await query("UPDATE players SET status = 5, converted = true WHERE member_id = (SELECT min(member_id) FROM players WHERE club_id = $1 AND status = 1)", [A])
  await svc.applyMembershipRules(noRefresh)                                    // 6/10 = 60%
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -80 }])
})

test('other point kinds are never touched (placement, participation, manual, other clubs)', async () => {
  await club(A, 6, 4)
  await query("INSERT INTO club_points (club_id, sport_id, kind, points, place) VALUES ($1,$2,'placement',100,1)", [A, evId])
  await query("INSERT INTO club_points (club_id, sport_id, kind, points) VALUES ($1,$2,'participation',15)", [A, evId])
  await query("INSERT INTO club_points (club_id, kind, points) VALUES ($1,'manual',5),($1,'manual',7)", [A])
  await svc.applyMembershipRules(noRefresh); await svc.revokePenalties({ actor, clubId: A })
  const { rows } = await query("SELECT kind, count(*)::int n, sum(points)::int s FROM club_points WHERE club_id = $1 GROUP BY kind ORDER BY kind", [A])
  assert.deepEqual(rows, [{ kind: 'manual', n: 2, s: 12 }, { kind: 'participation', n: 1, s: 15 }, { kind: 'placement', n: 1, s: 100 }])
})

test('RMIS refresh failure aborts the whole run: nothing is applied or cleaned', async () => {
  await club(A, 6, 4, { unregistered: 2 })
  const down = { changes: async () => { throw new RmisError(503, 'rmis_unreachable', 'down') } }
  await assert.rejects(svc.applyMembershipRules({ actor, refresh: true, rmis: down }), (e) => e instanceof RmisError)
  assert.deepEqual(await penaltyRows(), [])
  assert.equal((await query('SELECT count(*)::int n FROM players WHERE club_id = $1', [A])).rows[0].n, 12) // not cleaned either
})

test('RMIS refresh runs first when asked, using the change feed', async () => {
  await club(A, 6, 4)
  const calls = []
  const rmis = { changes: async (a) => { calls.push(a); return { members: [], nextCursor: null, serverTime: new Date().toISOString() } } }
  const r = await svc.applyMembershipRules({ actor, refresh: true, rmis })
  assert.equal(calls.length >= 1, true)
  assert.equal(r.refreshed.pages >= 1, true)
  assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -80 }])
})

test('fails closed without valid tiers or minimum', async () => {
  await club(A, 6, 4)
  await query("DELETE FROM settings WHERE key = 'penalty.tiers'")
  let r = await svc.applyMembershipRules(noRefresh); assert.equal(r.ok, false); assert.equal(r.code, 'penalty_not_configured'); assert.equal(r.status, 503)
  assert.equal((await svc.previewMembership()).code, 'penalty_not_configured')
  await setSetting('penalty.tiers', [{ lt: 62, points: 80 }])                   // positive points are invalid
  r = await svc.applyMembershipRules(noRefresh); assert.equal(r.code, 'penalty_not_configured')
  assert.deepEqual(await penaltyRows(), [])
})

test('rules come from settings: changing the tiers changes the outcome', async () => {
  await club(A, 8, 2)                                                          // 80%
  await svc.applyMembershipRules(noRefresh); assert.deepEqual(await penaltyRows(), [])
  await setSetting('penalty.tiers', [{ lt: 85, points: -10 }])
  await svc.applyMembershipRules(noRefresh); assert.deepEqual(await penaltyRows(), [{ club_id: A, points: -10 }])
  await setSetting('penalty.min_players', 11)
  await svc.applyMembershipRules(noRefresh); assert.deepEqual(await penaltyRows(), [])   // 10 players < new minimum
})

test('revoke: one club or all; audited; applying is audited with the changes', async () => {
  await club(A, 6, 4); await club(C, 20, 10)
  await svc.applyMembershipRules(noRefresh)
  assert.equal((await svc.revokePenalties({ actor, clubId: A })).removed, 1)
  assert.deepEqual(await penaltyRows(), [{ club_id: C, points: -50 }])
  assert.equal((await svc.revokePenalties({ actor })).removed >= 1, true)
  assert.deepEqual(await penaltyRows(), [])
  const { rows } = await query("SELECT action, detail FROM audit_log WHERE actor_id = 41 ORDER BY id")
  assert.deepEqual(rows.map((r) => r.action), ['penalty.apply', 'penalty.revoke', 'penalty.revoke'])
  assert.ok(rows[0].detail.changes.some((c) => c.club_id === A && c.to === -80))
})

test('clubs with no players are listed with zero and never penalised', async () => {
  const p = await svc.previewMembership()
  const d = p.clubs.find((c) => c.club_id === D)
  assert.deepEqual([d.total_players_count, d.general_member_percentage, d.deduction], [0, 0, 0])
})
