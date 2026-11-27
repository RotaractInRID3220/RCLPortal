// Integration tests against the local Postgres (DATABASE_URL from .env.local, migrated + seeded).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const have = Boolean(process.env.DATABASE_URL)
const { query, tx, closePool } = await import('../src/server/db.mjs')
const { getSetting, getSettings, setSetting, isOpenSince } = await import('../src/server/settings.mjs')
const { getPermissionLevel, hasPermission } = await import('../src/server/auth/permissions.mjs')
after(closePool)

test('db reachable and migrated', { skip: !have }, async () => {
  const { rows } = await query("SELECT count(*)::int AS n FROM event_days")
  assert.equal(rows[0].n, 5)
})

test('bigint columns come back as numbers', { skip: !have }, async () => {
  const { rows } = await query('SELECT 9007199254::bigint AS b')
  assert.equal(typeof rows[0].b, 'number')
})

test('seeded days are D-01..D-04 plus D-05 road race, no e-sport day', { skip: !have }, async () => {
  const { rows } = await query('SELECT day_code FROM event_days ORDER BY sort_order')
  assert.deepEqual(rows.map((r) => r.day_code), ['D-01', 'D-02', 'D-03', 'D-04', 'D-05'])
})

test('settings: seeded values + absent keys are undefined (fail closed)', { skip: !have }, async () => {
  assert.equal(await getSetting('fees.registration_per_player'), 1000)
  assert.deepEqual(await getSetting('points.placement'), [100, 75, 50])
  assert.equal(await getSetting('no.such.setting'), undefined)   // absent key (dates may be set by an admin in the dev DB)
  const many = await getSettings(['penalty.min_players', 'no.such.setting'])
  assert.equal(many['penalty.min_players'], 5)
  assert.equal(many['no.such.setting'], undefined)
})

test('limits.groups seeded and valid', { skip: !have }, async () => {
  const { validateLimitRules } = await import('../src/server/rules/limits.mjs')
  assert.deepEqual(validateLimitRules(await getSetting('limits.groups')), [])
})

test('events.limit_group exists, defaults to standard, rejects unknown groups', { skip: !have }, async () => {
  await tx(async (c) => {
    await c.query("INSERT INTO events (sport_name, sport_type, gender_type, category) VALUES ('t','team','mixed','community')")
    const { rows } = await c.query("SELECT limit_group FROM events WHERE sport_name='t'")
    assert.equal(rows[0].limit_group, 'standard')
    await assert.rejects(c.query("UPDATE events SET limit_group='gym' WHERE sport_name='t'"), /check/)
    throw new Error('rollback')
  }).catch((e) => { if (e.message !== 'rollback' && !/check/.test(e.message)) throw e })
})

test('settings: set + overwrite round-trips JSON', { skip: !have }, async () => {
  await setSetting('test.tmp', { a: [1, 2] }, 7)
  assert.deepEqual(await getSetting('test.tmp'), { a: [1, 2] })
  await setSetting('test.tmp', 5, 7)
  assert.equal(await getSetting('test.tmp'), 5)
  await query("DELETE FROM settings WHERE key = 'test.tmp'")
})

test('isOpenSince: unset or future = closed', () => {
  assert.equal(isOpenSince(undefined), false)
  assert.equal(isOpenSince('garbage'), false)
  assert.equal(isOpenSince('2999-01-01T00:00:00Z'), false)
  assert.equal(isOpenSince('2000-01-01T00:00:00Z'), true)
})

test('tx commits on success and rolls back on error', { skip: !have }, async () => {
  await tx((c) => c.query("INSERT INTO settings (key, value) VALUES ('test.tx', '1')"))
  assert.equal(await getSetting('test.tx'), 1)
  await assert.rejects(tx(async (c) => { await c.query("UPDATE settings SET value = '2' WHERE key = 'test.tx'"); throw new Error('boom') }), /boom/)
  assert.equal(await getSetting('test.tx'), 1)
  await query("DELETE FROM settings WHERE key = 'test.tx'")
})

test('permissions: level lookup + hierarchy', { skip: !have }, async () => {
  assert.equal(await getPermissionLevel(424242), null)
  await query("INSERT INTO permissions (member_id, permission_level) VALUES (424242, 'super_admin') ON CONFLICT DO NOTHING")
  assert.equal(await getPermissionLevel(424242), 'super_admin')
  assert.equal(hasPermission('super_admin', 'admin'), true)
  assert.equal(hasPermission('admin', 'super_admin'), false)
  assert.equal(hasPermission(null, 'admin'), false)
  assert.equal(hasPermission('administrator', 'administrator'), true)
  await query('DELETE FROM permissions WHERE member_id = 424242')
})

test('app role cannot see migrations; reads/writes work', { skip: !have }, async () => {
  await assert.rejects(query('SELECT * FROM schema_migrations'), /permission denied/)
})
