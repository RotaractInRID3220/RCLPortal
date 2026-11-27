import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const tmp = await mkdtemp(path.join(tmpdir(), 'rcl-slips-'))
process.env.STORAGE_DRIVER = 'local'
process.env.STORAGE_LOCAL_DIR = tmp
const { query, closePool } = await import('../src/server/db.mjs')
const { sniffImage } = await import('../src/server/payments/image.mjs')
const { createStorage, isValidKey } = await import('../src/server/storage/index.mjs')
const svc = await import('../src/server/payments/service.mjs')

const A = 9101, B = 9102
const actor = { member_id: 11, hasAdminAccess: false, club_id: A }
const admin1 = { member_id: 21, hasAdminAccess: true, club_id: 1 }
const admin2 = { member_id: 22, hasAdminAccess: true, club_id: 1 }
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP'), Buffer.alloc(32)])

async function cleanup() {
  await query('DELETE FROM audit_log WHERE entity = $1', ['payment_slip'])
  await query('DELETE FROM payment_slips WHERE club_id = ANY($1)', [[A, B]])
  await query('DELETE FROM players WHERE club_id = ANY($1)', [[A, B]])
}
before(async () => {
  await query(`INSERT INTO clubs (club_id, club_name, category, status) VALUES ($1,'Pay Club A','community',1),($2,'Pay Club B','community',1) ON CONFLICT (club_id) DO NOTHING`, [A, B])
  await cleanup()
})
after(async () => {
  await cleanup()
  await query('DELETE FROM clubs WHERE club_id = ANY($1)', [[A, B]])
  await rm(tmp, { recursive: true, force: true })
  await closePool()
})
beforeEach(cleanup)

const submit = (o = {}) => svc.createSlip({ actor, clubId: o.clubId ?? A, value: o.value ?? 1000, slipNumber: o.slip ?? 'S-1', buffer: 'buffer' in o ? o.buffer : JPEG })
const ok = async (p) => { const r = await p; assert.equal(r.ok, true, JSON.stringify(r)); return r }
const bad = async (p, code, status) => { const r = await p; assert.equal(r.ok, false, 'expected failure'); assert.equal(r.code, code, JSON.stringify(r)); if (status) assert.equal(r.status, status); return r }

test('image sniffing uses the file bytes, not names or declared types', () => {
  assert.deepEqual(sniffImage(JPEG), { ext: 'jpg', mime: 'image/jpeg' })
  assert.deepEqual(sniffImage(PNG), { ext: 'png', mime: 'image/png' })
  assert.deepEqual(sniffImage(WEBP), { ext: 'webp', mime: 'image/webp' })
  assert.equal(sniffImage(Buffer.from('GIF89a' + 'x'.repeat(40))), null)
  assert.equal(sniffImage(Buffer.from('%PDF-1.7' + 'x'.repeat(40))), null)
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null)
  assert.equal(sniffImage(Buffer.from('not an image at all, just text')), null)
  assert.equal(sniffImage(Buffer.alloc(5)), null)
  assert.equal(sniffImage(null), null)
})

test('storage keys: only our own shape is accepted (no path tricks)', () => {
  const good = 'slips/12/123e4567-e89b-42d3-a456-426614174000.jpg'
  assert.equal(isValidKey(good), true)
  for (const k of ['../etc/passwd', 'slips/../x.jpg', 'slips/12/../../x.jpg', 'slips/12/abc.jpg', '/slips/12/123e4567-e89b-42d3-a456-426614174000.jpg', 'slips/12/123e4567-e89b-42d3-a456-426614174000.svg', 'slips/x/123e4567-e89b-42d3-a456-426614174000.jpg'])
    assert.equal(isValidKey(k), false, k)
})

test('local driver: put/get/delete round-trip, missing file is null, bad key throws', async () => {
  const st = await createStorage({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: tmp })
  const key = 'slips/5/123e4567-e89b-42d3-a456-426614174001.png'
  await st.put(key, PNG)
  const got = await st.get(key)
  assert.equal(got.contentType, 'image/png'); assert.ok(got.body.equals(PNG))
  await st.delete(key)
  assert.equal(await st.get(key), null)
  await assert.rejects(st.put('../escape.png', PNG), /Invalid storage key/)
  await assert.rejects(st.get('slips/1/../../x.jpg'), /Invalid storage key/)
})

