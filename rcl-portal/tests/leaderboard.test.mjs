import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const lb = await import('../src/server/leaderboard/service.mjs')
const snap = await import('../src/server/leaderboard/snapshots.mjs')
const { snapshotResponse } = await import('../src/server/leaderboard/respond.mjs')
const worker = await import('../scripts/worker.mjs')

// clubs 9801-9899, actor 950001, events '__lb_%'
const [A, B, C, D, I1] = [9801, 9802, 9803, 9804, 9805] // A-D community, I1 institute
const MINE = [A, B, C, D, I1]
const actor = { member_id: 950001 }
const FAM = 'lbtest'
let ev

async function cleanup() {
  await query('DELETE FROM club_points WHERE club_id BETWEEN 9801 AND 9899')
  await query("DELETE FROM audit_log WHERE actor_id = 950001")
  await query("DELETE FROM snapshots WHERE key LIKE 'lbtest:%'")
  await query("DELETE FROM data_versions WHERE key = $1", [FAM])
}
const pts = (club, kind, points, sport = null) => query(
  'INSERT INTO club_points (club_id, sport_id, kind, points, place) VALUES ($1,$2,$3,$4,NULL)', [club, kind === 'penalty' || kind === 'manual' ? sport : sport ?? ev, kind, points])
const mine = (clubs) => clubs.filter((c) => MINE.includes(c.club_id))
const byId = (clubs) => Object.fromEntries(mine(clubs).map((c) => [c.club_id, c]))

before(async () => {
  await query("DELETE FROM events WHERE sport_name LIKE '__lb_%'")
  await cleanup()
  for (const [id, n, cat] of [[A, 'A', 'community'], [B, 'B', 'community'], [C, 'C', 'community'], [D, 'D', 'community'], [I1, 'I', 'institute']])
    await query("INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,$2,$3,1) ON CONFLICT (club_id) DO UPDATE SET category = EXCLUDED.category, status = 1", [id, `LB Club ${n}`, cat])
  ev = (await query("INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ('__lb_ev','individual','mixed','community','D-01') RETURNING sport_id")).rows[0].sport_id
})
after(async () => {
  await cleanup()
  await query("DELETE FROM events WHERE sport_name LIKE '__lb_%'")
  await query('DELETE FROM clubs WHERE club_id BETWEEN 9801 AND 9899')
  await closePool()
})

test('ranking: ties share a rank, the next rank skips, penalties and every kind count', async () => {
  await cleanup()
  await pts(A, 'placement', 100); await pts(A, 'manual', 10)           // A = 110
  await pts(B, 'placement', 75); await pts(B, 'participation', 15)     // B = 90 (+ penalty below)
  await pts(C, 'placement', 100); await pts(C, 'penalty', -10)         // C = 90
  // D has nothing -> 0
  await pts(B, 'penalty', 0)                                           // zero row must not break anything
  await lb.rebuildLeaderboard({ force: true })
  const r = await lb.getAggregated({})
  const m = byId(r.body.data)
  assert.deepEqual([m[A].total_points, m[B].total_points, m[C].total_points, m[D].total_points], [110, 90, 90, 0])
  assert.equal(m[B].rank, m[C].rank, 'tie shares a rank')
  assert.equal(m[D].rank > m[C].rank, true)
  assert.equal(m[A].rank < m[B].rank, true)
  // competition ranking: the rank after a 2-way tie skips one
  assert.equal(r.body.data.filter((c) => c.total_points > 90).length + 1, m[B].rank)
  assert.equal(r.body.data.filter((c) => c.total_points > 0).length + 1 <= m[D].rank, true)
  assert.deepEqual(m[C].points_by_kind, { placement: 100, participation: 0, track: 0, penalty: -10, manual: 0 })
  assert.equal(m[B].entries_count, 3)
  // sorted: total desc, then name
  const totals = r.body.data.map((c) => c.total_points)
  assert.deepEqual(totals, [...totals].sort((a, b) => b - a))
})

test('category filter ranks inside the category; university is an alias of institute; bad category is 400', async () => {
  const all = await lb.getAggregated({})
  const com = await lb.getAggregated({ category: 'community' })
  const inst = await lb.getAggregated({ category: 'university' })
  assert.ok(com.body.data.every((c) => c.category === 'community'))
  assert.ok(inst.body.data.some((c) => c.club_id === I1) && inst.body.data.every((c) => c.category === 'institute'))
  assert.equal(com.body.total, com.body.data.length)
  assert.equal(all.body.total >= com.body.total + inst.body.total, true)
  const first = com.body.data[0]
  assert.equal(first.rank, 1)
  const page = await lb.getAggregated({ category: 'community', limit: 2, offset: 1 })
  assert.equal(page.body.data.length, 2)
  assert.equal(page.body.pagination.hasMore, com.body.total > 3)
  assert.equal((await lb.getAggregated({ category: 'nope' })).status, 400)
})

