import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { decideAccess } from '../src/server/auth/access-policy.mjs'

const anon = null
const nobody = { hasPortalAccess: false, hasAdminAccess: false }
const president = { hasPortalAccess: true, hasAdminAccess: false }   // RMIS role 5/6
const rdsc = { hasPortalAccess: true, hasAdminAccess: true }         // RMIS role 1-4
const adminOnlyToken = { hasPortalAccess: false, hasAdminAccess: true }

const call = (token, method, pathname) => decideAccess({ pathname, method, token })
const status = (token, method, pathname) => { const r = call(token, method, pathname); return r.allow ? 200 : r.status }

// ---- every real route file: private unless explicitly public -----------------------------------
function routeFiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) routeFiles(p, out)
    else if (/^route\.(js|ts|mjs)$/.test(f)) out.push(p)
  }
  return out
}
const apiRoot = path.resolve('src/app/api')
const routes = routeFiles(apiRoot).map((f) => {
  const rel = path.relative(apiRoot, path.dirname(f)).split(path.sep)
  return '/api' + (rel[0] ? '/' + rel.join('/') : '')
}).filter((p) => !p.includes('[...nextauth]')).map((p) => p.replace(/\[[^\]]+\]/g, 'x')).sort()

test('found the API routes (sanity)', () => assert.ok(routes.length > 40, `only ${routes.length} routes found`))

test('anonymous callers can reach ONLY this explicit list of public GETs', () => {
  const open = []
  for (const r of routes) for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) if (status(anon, m, r) === 200) open.push(`${m} ${r}`)
  assert.deepEqual(open.sort(), [
    'GET /api/brackets',
    'GET /api/club-points',
    'GET /api/clubs/x/registered-events',
    'GET /api/events',
    'GET /api/leaderboard/aggregated',
    'GET /api/leaderboard/club-details/x',
    'GET /api/players/search',
    'GET /api/players/x',
    'GET /api/public/event-info', 'GET /api/public/health',
  ])
})

test('every non-public route answers 401 to anonymous callers (default deny)', () => {
  for (const r of routes) for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const s = status(anon, m, r)
    assert.ok(s === 200 || s === 401, `${m} ${r} -> ${s}`)
  }
})

test('a signed-in account with no RCL access (neither portal nor admin) is refused everywhere non-public', () => {
  for (const r of routes) for (const m of ['GET', 'POST', 'DELETE']) {
    const s = status(nobody, m, r)
    assert.ok(s === 200 || s === 403, `${m} ${r} -> ${s}`)
    if (status(anon, m, r) === 401) assert.equal(s, 403, `${m} ${r}`)
  }
})

// ---- admin vs portal -----------------------------------------------------------------------------
const ADMIN_ONLY = [
  ['GET', '/api/admin/dashboard-stats'], ['POST', '/api/admin/payments/approve'], ['POST', '/api/admin/apply-membership-rules'],
  ['POST', '/api/admin/permissions'], ['PUT', '/api/track-events'], ['POST', '/api/track-events'], ['POST', '/api/track-events/award'],
  ['POST', '/api/day-registrations'], ['GET', '/api/day-registrations'], ['GET', '/api/registrations/with-players'],
  ['POST', '/api/club-points/award'], ['GET', '/api/leaderboard/tournament-standings'],
  ['POST', '/api/events'], ['PUT', '/api/events'], ['DELETE', '/api/events'], ['GET', '/api/games'], ['POST', '/api/games'], ['PUT', '/api/games'], ['DELETE', '/api/games'],
  ['POST', '/api/clubs'], ['PUT', '/api/clubs'], ['GET', '/api/teams'], ['GET', '/api/teams/available-clubs'], ['GET', '/api/teams/non-eligible'], ['POST', '/api/teams'], ['DELETE', '/api/teams'], ['POST', '/api/club-points'], ['DELETE', '/api/club-points'],
  ['POST', '/api/brackets'], ['PATCH', '/api/config/portal-status'], ['PUT', '/api/players'], ['DELETE', '/api/players/12'],
  ['GET', '/api/config/portal-status'], ['GET', '/api/players/12/sports'], ['POST', '/api/admin/announcements'], ['GET', '/api/admin/bibs'], ['GET', '/api/players/RACOL0042/verification'], ['GET', '/api/admin/player-numbers/lookup'],
]
test('admin-only routes: portal-only users get 403, admins get through', () => {
  for (const [m, p] of ADMIN_ONLY) {
    assert.equal(status(president, m, p), 403, `president ${m} ${p}`)
    assert.equal(status(rdsc, m, p), 200, `rdsc ${m} ${p}`)
    assert.equal(status(anon, m, p), 401, `anon ${m} ${p}`)
  }
})

