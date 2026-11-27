import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, tx, closePool } = await import('../src/server/db.mjs')
const bibs = await import('../src/server/bibs/service.mjs')
const changes = await import('../src/server/changes/service.mjs')
const { default: pg } = await import('pg')
// the app role cannot touch the guard trigger (by design); tests clean up as the table owner
const owner = async (sql) => { const c = new pg.Client({ connectionString: process.env.DATABASE_MIGRATOR_URL }); await c.connect(); try { await c.query(sql) } finally { await c.end() } }
const dropBibs = (where) => owner(`ALTER TABLE bib_numbers DISABLE TRIGGER trg_bib_numbers_guard; DELETE FROM bib_numbers WHERE ${where}; ALTER TABLE bib_numbers ENABLE TRIGGER trg_bib_numbers_guard`)

const [A, B] = [9511, 9512]
const actor = { member_id: 53 }
let ev = {}
const P = { a: 970001, b: 970002, c: 970003, d: 970004, e: 970005 }
async function cleanup() {
  await query('DELETE FROM swap_requests WHERE club_id BETWEEN 9511 AND 9512')
  await query('DELETE FROM replacement_requests WHERE club_id BETWEEN 9511 AND 9512')
  await query('DELETE FROM registrations WHERE club_id BETWEEN 9511 AND 9512')
  await dropBibs('member_id BETWEEN 970001 AND 970099')
  await query('DELETE FROM players WHERE club_id BETWEEN 9511 AND 9512')
}
const mkEvent = async (name, group, day = 'D-04', gender = 'mixed') => (await query(
  "INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day, limit_group, bib_required) VALUES ($1,'individual',$2,'community',1,5,0,$3,$4,$4 <> 'standard') RETURNING sport_id",
  [`__bb_${name}`, gender, day, group])).rows[0].sport_id
before(async () => {
  await query("DELETE FROM events WHERE sport_name LIKE '__bb_%'"); await cleanup()
  for (const [id, n] of [[A, 'A'], [B, 'B']]) await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,'community',1) ON CONFLICT (club_id) DO UPDATE SET status = 1", [id, `Bib Club ${n}`])
  ev.sprint = await mkEvent('sprint', 'track'); ev.swim = await mkEvent('swim', 'swimming', 'D-03'); ev.chess = await mkEvent('chess', 'standard', 'D-01')
})
after(async () => {
  await cleanup(); await query("DELETE FROM events WHERE sport_name LIKE '__bb_%'"); await query('DELETE FROM clubs WHERE club_id BETWEEN 9511 AND 9512'); await closePool()
})
beforeEach(async () => {
  await cleanup()
  const names = { a: 'Ann', b: 'Bob', c: 'Cy', d: 'Di', e: 'Eve' }
  for (const [k, id] of Object.entries(P)) await query("INSERT INTO players (member_id, name, club_id, gender, status) VALUES ($1,$2,$3,'F',1)", [id, `Bibber ${names[k]}`, k < 'd' ? A : B])
})
const reg = async (m, sport) => (await query('INSERT INTO registrations (member_id, sport_id, club_id, main_player) VALUES ($1,$2,(SELECT club_id FROM players WHERE member_id=$1),true) RETURNING id', [m, sport])).rows[0].id
const bibOf = async (m) => (await query('SELECT bib_number FROM bib_numbers WHERE member_id = $1', [m])).rows[0]?.bib_number ?? null

test('only bib events count: chess players get no number; assignment is 3-digit, one per player, idempotent', async () => {
  await reg(P.a, ev.sprint); await reg(P.a, ev.swim); await reg(P.b, ev.swim); await reg(P.c, ev.chess)
  const before = await bibs.bibStatus()
  const r = await bibs.assignMissingBibs({ actor })
  assert.equal(r.ok, true)
  assert.equal(await bibOf(P.c), null)                                   // chess only
  const na = await bibOf(P.a), nb = await bibOf(P.b)
  assert.ok(na && nb && na !== nb)                                       // A is in 2 bib events but has ONE number
  assert.match(bibs.formatBib(na), /^\d{3,4}$/)
  const { verifyPlayer, lookupPlayer } = await import('../src/server/checkin/service.mjs')
  assert.equal((await verifyPlayer(String(P.a), 'D-04')).bib_number, bibs.formatBib(na))      // shown on the scan result
  assert.equal((await verifyPlayer(String(P.c), 'D-01')).bib_number, null)
  assert.equal((await lookupPlayer({ queryText: String(P.a), searchType: 'rmisId', dayCode: 'D-04' })).data.bib_number, bibs.formatBib(na))
  assert.equal((await query('SELECT count(*)::int n FROM bib_numbers WHERE member_id = $1', [P.a])).rows[0].n, 1)
  const again = await bibs.assignMissingBibs({ actor })
  assert.equal(again.assigned, 0); assert.equal(await bibOf(P.a), na)    // nothing changes the second time
  assert.ok((await bibs.bibStatus()).assigned >= before.assigned + 2)
})

test('new players later get the next number; existing numbers never change; numbers are 3 digits until 999', async () => {
  await reg(P.a, ev.sprint); await bibs.assignMissingBibs({ actor })
  const first = await bibOf(P.a)
  await reg(P.d, ev.sprint); await reg(P.e, ev.swim)
  const r = await bibs.assignMissingBibs({ actor })
  assert.equal(r.assigned, 2)
  assert.equal(await bibOf(P.a), first)
  assert.ok((await bibOf(P.d)) > first && (await bibOf(P.e)) > first)
  assert.equal(bibs.formatBib(7), '007'); assert.equal(bibs.formatBib(123), '123'); assert.equal(bibs.formatBib(1234), '1234')
})

