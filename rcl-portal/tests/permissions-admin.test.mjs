import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const svc = await import('../src/server/auth/permissions-admin.mjs')

// members 960001-969999 (shared range with dashboards.test; this file uses 965xxx)
const [ADM1, ADM2, SUP, PLAIN, ROLE5] = [965001, 965002, 965003, 965004, 965005]
const MINE = [ADM1, ADM2, SUP, PLAIN, ROLE5]
const a1 = { member_id: ADM1 }, a2 = { member_id: ADM2 }, sup = { member_id: SUP }
let otherAdmins = []

const ensureMember = (id, role, name) => query(
  `INSERT INTO rmis_members (member_id, club_id, status, role_id, card_name, created_at, updated_at) VALUES ($1, 1, 1, $2, $3, now(), now())
   ON CONFLICT (member_id) DO UPDATE SET role_id = EXCLUDED.role_id, card_name = EXCLUDED.card_name`, [id, role, name])
const level = async (id) => (await query('SELECT permission_level FROM permissions WHERE member_id = $1', [id])).rows[0]?.permission_level ?? null
const auditCount = async (action) => (await query("SELECT count(*)::int AS n FROM audit_log WHERE action = $1 AND actor_id = ANY($2)", [action, MINE])).rows[0].n

before(async () => {
  // The "last administrator" rule is global, so set the stage: park any real administrators and restore them afterwards.
  otherAdmins = (await query("SELECT * FROM permissions WHERE permission_level = 'administrator' AND member_id <> ALL($1)", [MINE])).rows
  await query("DELETE FROM permissions WHERE permission_level = 'administrator' AND member_id <> ALL($1)", [MINE])
  await ensureMember(ADM1, 1, 'Perm Admin One'); await ensureMember(ADM2, 2, 'Perm Admin Two'); await ensureMember(SUP, 3, 'Perm Super')
  await ensureMember(PLAIN, 4, 'Perm Plain Admin Role'); await ensureMember(ROLE5, 5, 'Perm Portal Only')
})
after(async () => {
  await query('DELETE FROM permissions WHERE member_id = ANY($1)', [MINE])
  await query('DELETE FROM audit_log WHERE actor_id = ANY($1)', [MINE])
  await query('DELETE FROM rmis_members WHERE member_id = ANY($1)', [MINE])
  for (const p of otherAdmins) await query('INSERT INTO permissions (member_id, permission_level, card_name, granted_by, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [p.member_id, p.permission_level, p.card_name, p.granted_by, p.created_at])
  await closePool()
})
beforeEach(async () => {
  await query('DELETE FROM permissions WHERE member_id = ANY($1)', [MINE])
  await query('DELETE FROM audit_log WHERE actor_id = ANY($1)', [MINE])
  await query("INSERT INTO permissions (member_id, permission_level, card_name) VALUES ($1, 'administrator', 'x')", [ADM1])
  await query("INSERT INTO permissions (member_id, permission_level, card_name) VALUES ($1, 'super_admin', 'x')", [SUP])
})

test('only an administrator may change permissions (checked against the database)', async () => {
  const r = await svc.setPermission({ actor: sup, memberId: PLAIN, level: 'admin' })
  assert.deepEqual([r.ok, r.status, r.code], [false, 403, 'forbidden'])
  assert.equal(await level(PLAIN), null)
  const d = await svc.removePermission({ actor: sup, memberId: ADM1 })
  assert.equal(d.status, 403)
  const ok = await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'admin' })
  assert.equal(ok.ok, true); assert.equal(await level(PLAIN), 'admin')
})

test('the member must exist in rmis_members and hold an admin role (1-4)', async () => {
  assert.equal((await svc.setPermission({ actor: a1, memberId: 965999, level: 'admin' })).code, 'member_not_found')
  const r = await svc.setPermission({ actor: a1, memberId: ROLE5, level: 'admin' })
  assert.deepEqual([r.ok, r.status, r.code], [false, 422, 'not_admin_role'])
  assert.equal(await level(ROLE5), null)
  assert.equal((await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'root' })).code, 'invalid_level')
})

