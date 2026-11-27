#!/usr/bin/env node
// Service-level performance benchmark. Calls the real server functions against a DEV/TEST database that
// already holds production-scale data (about 1500 players, 125 clubs, 38k RMIS members). It measures what
// the pages call, not the HTTP layer; add ops/loadtest.mjs for the latter.
//
//   DATABASE_URL=... DATABASE_DIRECT_URL=... node ops/perf-bench.mjs [concurrency=40] [rounds=8]
//
// Refuses to run on anything but *_dev / *_test / *_perf databases: the register scenario writes rows.
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const db = (process.env.DATABASE_URL || '').split('/').pop().split('?')[0]
if (!/(_dev|_test|_perf)$/.test(db) && !/_perf_/.test(db)) { console.error(`refusing: database "${db}" is not a dev/test/perf database`); process.exit(1) }

const C = Number(process.argv[2] || 40), ROUNDS = Number(process.argv[3] || 8)
const { query, closePool } = await import('../src/server/db.mjs')
const dash = await import('../src/server/dashboards/service.mjs')
const lb = await import('../src/server/leaderboard/service.mjs')
const reg = await import('../src/server/registration/service.mjs')
const chk = await import('../src/server/checkin/service.mjs')
const pen = await import('../src/server/penalties/service.mjs')
const ann = await import('../src/server/announcements/service.mjs')
const mir = await import('../src/server/rmis/mirror.mjs')
const set = await import('../src/server/settings/admin.mjs')

const club = (await query('SELECT club_id FROM players GROUP BY club_id ORDER BY count(*) DESC LIMIT 1')).rows[0].club_id
const { rows: [m] } = await query('SELECT member_id FROM players WHERE club_id = $1 LIMIT 1', [club])
await lb.rebuildLeaderboard({ force: true })

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))]
const ms = (x) => x.toFixed(1).padStart(7)
async function timeOne(fn) { const t = performance.now(); await fn(); return performance.now() - t }
async function seq(fn, n = 25) { await fn(); const a = []; for (let i = 0; i < n; i++) a.push(await timeOne(fn)); return a.sort((x, y) => x - y) }
async function conc(fn, c = C, rounds = ROUNDS) {
  const all = []; const t0 = performance.now()
  await Promise.all(Array.from({ length: c }, async () => { for (let i = 0; i < rounds; i++) all.push(await timeOne(fn)) }))
  const wall = performance.now() - t0
  return { all: all.sort((x, y) => x - y), rps: all.length / (wall / 1000) }
}

const cases = [
  ['public: event info',                 () => set.getPublicEventInfo()],
  ['public: leaderboard (snapshot read)', () => lb.getAggregated({ category: 'community', limit: 50 })],
  ['public: player search (name)',        () => reg.searchPlayersPublic({ name: 'Member 12' })],
  ['portal: dashboard (portalOverview)',  () => dash.portalOverview({ clubId: club })],
  ['portal: eligible members (picker)',   () => mir.listEligibleMembers(club)],
  ['portal: club registrations',          () => reg.listRegistrations({ clubId: club })],
  ['portal: announcements',               () => ann.listForUser(m.member_id)],
  ['admin: dashboard (adminOverview)',    () => dash.adminOverview({ category: 'community' })],
  ['admin: penalty preview',              () => pen.previewMembership()],
  ['admin: registrations list (page)',    () => reg.listRegistrationsAdmin({ page: 1, limit: 50 })],
  ['admin: registrations search',         () => reg.listRegistrationsAdmin({ page: 1, limit: 50, search: 'Member 12' })],
  ['admin: player numbers (full day)',    () => chk.listPlayerNumbers({ dayCode: 'D-01' })],
  ['admin: player numbers (search)',      () => chk.listPlayerNumbers({ dayCode: 'D-01', search: 'Member 12' })],
  ['admin: scanner lookup',               () => chk.lookupPlayer({ queryText: String(m.member_id), dayCode: 'D-01' })],
  ['admin: day stats',                    () => chk.dayStats()],
  ['worker: leaderboard rebuild',         () => lb.rebuildLeaderboard({ force: true })],
]

console.log(`db=${db} pool=${process.env.DB_POOL_MAX || 10}  concurrency=${C} x ${ROUNDS} rounds\n`)
console.log('scenario'.padEnd(38), '   p50ms   p95ms |  conc p50  conc p95  conc p99     req/s')
for (const [name, fn] of cases) {
  let s, k
  try { s = await seq(fn, name.startsWith('worker') ? 8 : 25); k = await conc(fn, name.startsWith('worker') ? 4 : C, name.startsWith('worker') ? 2 : ROUNDS) }
  catch (e) { console.log(name.padEnd(38), 'ERROR', e.message.slice(0, 90)); continue }
  console.log(name.padEnd(38), ms(pct(s, 0.5)), ms(pct(s, 0.95)), '|', ms(pct(k.all, 0.5)), ' ', ms(pct(k.all, 0.95)), ' ', ms(pct(k.all, 0.99)), ' ', k.rps.toFixed(0).padStart(7))
}

// ---- deadline rush: many clubs registering into ONE event at once -------------------------------------------
{
  // Volleyball (team, 9 per club): up to 8 free players from each community club, none of them registered on D-01 yet
  const { rows: [ev] } = await query("SELECT sport_id, sport_day FROM events WHERE sport_name = 'Volleyball' AND category = 'community' LIMIT 1")
  const { rows: cand } = await query(
    `SELECT member_id, club_id FROM (
       SELECT member_id, club_id, row_number() OVER (PARTITION BY club_id ORDER BY member_id) rn FROM rmis_members m
        WHERE status = 1 AND gender IN ('M','F') AND club_id <= 95 AND club_id % 2 = 0
          AND NOT EXISTS (SELECT 1 FROM registrations r JOIN events e USING (sport_id) WHERE r.member_id = m.member_id AND e.sport_day = $1)) t
     WHERE rn <= 8 ORDER BY member_id LIMIT 400`, [ev.sport_day])
  const actor = { member_id: 21532, hasAdminAccess: true, club_id: null }
  const times = []; let okN = 0; const codes = {}
  const t0 = performance.now()
  await Promise.all(cand.map(async (c) => {
    const t = performance.now()
    const r = await reg.registerPlayer({ actor, clubId: c.club_id, memberId: c.member_id, sportId: ev.sport_id, riId: '12345' })
    times.push(performance.now() - t); if (r.ok) okN++; else codes[r.code] = (codes[r.code] || 0) + 1
  }))
  const wall = performance.now() - t0; times.sort((a, b) => a - b)
  console.log(`\nregistration rush: ${cand.length} concurrent registrations into one event -> ok=${okN} refused=${JSON.stringify(codes)}  wall=${wall.toFixed(0)}ms  throughput=${(cand.length / (wall / 1000)).toFixed(0)}/s  p50=${pct(times, .5).toFixed(0)}ms p95=${pct(times, .95).toFixed(0)}ms max=${times.at(-1).toFixed(0)}ms`)
}
await closePool()
