// Handler-level checks (the middleware is only the coarse safety net). Identity ALWAYS comes from
// the session, never from the request body or query string.
//
//   const auth = await requireUser({ admin: true, permission: 'super_admin' })
//   if (!auth.ok) return auth.response
//   const { user } = auth
import { getServerSession } from 'next-auth'
import { authOptions } from './options.js'
import { hasPermission } from './permissions.mjs'

const fail = (status, code, message) => ({
  ok: false,
  response: Response.json({ error: { code, message } }, { status }),
})

export async function requireUser({ admin = false, portal = false, permission = null } = {}) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.member_id) return fail(401, 'unauthenticated', 'Please sign in.')
  if (!user.hasAdminAccess && !user.hasPortalAccess) return fail(403, 'forbidden', 'Your account has no access to RCL.')
  if (admin && !user.hasAdminAccess) return fail(403, 'forbidden', 'Admin access required.')
  if (portal && !user.hasPortalAccess) return fail(403, 'forbidden', 'Portal access required.')
  if (permission && !hasPermission(user.permission_level, permission)) {
    return fail(403, 'forbidden', `Requires the "${permission}" permission level.`)
  }
  return { ok: true, user }
}

/**
 * The club a request may act on. Portal users: always their own club (a `club_id` sent by the
 * client is ignored/rejected). Admins may act for any club by passing one explicitly.
 */
export function resolveClubId(user, requestedClubId) {
  if (user.hasAdminAccess && requestedClubId != null && requestedClubId !== '') {
    const id = Number(requestedClubId)
    return Number.isInteger(id) ? { ok: true, clubId: id } : { ok: false, response: Response.json({ error: { code: 'invalid_request', message: 'Bad club id.' } }, { status: 400 }) }
  }
  if (requestedClubId != null && requestedClubId !== '' && Number(requestedClubId) !== user.club_id) {
    return { ok: false, response: Response.json({ error: { code: 'forbidden', message: 'You can only act for your own club.' } }, { status: 403 }) }
  }
  return { ok: true, clubId: user.club_id }
}