test('club details: breakdown by sport/kind, penalty and manual rows, unknown club 404', async () => {
  await pts(A, 'track', 85)
  const r = await lb.getClubDetails(C)
  assert.equal(r.ok, true)
  assert.equal(r.body.data.summary.total_points, 90)
  assert.equal(r.body.data.summary.total_entries, 2)
  const kinds = r.body.data.raw_entries.map((e) => e.kind).sort()
  assert.deepEqual(kinds, ['penalty', 'placement'])
  const pen = r.body.data.sports_breakdown.find((g) => g.sport_id == null)
  assert.equal(pen.total_points, -10)
  const sport = r.body.data.sports_breakdown.find((g) => g.sport_id === ev)
  assert.equal(sport.sport_info.sport_name, '__lb_ev')
  const a = await lb.getClubDetails(A)   // read-your-write, no stale data
  assert.equal(a.body.data.summary.total_points, 195)
  const missing = await lb.getClubDetails(9899)
  assert.equal(missing.ok, false); assert.equal(missing.status, 404)
})

test('a write is visible on the very next read (inline rebuild, no worker running)', async () => {
  const before = byId((await lb.getAggregated({})).body.data)[D].total_points
  await pts(D, 'manual', 7)
  const after = byId((await lb.getAggregated({})).body.data)[D].total_points
  assert.equal(after, before + 7)
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [D])
  assert.equal(byId((await lb.getAggregated({})).body.data)[D].total_points, before)
})

test('triggers bump the leaderboard counter on points, clubs and events changes', async () => {
  const cnt = async () => Number((await query("SELECT version FROM data_versions WHERE key = 'leaderboard'")).rows[0].version)
  let v = await cnt()
  await pts(D, 'manual', 1); assert.ok(await cnt() > v); v = await cnt()
  await query('UPDATE clubs SET club_name = club_name WHERE club_id = $1', [D]); assert.ok(await cnt() > v); v = await cnt()
  await query("UPDATE events SET sport_name = sport_name WHERE sport_name = '__lb_ev'"); assert.ok(await cnt() > v)
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [D])
})

// ---- snapshot mechanics on an isolated family so parallel agents cannot disturb the counts -----
const compute = async (c) => ({ 'lbtest:a': { sum: Number((await c.query('SELECT COALESCE(sum(points),0) AS s FROM club_points WHERE club_id BETWEEN 9801 AND 9899')).rows[0].s) } })
const run = (o = {}) => snap.rebuildFamily({ family: FAM, primaryKey: 'lbtest:a', compute, maxAgeMs: 60_000, ...o })
const bump = () => query('UPDATE data_versions SET version = version + 1 WHERE key = $1', [FAM])
const read = () => snap.readSnapshot('lbtest:a', { family: FAM })

test('snapshot versioning: version moves only when the content changes', async () => {
  await cleanup()
  await query('INSERT INTO data_versions (key) VALUES ($1)', [FAM])
  const first = await run()
  assert.deepEqual([first.built, first.results[0].version, first.results[0].changed], [true, 1, true])
  // counter moved but content identical -> verified (computed_at touched), version stays
  await bump()
  const again = await run()
  assert.deepEqual([again.built, again.results[0].version, again.results[0].changed], [true, 1, false])
  assert.equal((await read()).source_version, (await read()).current_version)
  // real change -> version 2
  await pts(A, 'manual', 5); await bump()
  const changed = await run()
  assert.deepEqual([changed.results[0].version, changed.results[0].changed], [2, true])
  assert.deepEqual((await read()).data, { sum: 5 })
  // change then revert -> content equals the OLD data again but it is a new state: version 3, never goes back
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [A]); await bump()
  assert.equal((await run()).results[0].version, 3)
})

test('rebuild only on change: a fresh snapshot is not recomputed', async () => {
  const idle = await run()
  assert.equal(idle.built, false)
  assert.equal((await read()).version, 3)
  await bump()
  assert.equal((await run()).built, true)       // counter moved -> rebuild (content same -> still version 3)
  assert.equal((await read()).version, 3)
  assert.equal((await run()).built, false)
  // max age exceeded -> re-verify
  await query("UPDATE snapshots SET computed_at = now() - interval '10 minutes' WHERE key = 'lbtest:a'")
  assert.equal((await run()).built, true)
  const forced = await run({ force: true })
  assert.equal(forced.built, true)
  assert.equal(forced.results[0].changed, false)
})

test('concurrent builds: single flight, exactly one version bump, no errors', async () => {
  const v0 = (await read()).version
  await pts(B, 'manual', 3); await bump()
  const rs = await Promise.all(Array.from({ length: 12 }, () => run()))
  assert.equal(rs.filter((r) => r.built).length, 1, 'only one caller did the work, the rest found it fresh')
  const row = await read()
  assert.equal(row.version, v0 + 1)
  assert.deepEqual(row.data, { sum: 3 })
  // forced concurrent rebuilds of unchanged data never bump the version
  await Promise.all(Array.from({ length: 6 }, () => run({ force: true })))
  assert.equal((await read()).version, v0 + 1)
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [B])
})

