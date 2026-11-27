import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startMock } from '../scripts/mock-rmis.mjs'
import { rmis } from '../src/server/rmis/client.mjs'
import { authorizeCredentials, accessFor, LoginError, SESSION_FIELDS } from '../src/server/auth/authorize.mjs'

let mock
before(async () => {
  mock = await startMock()
  process.env.RMIS_API_URL = mock.url
  process.env.RMIS_API_KEY = mock.key
})
after(async () => { await mock.close() })
beforeEach(() => { mock.state.failures.clear(); mock.state.failNext = 0 })

const deps = { rmis, getPermissionLevel: async (id) => (id === 'none' ? null : 'admin') }
const code = (p) => p.then(() => null, (e) => (e instanceof LoginError ? e.code : `other:${e.message}`))

test('role -> access mapping (1-6 portal, 1-4 admin)', () => {
  assert.deepEqual(accessFor(1), { hasPortalAccess: true, hasAdminAccess: true })
  assert.deepEqual(accessFor(4), { hasPortalAccess: true, hasAdminAccess: true })
  assert.deepEqual(accessFor(5), { hasPortalAccess: true, hasAdminAccess: false })
  assert.deepEqual(accessFor(6), { hasPortalAccess: true, hasAdminAccess: false })
  assert.deepEqual(accessFor(7), { hasPortalAccess: false, hasAdminAccess: false })
  assert.deepEqual(accessFor(31), { hasPortalAccess: false, hasAdminAccess: false })
})

test('president: portal only; status 1; membership_id null is fine', async () => {
  const u = await authorizeCredentials({ username: 'test.president', password: 'test1234' }, deps)
  assert.equal(u.hasPortalAccess, true)
  assert.equal(u.hasAdminAccess, false)
  assert.equal(u.membership_id, null)
  assert.equal(u.id, String(u.member_id))
  assert.equal(u.club_id, 1)
  assert.equal(u.permission_level, 'admin')
})

test('RDSC with transferred status (3): portal + admin', async () => {
  const u = await authorizeCredentials({ username: 'test.disco', password: 'test1234' }, deps)
  assert.equal(u.status, 3)
  assert.equal(u.hasAdminAccess, true)
})

test('username is trimmed + lowercased; legacy `email` field still accepted', async () => {
  assert.ok(await authorizeCredentials({ username: '  TEST.President ', password: 'test1234' }, deps))
  assert.ok(await authorizeCredentials({ email: 'test.president', password: 'test1234' }, deps))
})

test('error codes surfaced to the login page', async () => {
  const c = (u, p) => code(authorizeCredentials({ username: u, password: p }, deps))
  assert.equal(await c('test.president', 'wrong'), 'invalid_credentials')
  assert.equal(await c('nobody', 'x'), 'invalid_credentials')
  assert.equal(await c('', 'x'), 'invalid_credentials')
  assert.equal(await c('test.president', ''), 'invalid_credentials')
  assert.equal(await c('ina.inactive', 'pass1234'), 'member_inactive')
  assert.equal(await c('terry.term', 'pass1234'), 'member_terminated')
  assert.equal(await c('cleo.closed', 'pass1234'), 'club_terminated')
  assert.equal(await c('gary.general', 'pass1234'), 'no_access') // role 31 may log in to RMIS but not to RCL
})

test('rate limit -> rate_limited:<seconds>', async () => {
  for (let i = 0; i < 10; i++) await code(authorizeCredentials({ username: 'pat.president', password: 'bad' }, deps))
  const r = await code(authorizeCredentials({ username: 'pat.president', password: 'pass1234' }, deps))
  assert.match(r, /^rate_limited:\d+$/)
  assert.ok(Number(r.split(':')[1]) >= 290)
})

test('RMIS down -> rmis_unavailable (no stack, no credentials in the code)', async () => {
  const old = process.env.RMIS_API_URL
  process.env.RMIS_API_URL = 'http://localhost:9/api/public/rcl'
  try { assert.equal(await code(authorizeCredentials({ username: 'test.president', password: 'test1234' }, deps)), 'rmis_unavailable') }
  finally { process.env.RMIS_API_URL = old }
})

test('permission lookup failure does not block login', async () => {
  const u = await authorizeCredentials({ username: 'test.president', password: 'test1234' },
    { rmis, getPermissionLevel: async () => { throw new Error('db down') } })
  assert.equal(u.permission_level, null)
})

test('session shape holds no NIC / DOB / hash', async () => {
  const u = await authorizeCredentials({ username: 'test.president', password: 'test1234' }, deps)
  const forbidden = ['nic', 'dob', 'birthdate', 'password', 'm_password', 'email']
  for (const f of forbidden) assert.ok(!(f in u), `user object has ${f}`)
  for (const f of SESSION_FIELDS) assert.ok(f in u, `SESSION_FIELDS lists ${f} but the user lacks it`)
})
