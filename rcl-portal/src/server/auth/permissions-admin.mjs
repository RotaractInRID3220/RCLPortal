// Managing the RCL admin levels (admin < super_admin < administrator) in the `permissions` table,
// keyed by RMIS member_id. Rules enforced here (not only in the UI):
//   * only an administrator may change anything (re-checked against the DB, not the session token);
//   * the target must exist in rmis_members and hold an admin access role (RMIS role 1-4);
//   * nobody can lower or remove their OWN level (stops an accidental lock-out);
//   * the last administrator can never be demoted or removed (count checked under a lock, so two
//     administrators cannot demote each other at the same moment);
//   * every change is audit-logged; repeating the same change is a no-op.
import { query, tx } from '../db.mjs'
import { ADMIN_ROLES } from './authorize.mjs'
import { PERMISSION_RANK } from './permissions.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_KEY = 4_206_001
export const LEVELS = Object.keys(PERMISSION_RANK)

const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export async function listPermissions() {
  const { rows } = await query(
    `SELECT p.member_id, p.permission_level, coalesce(m.card_name, p.card_name) AS card_name, m.full_name, m.membership_id,
            m.role_id, m.club_id, p.granted_by, p.created_at
     FROM permissions p LEFT JOIN rmis_members m USING (member_id)
     ORDER BY CASE p.permission_level WHEN 'administrator' THEN 0 WHEN 'super_admin' THEN 1 ELSE 2 END, coalesce(m.card_name, p.card_name), p.member_id`)
  return rows
}

/** RMIS members with an admin access role whose name matches, with their current RCL level. */
export async function searchAdminMembers(name) {
  const { rows } = await query(
    `SELECT m.member_id, m.card_name, m.full_name, m.membership_id, m.role_id, m.club_id, p.permission_level
     FROM rmis_members m LEFT JOIN permissions p USING (member_id)
     WHERE m.role_id = ANY($1::int[]) AND (m.card_name ILIKE $2 OR m.full_name ILIKE $2)
     ORDER BY m.card_name LIMIT 25`, [ADMIN_ROLES, `%${escapeLike(name)}%`])
  return rows
}

async function actorIsAdministrator(c, actor) {
  const { rows } = await c.query('SELECT permission_level FROM permissions WHERE member_id = $1', [actor.member_id])
  return rows[0]?.permission_level === 'administrator'
}

const audit = (c, actor, action, memberId, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actor.member_id, action, 'permissions', String(memberId), JSON.stringify(detail)])

export async function setPermission({ actor, memberId, level }) {
  if (!LEVELS.includes(level)) return fail(400, 'invalid_level', `Level must be one of: ${LEVELS.join(', ')}.`)
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    if (!(await actorIsAdministrator(c, actor))) return fail(403, 'forbidden', 'Only an administrator can change permissions.')

    const { rows: [member] } = await c.query('SELECT member_id, card_name, role_id FROM rmis_members WHERE member_id = $1', [memberId])
    if (!member) return fail(404, 'member_not_found', 'No RMIS member with that id.')
    if (!ADMIN_ROLES.includes(member.role_id)) return fail(422, 'not_admin_role', 'This member has no admin access role in RMIS.')

    const { rows: [current] } = await c.query('SELECT permission_level FROM permissions WHERE member_id = $1', [memberId])
    const from = current?.permission_level ?? null
    if (from === level) return { ok: true, unchanged: true, permission: { member_id: memberId, permission_level: level, card_name: member.card_name } }

    if (memberId === actor.member_id && from && PERMISSION_RANK[level] < PERMISSION_RANK[from]) {
      return fail(409, 'self_demotion', 'You cannot lower your own permission level. Ask another administrator.')
    }
    if (from === 'administrator') {
      const { rows: [n] } = await c.query("SELECT count(*)::int AS n FROM permissions WHERE permission_level = 'administrator'")
      if (n.n <= 1) return fail(409, 'last_administrator', 'The last administrator cannot be demoted.')
    }
    await c.query(
      `INSERT INTO permissions (member_id, permission_level, card_name, granted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id) DO UPDATE SET permission_level = EXCLUDED.permission_level, card_name = EXCLUDED.card_name, granted_by = EXCLUDED.granted_by`,
      [memberId, level, member.card_name, actor.member_id])
    await audit(c, actor, 'permission.set', memberId, { from, to: level })
    return { ok: true, unchanged: false, permission: { member_id: memberId, permission_level: level, card_name: member.card_name } }
  })
}

export async function removePermission({ actor, memberId }) {
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    if (!(await actorIsAdministrator(c, actor))) return fail(403, 'forbidden', 'Only an administrator can change permissions.')
    const { rows: [current] } = await c.query('SELECT permission_level FROM permissions WHERE member_id = $1', [memberId])
    if (!current) return fail(404, 'permission_not_found', 'This member has no permission level.')
    if (memberId === actor.member_id) return fail(409, 'self_removal', 'You cannot remove your own permission level. Ask another administrator.')
    if (current.permission_level === 'administrator') {
      const { rows: [n] } = await c.query("SELECT count(*)::int AS n FROM permissions WHERE permission_level = 'administrator'")
      if (n.n <= 1) return fail(409, 'last_administrator', 'The last administrator cannot be removed.')
    }
    await c.query('DELETE FROM permissions WHERE member_id = $1', [memberId])
    await audit(c, actor, 'permission.remove', memberId, { from: current.permission_level })
    return { ok: true }
  })
}
