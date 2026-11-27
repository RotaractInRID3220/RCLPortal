// Who may call which API route. Pure function (no framework imports) so it runs in middleware and
// in unit tests. DEFAULT DENY: a route is private unless it is listed as public below, so a new
// route can never be open by accident. Finer rules (own club only, permission level) are enforced
// inside the handlers using guards.mjs; this layer is the safety net in front of them.

const json = (status, code, message) => ({ allow: false, status, code, message })

/** Public (no login) routes. Everything else needs a session. */
const PUBLIC = [
  { methods: ['GET'], test: /^\/api\/events$/ },
  { methods: ['GET'], test: /^\/api\/brackets$/ },
  { methods: ['GET'], test: /^\/api\/leaderboard\/aggregated$/ },
  { methods: ['GET'], test: /^\/api\/leaderboard\/club-details\/[^/]+$/ },
  { methods: ['GET'], test: /^\/api\/club-points$/ },
  { methods: ['GET'], test: /^\/api\/players\/search$/ },          // public QR page (reworked in WP7a)
  { methods: ['GET'], test: /^\/api\/players\/(?!clean$|sync-rmis$|search$)[^/]+$/ }, // public QR page (reworked in WP7a)
  { methods: ['GET'], test: /^\/api\/clubs\/[^/]+\/registered-events$/ }, // consumed by citation-checklist
  { methods: ['GET'], test: /^\/api\/public\// },                  // future snapshot endpoints
]

/** Admin side only (RMIS role 1-4). First match wins. `methods` omitted = every method. */
const ADMIN_ONLY = [
  { test: /^\/api\/admin\// },
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], test: /^\/api\/track-events(\/|$)/ },  // GET (results) is open to any signed-in account
  { test: /^\/api\/day-registrations/ },
  { test: /^\/api\/players\/[^/]+\/(verification|sports)$/ },   // contains NIC; check-in screens only
  { test: /^\/api\/config\// },                                 // check-in switch
  { test: /^\/api\/teams(\/|$)/ },                              // lists other clubs' players
  { test: /^\/api\/registrations\/with-players$/ },                // returns NIC/DOB of many players
  { test: /^\/api\/club-points\/award$/ },
  { test: /^\/api\/leaderboard\/tournament-standings$/ },
  { test: /^\/api\/games(\/|$)/ },                                // raw matches: admin tools only (public view is GET /api/brackets)
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], test: /^\/api\/(events|games|clubs|club-points|brackets|config\/portal-status)(\/|$)/ },
  { methods: ['PUT', 'PATCH', 'DELETE'], test: /^\/api\/players(\/|$)/ },
]

const PORTAL_ONLY = [{ test: /^\/api\/portal\// }]

const norm = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p)
const matches = (rule, method, path) => (!rule.methods || rule.methods.includes(method)) && rule.test.test(path)

/**
 * @param {{pathname: string, method: string, token?: null | {hasPortalAccess?: boolean, hasAdminAccess?: boolean}}} req
 * @returns {{allow: true} | {allow: false, status: 401|403, code: string, message: string}}
 */
export function decideAccess({ pathname, method, token }) {
  const path = norm(pathname)
  const verb = String(method || 'GET').toUpperCase()

  if (path.startsWith('/api/auth/')) return { allow: true } // NextAuth endpoints (login, session, csrf)
  if (verb === 'OPTIONS') return { allow: true }

  if (PUBLIC.some((r) => matches(r, verb, path))) return { allow: true }

  if (!token) return json(401, 'unauthenticated', 'Please sign in.')
  const admin = Boolean(token.hasAdminAccess)
  const portal = Boolean(token.hasPortalAccess)
  if (!admin && !portal) return json(403, 'forbidden', 'Your account has no access to RCL.')

  if (ADMIN_ONLY.some((r) => matches(r, verb, path)) && !admin) return json(403, 'forbidden', 'Admin access required.')
  if (PORTAL_ONLY.some((r) => matches(r, verb, path)) && !portal) return json(403, 'forbidden', 'Portal access required.')

  return { allow: true }
}

export const publicRules = PUBLIC