test('set is an upsert recording who granted it, audit-logged once; repeating it is a no-op', async () => {
  const r = await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'admin' })
  assert.equal(r.unchanged, false)
  assert.equal((await query('SELECT granted_by, card_name FROM permissions WHERE member_id = $1', [PLAIN])).rows[0].granted_by, ADM1)
  assert.equal((await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'admin' })).unchanged, true)
  assert.equal(await auditCount('permission.set'), 1)
  await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'super_admin' })
  assert.equal(await level(PLAIN), 'super_admin'); assert.equal(await auditCount('permission.set'), 2)
  const detail = (await query("SELECT detail FROM audit_log WHERE action = 'permission.set' AND entity_id = $1 ORDER BY id DESC LIMIT 1", [String(PLAIN)])).rows[0].detail
  assert.deepEqual(detail, { from: 'admin', to: 'super_admin' })
})

test('the last administrator can be neither demoted nor removed; with two, one can step down only via the other', async () => {
  // ADM1 is the only administrator: demoting/removing themselves is blocked (self rule), and so is the other path
  assert.equal((await svc.setPermission({ actor: a1, memberId: ADM1, level: 'admin' })).code, 'self_demotion')
  assert.equal((await svc.removePermission({ actor: a1, memberId: ADM1 })).code, 'self_removal')
  assert.equal(await level(ADM1), 'administrator')
  await svc.setPermission({ actor: a1, memberId: ADM2, level: 'administrator' })
  // ADM2 demotes ADM1: allowed now there are two
  assert.equal((await svc.setPermission({ actor: a2, memberId: ADM1, level: 'super_admin' })).ok, true)
  // ADM2 is now the last one: nobody else can touch them and they cannot demote or remove themselves
  assert.equal((await svc.setPermission({ actor: a2, memberId: ADM2, level: 'admin' })).code, 'self_demotion')
  assert.equal(await level(ADM2), 'administrator')
  assert.equal((await svc.removePermission({ actor: a2, memberId: ADM2 })).code, 'self_removal')
})

test('two administrators demoting each other at the same moment cannot leave zero administrators', async () => {
  await svc.setPermission({ actor: a1, memberId: ADM2, level: 'administrator' })
  const [x, y] = await Promise.all([
    svc.setPermission({ actor: a1, memberId: ADM2, level: 'admin' }),
    svc.setPermission({ actor: a2, memberId: ADM1, level: 'admin' }),
  ])
  const n = (await query("SELECT count(*)::int AS n FROM permissions WHERE permission_level = 'administrator' AND member_id = ANY($1)", [MINE])).rows[0].n
  assert.equal(n, 1)
  assert.equal([x, y].filter((r) => r.ok).length, 1)
  const failed = [x, y].find((r) => !r.ok)
  assert.ok(['forbidden', 'last_administrator'].includes(failed.code), failed.code) // loser is no longer an administrator, or would leave none
})

test('own level cannot go down, but may go up or stay the same; removal of others works and is audited', async () => {
  await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'super_admin' })
  assert.equal((await svc.removePermission({ actor: a1, memberId: PLAIN })).ok, true)
  assert.equal(await level(PLAIN), null)
  assert.equal(await auditCount('permission.remove'), 1)
  assert.equal((await svc.removePermission({ actor: a1, memberId: PLAIN })).code, 'permission_not_found')
  assert.equal((await svc.setPermission({ actor: a1, memberId: ADM1, level: 'administrator' })).unchanged, true)
})

test('list shows RMIS names and the strongest level first; search finds only admin-role members', async () => {
  await svc.setPermission({ actor: a1, memberId: PLAIN, level: 'admin' })
  const list = (await svc.listPermissions()).filter((p) => MINE.includes(p.member_id))
  assert.deepEqual(list.map((p) => p.member_id), [ADM1, SUP, PLAIN])
  assert.equal(list[0].card_name, 'Perm Admin One'); assert.equal(list[0].role_id, 1)
  const found = await svc.searchAdminMembers('Perm ')
  const ids = found.map((m) => m.member_id)
  assert.ok(ids.includes(PLAIN) && ids.includes(ADM2) && !ids.includes(ROLE5))
  assert.equal(found.find((m) => m.member_id === PLAIN).permission_level, 'admin')
  assert.deepEqual(await svc.searchAdminMembers('%'), []) // wildcard is escaped, not a match-all
})
