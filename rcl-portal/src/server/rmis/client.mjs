// RMIS 2.0 RCL API client (contract: RMIS-2 docs/RCL-API-USAGE.md). Server-side only: the key
// must never reach the browser. 5 s timeout, one retry on network errors and 5xx, structured
// errors. Passwords and the API key are never logged.
export class RmisError extends Error {
  constructor(status, code, message, { retryAfter = null } = {}) {
    super(message)
    this.name = 'RmisError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

const LOGIN_IP_PLACEHOLDER = '0.0.0.0'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function config() {
  const url = (process.env.RMIS_API_URL || '').replace(/\/+$/, '')
  const key = process.env.RMIS_API_KEY || ''
  if (!url || !key) throw new RmisError(500, 'rmis_not_configured', 'RMIS_API_URL / RMIS_API_KEY are not set.')
  return { url, key }
}

async function request(path, { method = 'GET', body, timeoutMs = 5000, retries = 1 } = {}) {
  const { url, key } = config()
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res
    try {
      res = await fetch(url + path, {
        method,
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch (err) {
      lastError = new RmisError(
        503, 'rmis_unreachable',
        err?.name === 'AbortError' ? `RMIS did not answer within ${timeoutMs} ms.` : 'RMIS could not be reached.'
      )
      if (attempt < retries) { await sleep(200 * (attempt + 1)); continue }
      throw lastError
    } finally {
      clearTimeout(timer)
    }

    let json = null
    try { json = await res.json() } catch { /* empty or non-JSON body */ }
    if (res.ok) return json

    const retryAfterHeader = Number(res.headers.get('retry-after'))
    lastError = new RmisError(
      res.status,
      json?.error?.code ?? 'rmis_error',
      json?.error?.message ?? `RMIS returned HTTP ${res.status}.`,
      { retryAfter: Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : null }
    )
    // 5xx (incl. service_busy 503) may be transient; 4xx never is, and 429 must not be hammered.
    if (res.status >= 500 && attempt < retries) { await sleep(200 * (attempt + 1)); continue }
    throw lastError
  }
  throw lastError
}

const qs = (params) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** RMIS says `university`; RCL's events use `institute`. */
export const mapCategory = (c) => (c === 'university' ? 'institute' : c)

export const rmis = {
  health: () => request('/health', { retries: 0, timeoutMs: 3000 }),

  /**
   * Credentials are checked by RMIS. RCL does not track end-user IPs. RMIS currently requires a
   * valid `client_ip` field (used only for its login throttle), so we send a fixed placeholder;
   * drop it once RMIS makes the field optional. Effect: throttling is effectively per username.
   */
  verifyLogin: ({ username, password }) =>
    request('/auth/verify', { method: 'POST', body: { username, password, client_ip: LOGIN_IP_PLACEHOLDER }, timeoutMs: 8000 }),

  async listClubs({ includeInactive = false } = {}) {
    const { clubs } = await request(`/clubs${qs({ includeInactive: includeInactive || undefined })}`)
    return clubs.map((c) => ({ ...c, category: mapCategory(c.category) }))
  },

  /** Whole roster of one club (follows next_cursor). */
  async listClubMembers(clubId, { statuses, createdOnOrBefore } = {}) {
    const all = []
    let cursor
    do {
      const page = await request(
        `/clubs/${encodeURIComponent(clubId)}/members${qs({
          statuses: statuses?.join(','), createdOnOrBefore, limit: 1000, cursor,
        })}`
      )
      all.push(...page.members)
      cursor = page.next_cursor
    } while (cursor)
    return all
  },

  /** One page of the change feed. Pass `updatedSince` first, then `cursor`. */
  async changes({ updatedSince, cursor, limit = 500 }) {
    const page = await request(`/members/changes${qs({ updatedSince: cursor ? undefined : updatedSince, cursor, limit })}`)
    return { members: page.members, nextCursor: page.next_cursor, serverTime: page.server_time }
  },

  /** Up to 500 ids per call; larger inputs are chunked. */
  async lookupMembers({ memberIds = [], membershipIds = [] }) {
    const results = []
    const chunks = []
    for (let i = 0; i < memberIds.length; i += 500) chunks.push({ member_ids: memberIds.slice(i, i + 500) })
    for (let i = 0; i < membershipIds.length; i += 500) chunks.push({ membership_ids: membershipIds.slice(i, i + 500) })
    for (const body of chunks) results.push(...(await request('/members/lookup', { method: 'POST', body })).results)
    return results
  },

  async getMember(memberId) {
    try {
      return await request(`/members/${encodeURIComponent(memberId)}`)
    } catch (e) {
      if (e instanceof RmisError && e.status === 404) return null
      throw e
    }
  },

  /** Admin-eligible members (RMIS role 1-4) by name, min 3 characters. */
  async searchAdmins(name) {
    return (await request(`/members/search${qs({ name })}`)).members
  },
}