test('the database refuses to change or delete a number, and to give two players one number or one player two', async () => {
  await reg(P.a, ev.sprint); await bibs.assignMissingBibs({ actor })
  const n = await bibOf(P.a)
  await assert.rejects(query('UPDATE bib_numbers SET bib_number = 998 WHERE member_id = $1', [P.a]), /cannot be changed/)
  await assert.rejects(query('DELETE FROM bib_numbers WHERE member_id = $1', [P.a]), /cannot be deleted/)
  await assert.rejects(query('INSERT INTO bib_numbers (bib_number, member_id) VALUES ($1, $2)', [n, P.b]), /duplicate key/)
  await assert.rejects(query('INSERT INTO bib_numbers (bib_number, member_id) VALUES (9990, $1)', [P.a]), /duplicate key/)
})

test('replacement: the number moves to the new player when the old player has no bib event left', async () => {
  const rSprint = await reg(P.a, ev.sprint); await bibs.assignMissingBibs({ actor })
  const n = await bibOf(P.a)
  await tx(async (c) => { await c.query('UPDATE registrations SET member_id = $2 WHERE id = $1', [rSprint, P.b]); await bibs.handBibsOver(c, [P.a, P.b]) })
  assert.equal(await bibOf(P.b), n); assert.equal(await bibOf(P.a), null)
  assert.equal((await query('SELECT transferred_from FROM bib_numbers WHERE bib_number = $1', [n])).rows[0].transferred_from, P.a)
})

test('replacement when the old player keeps another bib event: the old player keeps the number, the new one waits for the assign button', async () => {
  const rSprint = await reg(P.a, ev.sprint); await reg(P.a, ev.swim); await bibs.assignMissingBibs({ actor })
  const n = await bibOf(P.a)
  await tx(async (c) => { await c.query('UPDATE registrations SET member_id = $2 WHERE id = $1', [rSprint, P.b]); await bibs.handBibsOver(c, [P.a, P.b]) })
  assert.equal(await bibOf(P.a), n); assert.equal(await bibOf(P.b), null)
  const r = await bibs.assignMissingBibs({ actor })
  assert.equal(r.assigned, 1); assert.ok((await bibOf(P.b)) > n)
})

test('replacement through the real approval path hands the number over (admin replace)', async () => {
  await query("INSERT INTO rmis_members (member_id, membership_id, club_id, status, role_id, card_name, full_name, gender, nic, created_at, updated_at, transfer_info) VALUES ($1,'BBX1',$2,1,31,'Repl Bib','Repl Bib','F','990000001V','2026-06-23T10:00:00Z','2026-06-23T10:00:00Z', true) ON CONFLICT (member_id) DO NOTHING", [970050, A])
  const rid = await reg(P.a, ev.sprint); await bibs.assignMissingBibs({ actor })
  const n = await bibOf(P.a)
  // the replacement must be eligible, which needs a membership cutoff (unset = fail closed); keep this test self-contained
  const prev = (await query("SELECT value FROM settings WHERE key = 'membership.cutoff'")).rows[0]
  await query("INSERT INTO settings (key, value) VALUES ('membership.cutoff', to_jsonb($1::text)) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ['2026-12-31T00:00:00Z'])
  let r
  try { r = await changes.adminReplace({ actor, registrationId: rid, replacementMemberId: 970050, reason: 'test', riId: '12345' }) }
  finally {
    if (prev) await query("UPDATE settings SET value = $1 WHERE key = 'membership.cutoff'", [JSON.stringify(prev.value)])
    else await query("DELETE FROM settings WHERE key = 'membership.cutoff'")
  }
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(await bibOf(970050), n); assert.equal(await bibOf(P.a), null)
  await dropBibs('member_id = 970050')
  await query('DELETE FROM replacement_requests WHERE club_id = 9511'); await query('DELETE FROM registrations WHERE member_id = 970050'); await query('DELETE FROM players WHERE member_id = 970050'); await query('DELETE FROM rmis_members WHERE member_id = 970050')
})

test('list and status: filters, search by number/name, unused numbers (player left every bib event)', async () => {
  await reg(P.a, ev.sprint); await reg(P.b, ev.swim); await bibs.assignMissingBibs({ actor })
  await reg(P.d, ev.sprint)                                               // needs a number, has none
  const nA = bibs.formatBib(await bibOf(P.a))
  assert.equal((await bibs.listBibs({ filter: 'missing', search: 'Bibber' })).rows.map((r) => r.member_id).join(), String(P.d))
  assert.equal((await bibs.listBibs({ search: nA })).rows.some((r) => r.member_id === P.a), true)
  assert.equal((await bibs.listBibs({ search: 'bibber bob' })).rows[0].member_id, P.b)
  await query('DELETE FROM registrations WHERE member_id = $1', [P.b])
  assert.equal((await bibs.listBibs({ filter: 'unused', search: 'Bibber' })).rows[0].member_id, P.b)
  assert.ok((await bibs.bibStatus()).unused >= 1)
  const { cleanUnregisteredPlayers } = await import('../src/server/registration/service.mjs')
  await cleanUnregisteredPlayers({ clubId: A })
  assert.equal((await query('SELECT 1 FROM players WHERE member_id = $1', [P.b])).rows.length, 1)   // a number holder is not cleaned away
})