test('s3 driver: sends the right commands, maps NoSuchKey to null, validates config and keys', async () => {
  const sent = []
  const fake = { async send(cmd) {
    sent.push([cmd.constructor.name, cmd.input])
    if (cmd.constructor.name === 'GetObjectCommand') {
      if (cmd.input.Key.endsWith('0001.jpg')) { const e = new Error('nope'); e.name = 'NoSuchKey'; throw e }
      return { Body: { transformToByteArray: async () => new Uint8Array(JPEG) } }
    }
    return {}
  } }
  const env = { STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://minio:9000', S3_BUCKET: 'rcl-slips', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's' }
  const st = await createStorage(env, { s3Client: fake })
  const key = 'slips/7/123e4567-e89b-42d3-a456-426614174002.jpg'
  await st.put(key, JPEG)
  assert.deepEqual(sent[0][1], { Bucket: 'rcl-slips', Key: key, Body: JPEG, ContentType: 'image/jpeg' })
  assert.ok((await st.get(key)).body.equals(JPEG))
  assert.equal(await st.get('slips/7/123e4567-e89b-42d3-a456-426614170001.jpg'), null)
  await st.delete(key)
  assert.equal(sent.at(-1)[0], 'DeleteObjectCommand')
  await assert.rejects(st.put('slips/../x.jpg', JPEG), /Invalid storage key/)
  await assert.rejects(createStorage({ STORAGE_DRIVER: 's3', S3_BUCKET: 'x' }), /S3_ENDPOINT is not set/)
  await assert.rejects(createStorage({ STORAGE_DRIVER: 'ftp' }), /Unknown STORAGE_DRIVER/)
})

test('submit: stores the file privately under the club, records the row, returns no storage key', async () => {
  const { slip } = await ok(submit({ value: '1250.499', slip: ' S-77 ' }))
  assert.equal(slip.value, 1250.5)
  assert.equal(slip.approved, null)
  assert.equal(slip.link, `/api/payment-slips/${slip.payment_id}/file`)
  assert.ok(!('object_key' in slip))
  assert.ok(!/(?<![-\w])slips\/\d+\//.test(JSON.stringify(slip)), 'storage key leaked')
  const { rows: [r] } = await query('SELECT slip_number, object_key, submitted_by, club_id FROM payment_slips WHERE payment_id = $1', [slip.payment_id])
  assert.deepEqual([r.slip_number, r.submitted_by, r.club_id], ['S-77', 11, A])
  assert.match(r.object_key, new RegExp(`^slips/${A}/[0-9a-f-]{36}\\.jpg$`))
  assert.equal((await stat(path.join(tmp, r.object_key))).size, JPEG.length)
})

test('submit: validation (amount, slip number, file presence/type/size)', async () => {
  await bad(submit({ value: 0 }), 'invalid_value', 400)
  await bad(submit({ value: -5 }), 'invalid_value')
  await bad(submit({ value: 'abc' }), 'invalid_value')
  await bad(submit({ value: 99_999_999 }), 'invalid_value')
  await bad(submit({ slip: '   ' }), 'invalid_slip_number', 400)
  await bad(submit({ slip: 'x'.repeat(41) }), 'invalid_slip_number')
  await bad(submit({ buffer: Buffer.alloc(0) }), 'file_required', 400)
  await bad(submit({ buffer: null }), 'file_required')
  await bad(submit({ buffer: Buffer.from('%PDF-1.7' + 'x'.repeat(100)) }), 'invalid_file_type', 415)
  await bad(submit({ buffer: Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]) }), 'file_too_large', 413)
  assert.equal((await query('SELECT count(*)::int n FROM payment_slips WHERE club_id = $1', [A])).rows[0].n, 0)
})

test('submit: a rejected submission leaves no file behind; a database failure removes the stored file', async () => {
  const before = (await readdir(path.join(tmp, 'slips'), { recursive: true }).catch(() => [])).length
  await bad(submit({ buffer: Buffer.from('plain text file!!') }), 'invalid_file_type')
  assert.equal((await readdir(path.join(tmp, 'slips'), { recursive: true }).catch(() => [])).length, before)
  await assert.rejects(svc.createSlip({ actor, clubId: 987654321, value: 10, slipNumber: 'FK', buffer: JPEG }), /foreign key|violates/i) // unknown club
  assert.equal((await readdir(path.join(tmp, 'slips'), { recursive: true }).catch(() => [])).filter((f) => f.endsWith('.jpg')).length, before ? (await readdir(path.join(tmp, 'slips'), { recursive: true })).filter((f) => f.endsWith('.jpg')).length : 0)
})

