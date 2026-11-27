// RCL admin level (admin < super_admin < administrator), stored in our own `permissions` table
// keyed by RMIS member_id. Access itself comes from the RMIS role.
import { query } from '../db.mjs'

export const PERMISSION_RANK = { admin: 1, super_admin: 2, administrator: 3 }

export async function getPermissionLevel(memberId) {
  const { rows } = await query('SELECT permission_level FROM permissions WHERE member_id = $1', [memberId])
  return rows[0]?.permission_level ?? null
}

export function hasPermission(level, required) {
  const have = PERMISSION_RANK[level]
  const need = PERMISSION_RANK[required]
  return Boolean(have && need && have >= need)
}
