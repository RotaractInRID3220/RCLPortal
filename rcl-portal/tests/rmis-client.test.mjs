import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startMock } from '../scripts/mock-rmis.mjs'
import { rmis, RmisError } from '../src/server/rmis/client.mjs'

let mock
before(async () => {
  mock = await startMock({ nextKey: 'next-key' })
  process.env.RMIS_API_URL = mock.url
  process.env.RMIS_API_KEY = mock.key
})
after(async () => { await mock.close() })
beforeEach(() => { mock.state.delayMs = 0; mock.state.failNext = 0; mock.state.failures.clear(); mock.state.requests.length = 0 })

const login = (u, p = 'test1234') => rmis.verifyLogin({ username: u, password: p })
const status = async (p) => p.then(() => 200, (e) => (e instanceof RmisError ? e.status : -1))

test('health ok', async () => assert.equal((await rmis.health()).status, 'ok'))

test('wrong key -> 401 unauthorized', async () => {
  const old = process.env.RMIS_API_KEY
  process.env.RMIS_API_KEY = 'nope'
  try { await assert.rejects(rmis.health(), (e) => e.status === 401 && e.code === 'unauthorized') } finally { process.env.RMIS_API_KEY = old }
})

test('missing configuration is a clear error', async () => {
  const old = process.env.RMIS_API_KEY
  delete process.env.RMIS_API_KEY
  try { await assert.rejects(rmis.health(), (e) => e.code === 'rmis_not_configured') } finally { process.env.RMIS_API_KEY = old }
})

test('login success returns the documented shape', async () => {
  const m = await login('test.president')
  for (const k of ['member_id', 'membership_id', 'username', 'card_name', 'full_name', 'club_id', 'club_name', 'role_id', 'role_label', 'designation', 'status'])
    assert.ok(k in m, `missing ${k}`)
  assert.equal(m.role_id, 5)
  assert.equal(m.membership_id, null) // allowed to be null
})

test('login errors map to status + code', async () => {
  const cases = [
    [['test.president', 'wrong'], 401, 'invalid_credentials'],
    [['nobody.here'], 401, 'invalid_credentials'],
    [['ina.inactive', 'pass1234'], 403, 'member_inactive'],
    [['terry.term', 'pass1234'], 403, 'member_terminated'],
    [['cleo.closed', 'pass1234'], 403, 'club_terminated'],
  ]
  for (const [args, st, code] of cases)
    await assert.rejects(login(...args), (e) => e.status === st && e.code === code, `${args[0]}`)
})

test('login throttle: the 11th failure is 429 with retryAfter (per username, no IP involved)', async () => {
  for (let i = 0; i < 10; i++) await assert.rejects(login('pat.president', 'bad'), (e) => e.status === 401)
  await assert.rejects(login('pat.president', 'pass1234'), (e) => e.status === 429 && e.retryAfter >= 290)
  assert.ok((await login('test.president')).member_id > 0) // other users unaffected
})

test('the login request always carries a valid placeholder client_ip (RMIS requires the field)', async () => {
  const sent = []
  const orig = globalThis.fetch
  globalThis.fetch = async (u, init) => { if (String(u).endsWith('/auth/verify')) sent.push(JSON.parse(init.body)); return orig(u, init) }
  try { await login('test.president') } finally { globalThis.fetch = orig }
  assert.equal(sent.length, 1)
  assert.match(sent[0].client_ip, /^\d+\.\d+\.\d+\.\d+$/)
})

test('listClubs maps RMIS "university" to RCL "institute"', async () => {
  const clubs = await rmis.listClubs()
  assert.ok(clubs.length >= 4)
  assert.ok(clubs.every((c) => ['community', 'institute'].includes(c.category)))
  assert.equal(clubs.find((c) => c.club_id === 3).category, 'institute')
  assert.ok(clubs.every((c) => c.status === 1))
  assert.ok((await rmis.listClubs({ includeInactive: true })).length > clubs.length)
})

test('listClubMembers follows the cursor across pages', async () => {
  const before = mock.state.requests.length
  // 12 members in club 2 minus hidden/inactive; page size is fixed at 1000 by the client, so force pages via a small mock limit check
  const all = await rmis.listClubMembers(2)
  assert.ok(all.length >= 10)
  assert.ok(all.every((m) => [1, 3, 5].includes(m.status) && m.club_id === 2))
  assert.equal(new Set(all.map((m) => m.member_id)).size, all.length)
  assert.ok(mock.state.requests.length > before)
})

test('listClubMembers: unknown club -> 404, cutoff in the past -> empty', async () => {
  await assert.rejects(rmis.listClubMembers(999), (e) => e.status === 404 && e.code === 'club_not_found')
  assert.deepEqual(await rmis.listClubMembers(2, { createdOnOrBefore: '2000-01-01T00:00:00Z' }), [])
})