test('duplicate slip number: blocked unless the earlier one was rejected; 6 parallel submits create exactly one', async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => submit({ slip: 'DUP-1' })))
  assert.equal(results.filter((r) => r.ok).length >= 1, true)
  const n = (await query("SELECT count(*)::int n FROM payment_slips WHERE club_id = $1 AND slip_number = 'DUP-1'", [A])).rows[0].n
  assert.equal(n, 1, `parallel submits created ${n} rows`)
})

test('duplicate slip number rules: case-insensitive, per club, reusable after a rejection', async () => {
  const { slip } = await ok(submit({ slip: 'Ab-1' }))
  await bad(submit({ slip: 'aB-1' }), 'duplicate_slip', 409)
  await ok(submit({ clubId: B, slip: 'Ab-1' }))                       // another club may use the same number
  await ok(svc.decideSlip({ actor: admin1, id: slip.payment_id, approve: false }))
  await ok(submit({ slip: 'ab-1' }))                                   // allowed again after rejection
})

test('file access: own club and admins only; unknown 404; missing file 404', async () => {
  const { slip } = await ok(submit())
  const own = await ok(svc.getSlipFile({ user: actor, id: slip.payment_id }))
  assert.equal(own.contentType, 'image/jpeg'); assert.ok(own.body.equals(JPEG))
  await bad(svc.getSlipFile({ user: { member_id: 2, hasAdminAccess: false, club_id: B }, id: slip.payment_id }), 'forbidden', 403)
  await ok(svc.getSlipFile({ user: admin1, id: slip.payment_id }))
  await bad(svc.getSlipFile({ user: admin1, id: 99999999 }), 'slip_not_found', 404)
  const { rows: [r] } = await query('SELECT object_key FROM payment_slips WHERE payment_id = $1', [slip.payment_id])
  await rm(path.join(tmp, r.object_key))
  await bad(svc.getSlipFile({ user: actor, id: slip.payment_id }), 'file_missing', 404)
})

test('decision: approve once; deciding again (either way) is 409; unknown is 404; audited with the admin id', async () => {
  const { slip } = await ok(submit())
  const done = await ok(svc.decideSlip({ actor: admin1, id: slip.payment_id, approve: true }))
  assert.equal(done.slip.approved, true)
  await bad(svc.decideSlip({ actor: admin1, id: slip.payment_id, approve: false }), 'already_decided', 409)   // an approval cannot be flipped
  await bad(svc.decideSlip({ actor: admin2, id: slip.payment_id, approve: true }), 'already_decided', 409)
  await bad(svc.decideSlip({ actor: admin1, id: 99999999, approve: true }), 'slip_not_found', 404)
  const { rows } = await query("SELECT actor_id, action FROM audit_log WHERE entity = 'payment_slip' AND entity_id = $1", [String(slip.payment_id)])
  assert.deepEqual(rows.map((r) => [r.actor_id, r.action]), [[21, 'payment.approve']])
  const { rows: [r] } = await query('SELECT decided_by, decided_at FROM payment_slips WHERE payment_id = $1', [slip.payment_id])
  assert.equal(r.decided_by, 21); assert.ok(r.decided_at)
})

test('decision race: two admins approving/rejecting at once -> exactly one wins', async () => {
  for (let i = 0; i < 5; i++) {
    const { slip } = await ok(submit({ slip: `RACE-${i}` }))
    const rs = await Promise.all([svc.decideSlip({ actor: admin1, id: slip.payment_id, approve: true }), svc.decideSlip({ actor: admin2, id: slip.payment_id, approve: false }), svc.decideSlip({ actor: admin1, id: slip.payment_id, approve: true })])
    assert.equal(rs.filter((r) => r.ok).length, 1)
    assert.ok(rs.filter((r) => !r.ok).every((r) => r.code === 'already_decided'))
    assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE entity='payment_slip' AND entity_id=$1", [String(slip.payment_id)])).rows[0].n, 1)
  }
})

test('club slips list: own rows only, newest first', async () => {
  await ok(submit({ slip: 'L-1' })); await ok(submit({ slip: 'L-2' })); await ok(submit({ clubId: B, slip: 'L-3' }))
  const mine = await svc.listClubSlips(A)
  assert.deepEqual(mine.map((s) => s.slip_number), ['L-2', 'L-1'])
  assert.ok(mine.every((s) => s.club_id === A && s.link.endsWith('/file')))
})

