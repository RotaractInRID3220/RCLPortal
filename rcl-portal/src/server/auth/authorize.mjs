// Login = RMIS verifies the credentials (we never see a hash). This module turns the RMIS answer
// into the session user, and maps RMIS errors to stable codes the login pages translate.
import { rmis as defaultRmis, RmisError } from '../rmis/client.mjs'
import { getPermissionLevel as defaultGetLevel } from './permissions.mjs'

/** RMIS roles: 1-6 may use the portal, 1-4 the admin side (owner decision, same as RMIS-1). */
export const PORTAL_ROLES = [1, 2, 3, 4, 5, 6]
export const ADMIN_ROLES = [1, 2, 3, 4]

export const accessFor = (roleId) => ({
  hasPortalAccess: PORTAL_ROLES.includes(roleId),
  hasAdminAccess: ADMIN_ROLES.includes(roleId),
})

/** Error whose `message` is the stable code shown to the login page. */
export class LoginError extends Error {
  constructor(code) { super(code); this.name = 'LoginError'; this.code = code }
}

const normalise = (v) => String(v ?? '').trim().toLowerCase()

export async function authorizeCredentials(credentials, deps = {}) {
  const rmis = deps.rmis ?? defaultRmis
  const getLevel = deps.getPermissionLevel ?? defaultGetLevel
  const username = normalise(credentials?.username ?? credentials?.email)
  const password = String(credentials?.password ?? '')
  if (!username || !password) throw new LoginError('invalid_credentials')

  let m
  try {
    m = await rmis.verifyLogin({ username, password })
  } catch (e) {
    if (!(e instanceof RmisError)) throw e
    if (e.status === 401 || e.status === 400) throw new LoginError('invalid_credentials')
    if (e.status === 403) throw new LoginError(e.code) // club_terminated, member_inactive, ...
    if (e.status === 429) throw new LoginError(`rate_limited:${e.retryAfter ?? 300}`)
    console.error('[auth] RMIS unavailable:', e.code, e.message) // never log credentials
    throw new LoginError('rmis_unavailable')
  }

  const access = accessFor(m.role_id)
  if (!access.hasPortalAccess && !access.hasAdminAccess) throw new LoginError('no_access')

  let permissionLevel = null
  try { permissionLevel = await getLevel(m.member_id) } catch (e) { console.error('[auth] permission lookup failed:', e.message) }

  return {
    id: String(m.member_id),
    name: m.card_name,
    member_id: m.member_id,
    membership_id: m.membership_id ?? null,
    username: m.username,
    card_name: m.card_name,
    full_name: m.full_name,
    club_id: m.club_id,
    club_name: m.club_name ?? null,
    role_id: m.role_id,
    status: m.status,
    ...access,
    permission_level: permissionLevel,
  }
}

/** The small, non-sensitive shape stored in the JWT/session (no NIC, no DOB, no hashes). */
export const SESSION_FIELDS = [
  'member_id', 'membership_id', 'username', 'card_name', 'full_name', 'club_id', 'club_name',
  'role_id', 'status', 'hasPortalAccess', 'hasAdminAccess', 'permission_level',
]