test('concurrent leaderboard readers right after a write all see the new total', async () => {
  const base = byId((await lb.getAggregated({})).body.data)[B].total_points
  await pts(B, 'manual', 11)
  const rs = await Promise.all(Array.from({ length: 10 }, () => lb.getAggregated({})))
  for (const r of rs) assert.equal(byId(r.body.data)[B].total_points, base + 11)
  assert.equal(new Set(rs.map((r) => r.version)).size <= 2, true)
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [B])
})

test('ETag / If-None-Match: 304 with no body, 200 with ETag, no-cache and version fields', async () => {
  const r = await lb.getAggregated({ category: 'community' })
  const plain = snapshotResponse(new Request('http://x/api/leaderboard/aggregated'), r)
  assert.equal(plain.status, 200)
  assert.equal(plain.headers.get('etag'), r.etag)
  assert.equal(plain.headers.get('cache-control'), 'no-cache')
  assert.doesNotMatch(plain.headers.get('cache-control'), /max-age/)
  const body = await plain.json()
  assert.equal(body.version, r.version); assert.ok(Date.parse(body.generated_at))
  const cached = snapshotResponse(new Request('http://x/', { headers: { 'if-none-match': r.etag } }), r)
  assert.equal(cached.status, 304); assert.equal(await cached.text(), '')
  assert.equal(cached.headers.get('etag'), r.etag)
  const weak = snapshotResponse(new Request('http://x/', { headers: { 'if-none-match': `W/${r.etag}, "other"` } }), r)
  assert.equal(weak.status, 304)
  const stale = snapshotResponse(new Request('http://x/', { headers: { 'if-none-match': '"lb-all-0-community-x-0"' } }), r)
  assert.equal(stale.status, 200)
  // a different variant (query) of the same version has a different ETag
  assert.notEqual((await lb.getAggregated({ category: 'institute' })).etag, r.etag)
  // a change moves the ETag
  await pts(D, 'manual', 2)
  const r2 = await lb.getAggregated({ category: 'community' })
  assert.notEqual(r2.etag, r.etag)
  await query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'manual'", [D])
})

test('admin manual points: add (audited), validation via FK, delete only manual rows', async () => {
  const add = await lb.addManualPoints({ actor, clubId: A, sportId: ev, points: -20, place: 2, note: 'late arrival' })
  assert.equal(add.ok, true); assert.equal(add.row.kind, 'manual'); assert.equal(add.row.clubs.club_name, 'LB Club A')
  const audit = await query("SELECT detail FROM audit_log WHERE actor_id = 950001 AND action = 'club_points.manual_add'")
  assert.equal(audit.rows.length, 1)
  const noClub = await lb.addManualPoints({ actor, clubId: 9898, points: 5 })
  assert.equal(noClub.status, 404)
  const noSport = await lb.addManualPoints({ actor, clubId: A, sportId: 2_000_000_000, points: 5 })
  assert.equal(noSport.status, 404)
  const list = await lb.listPoints({ sportId: ev, clubId: A })
  assert.ok(list.data.some((r) => r.point_id === add.row.point_id && r.clubs.club_name === 'LB Club A'))
  // an automatic row cannot be deleted through the manual route
  await pts(A, 'track', 85)
  const auto = (await query("SELECT point_id FROM club_points WHERE club_id = $1 AND kind = 'track'", [A])).rows[0]
  const refused = await lb.deleteManualPoints({ actor, pointId: auto.point_id })
  assert.equal(refused.status, 409)
  assert.equal((await lb.deleteManualPoints({ actor, pointId: add.row.point_id })).ok, true)
  assert.equal((await lb.deleteManualPoints({ actor, pointId: add.row.point_id })).status, 404)
  assert.equal((await query("SELECT count(*)::int AS n FROM audit_log WHERE actor_id = 950001 AND action = 'club_points.manual_delete'")).rows[0].n, 1)
})

test('worker runOnce: snapshot rebuild works and RMIS jobs skip cleanly when unconfigured', async () => {
  const r = await worker.runSnapshotsOnce({ force: true })
  assert.equal(r.built, true)
  assert.ok(r.results.map((x) => x.key).includes('leaderboard:all'))
  const keep = [process.env.RMIS_API_URL, process.env.RMIS_API_KEY]
  delete process.env.RMIS_API_URL; delete process.env.RMIS_API_KEY
  try { assert.deepEqual(await worker.runRmisChangesOnce(), { skipped: 'rmis_not_configured' }) }
  finally { [process.env.RMIS_API_URL, process.env.RMIS_API_KEY] = keep }
  assert.ok((await worker.rmisIntervalMs()) >= 30_000)
})