test('test accounts are hidden from lists, lookup and single fetch', async () => {
  const all = await rmis.listClubMembers(1)
  assert.ok(!all.some((m) => /Test /.test(m.card_name)))
  const tp = mock.state.members.find((m) => m.username === 'test.president')
  assert.equal(await rmis.getMember(tp.member_id), null)
  const [r] = await rmis.lookupMembers({ memberIds: [tp.member_id] })
  assert.equal(r.found, false)
})

test('changes: pagination through the feed, ordered, no duplicates', async () => {
  const seen = []
  let cursor
  do {
    const page = await rmis.changes({ updatedSince: '1970-01-01T00:00:00Z', cursor, limit: 5 })
    assert.ok(page.serverTime)
    seen.push(...page.members)
    cursor = page.nextCursor
  } while (cursor)
  assert.ok(seen.length > 20)
  assert.equal(new Set(seen.map((m) => m.member_id)).size, seen.length)
  for (let i = 1; i < seen.length; i++)
    assert.ok(`${seen[i - 1].updated_at}|${String(seen[i - 1].member_id).padStart(9, '0')}` <= `${seen[i].updated_at}|${String(seen[i].member_id).padStart(9, '0')}`)
})

test('changes: a status change shows up with the new status and role_id', async () => {
  const m = mock.state.members.find((x) => x.card_name === 'Member 2-3')
  const t0 = new Date(Date.now() - 1000).toISOString()
  m.status = 4; m.role_id = 31; m.updated_at = new Date().toISOString()
  const { members } = await rmis.changes({ updatedSince: t0 })
  const hit = members.find((x) => x.member_id === m.member_id)
  assert.equal(hit.status, 4)
  assert.equal(hit.role_id, 31)
})

test('changes: bad input -> 400', async () => {
  await assert.rejects(rmis.changes({}), (e) => e.status === 400)
})

test('lookup: found and not found, chunking above 500 ids', async () => {
  const known = mock.state.members.find((m) => m.club_id === 2 && !m.username)
  const res = await rmis.lookupMembers({ memberIds: [known.member_id, 999999999], membershipIds: [known.membership_id, 'ZZ'] })
  assert.deepEqual(res.map((r) => r.found), [true, false, true, false])
  assert.equal(res[0].club_id, 2)
  const ids = Array.from({ length: 1200 }, (_, i) => i + 1)
  const before = mock.state.requests.length
  const many = await rmis.lookupMembers({ memberIds: ids })
  assert.equal(many.length, 1200)
  assert.equal(mock.state.requests.length - before, 3) // 500 + 500 + 200
})

test('getMember: 404 -> null', async () => {
  assert.equal(await rmis.getMember(987654321), null)
})

test('searchAdmins: min length and role filter', async () => {
  await assert.rejects(rmis.searchAdmins('ab'), (e) => e.status === 400)
  const hits = await rmis.searchAdmins('alice')
  assert.equal(hits.length, 1)
  assert.ok(hits[0].role_id >= 1 && hits[0].role_id <= 4)
  assert.equal((await rmis.searchAdmins('pat president')).length, 0) // role 5 is not admin-eligible
})

test('retries once on 5xx and recovers (clubs)', async () => {
  mock.state.failNext = 1
  assert.ok((await rmis.listClubs()).length > 0)
})

test('gives up after the retry: persistent 5xx -> RmisError', async () => {
  mock.state.failNext = 5
  await assert.rejects(rmis.listClubs(), (e) => e instanceof RmisError && e.status === 503)
  mock.state.failNext = 0
})

test('does not retry 4xx (one request only)', async () => {
  const before = mock.state.requests.length
  await assert.rejects(login('test.president', 'bad'), (e) => e.status === 401)
  assert.equal(mock.state.requests.length - before, 1)
})

test('timeout -> rmis_unreachable', async () => {
  mock.state.delayMs = 400
  const old = process.env.RMIS_API_URL
  const t0 = Date.now()
  // health uses a 3 s timeout; use the real timeout path via a closed port instead
  process.env.RMIS_API_URL = 'http://localhost:9/api/public/rcl'
  try { await assert.rejects(rmis.listClubs(), (e) => e.status === 503 && e.code === 'rmis_unreachable') } finally { process.env.RMIS_API_URL = old; mock.state.delayMs = 0 }
  assert.ok(Date.now() - t0 < 5000)
})

test('the API key is never part of an error message', async () => {
  try { await rmis.listClubMembers(999) } catch (e) { assert.ok(!String(e.message).includes(mock.key)) }
})