const PORTAL_OK = [
  ['GET', '/api/track-events'], ['GET', '/api/registrations'], ['POST', '/api/registrations'], ['DELETE', '/api/registrations'], ['GET', '/api/clubs'], ['GET', '/api/portal/finance'], ['GET', '/api/payment-slips/5/file'],
  ['POST', '/api/payment-slips'], ['POST', '/api/payment-slips/upload'], ['GET', '/api/portal/dashboard'], ['POST', '/api/portal/replacements'],
  ['POST', '/api/portal/swaps'], ['POST', '/api/players/sync-rmis'], ['POST', '/api/players/clean'], ['GET', '/api/players'], ['POST', '/api/players'],
  ['GET', '/api/announcements'], ['POST', '/api/announcements/read'], ['GET', '/api/announcements/stream'],
]
test('portal routes: presidents/secretaries can use them', () => {
  for (const [m, p] of PORTAL_OK) {
    assert.equal(status(president, m, p), 200, `president ${m} ${p}`)
    assert.equal(status(rdsc, m, p), 200, `rdsc ${m} ${p}`)
    assert.equal(status(anon, m, p), 401, `anon ${m} ${p}`)
  }
})

test('/api/portal/** needs portal access (an admin-only token is refused)', () => {
  assert.equal(status(adminOnlyToken, 'GET', '/api/portal/dashboard'), 403)
  assert.equal(status(adminOnlyToken, 'GET', '/api/admin/dashboard-stats'), 200)
})

test('public QR routes do not expose the other player endpoints', () => {
  for (const p of ['/api/players/clean', '/api/players/sync-rmis']) assert.equal(status(anon, 'GET', p), 401, p)
  assert.equal(status(anon, 'GET', '/api/players/12'), 200)
  assert.equal(status(anon, 'GET', '/api/players/12/verification'), 401)
  assert.equal(status(anon, 'GET', '/api/players/12/sports'), 401)
  assert.equal(status(anon, 'PUT', '/api/players/12'), 401)
})

test('public GETs are GET-only', () => {
  for (const p of ['/api/events', '/api/brackets', '/api/club-points', '/api/leaderboard/aggregated', '/api/players/search'])
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(status(anon, m, p), 401, `${m} ${p}`)
})

test('NextAuth endpoints stay open; trailing slashes and verb case do not bypass', () => {
  for (const p of ['/api/auth/session', '/api/auth/csrf', '/api/auth/callback/admin-credentials', '/api/auth/signin']) assert.equal(status(anon, 'POST', p), 200)
  assert.equal(status(anon, 'POST', '/api/events/'), 401)
  assert.equal(status(president, 'post', '/api/events/'), 403)
  assert.equal(status(anon, 'get', '/api/admin/x/'), 401)
  assert.equal(status(anon, 'GET', '/api/authx/session'), 401) // not "/api/auth/"
})

test('lookalike paths are not public', () => {
  for (const p of ['/api/events/x', '/api/brackets/x', '/api/leaderboard/aggregated/x', '/api/leaderboard/tournament-standings', '/api/clubs/x', '/api/clubs'])
    assert.equal(status(anon, 'GET', p), 401, p)
})

test('verdict shape for denials', () => {
  assert.deepEqual(call(anon, 'GET', '/api/registrations'), { allow: false, status: 401, code: 'unauthenticated', message: 'Please sign in.' })
  const r = call(president, 'POST', '/api/events')
  assert.equal(r.status, 403)
  assert.equal(r.code, 'forbidden')
})

test('the middleware file wires the policy to /api/** only', () => {
  const src = readFileSync('src/middleware.js', 'utf8')
  assert.match(src, /decideAccess/)
  assert.match(src, /matcher: \['\/api\/:path\*'\]/)
})