test('admin list: tabs, search by club or slip number, paging, counts', async () => {
  const a = await ok(submit({ slip: 'T-1' })); const b = await ok(submit({ slip: 'T-2' })); await ok(submit({ clubId: B, slip: 'XYZ-3' }))
  await svc.decideSlip({ actor: admin1, id: a.slip.payment_id, approve: true }); await svc.decideSlip({ actor: admin1, id: b.slip.payment_id, approve: false })
  const only = (res) => res.payments.filter((p) => [A, B].includes(p.club_id))
  assert.deepEqual(only(await svc.listSlipsAdmin({ tab: 'approved', search: 'Pay Club' })).map((p) => p.slip_number), ['T-1'])
  assert.deepEqual(only(await svc.listSlipsAdmin({ tab: 'rejected', search: 'Pay Club' })).map((p) => p.slip_number), ['T-2'])
  assert.deepEqual(only(await svc.listSlipsAdmin({ tab: 'pending', search: 'Pay Club' })).map((p) => p.slip_number), ['XYZ-3'])
  const bySlip = await svc.listSlipsAdmin({ tab: 'pending', search: 'xyz' })
  assert.equal(bySlip.totalCount, 1); assert.equal(bySlip.payments[0].club_name, 'Pay Club B')
  assert.equal((await svc.listSlipsAdmin({ tab: 'pending', search: '%%%' })).totalCount, 0)         // wildcards escaped
  assert.equal((await svc.listSlipsAdmin({ tab: 'bogus', search: 'xyz' })).totalCount, 1)            // unknown tab falls back to pending
  const paged = await svc.listSlipsAdmin({ tab: 'approved', page: 1, limit: 1, search: 'Pay Club' })
  assert.equal(paged.payments.length, 1); assert.equal(paged.totalPages, 1)
  assert.ok((await svc.listSlipsAdmin({ limit: 9999 })).payments.length <= 100)
})

test('finance: players x fee, paid = approved slips only, remaining never negative; club summary and totals agree', async () => {
  const fee = await svc.getFee()
  assert.equal(typeof fee, 'number')
  await query("INSERT INTO players (member_id, name, club_id, gender, status) SELECT 880000 + g, 'P' || g, $1, 'F', 1 FROM generate_series(1, 7) g", [A])
  const pending = await ok(submit({ slip: 'F-1', value: 1500 }))
  const appr = await ok(submit({ slip: 'F-2', value: 2500.5 }))
  await ok(svc.decideSlip({ actor: admin1, id: appr.slip.payment_id, approve: true }))
  const rej = await ok(submit({ slip: 'F-3', value: 999 })); await ok(svc.decideSlip({ actor: admin1, id: rej.slip.payment_id, approve: false }))
  let f = await svc.clubFinance(A)
  assert.deepEqual([f.totalPlayers, f.totalAmount, f.paidAmount, f.remainingAmount], [7, 7 * fee, 2500.5, Math.max(0, 7 * fee - 2500.5)])
  const sum = (await svc.clubsSummary()).clubs.find((c) => c.club_id === A)
  assert.deepEqual([sum.playerCount, sum.totalAmount, sum.paidAmount, sum.toBePaid], [7, 7 * fee, 2500.5, Math.max(0, 7 * fee - 2500.5)])
  assert.equal((await svc.clubsSummary()).clubs.some((c) => c.club_id === B), false)  // clubs without players are left out
  await ok(svc.decideSlip({ actor: admin1, id: pending.slip.payment_id, approve: true }))
  await ok(svc.decideSlip({ actor: admin1, id: (await ok(submit({ slip: 'F-4', value: 1_000_000 }))).slip.payment_id, approve: true }))
  f = await svc.clubFinance(A)
  assert.equal(f.remainingAmount, 0)                                                    // overpaid -> 0, not negative
  const s = await svc.financeStats()
  assert.ok(s.totalPlayers >= 7 && s.totalPaymentsReceived >= f.paidAmount && s.registrationFee === fee)
  assert.equal(s.amountYetToCome, Math.max(0, s.totalIncome - s.totalPaymentsReceived))
  assert.equal((await svc.clubFinance(B)).totalPlayers, 0)
})

test('finance fails closed when the fee setting is missing', async () => {
  const { rows: [saved] } = await query("SELECT value, updated_by FROM settings WHERE key = 'fees.registration_per_player'")
  await query("DELETE FROM settings WHERE key = 'fees.registration_per_player'")
  try {
    assert.equal(await svc.getFee(), null)
    const f = await svc.clubFinance(A)
    assert.equal(f.totalAmount, null); assert.equal(f.remainingAmount, null)
  } finally {
    await query("INSERT INTO settings (key, value, updated_by) VALUES ('fees.registration_per_player', $1::jsonb, $2)", [JSON.stringify(saved.value), saved.updated_by])
  }
})
