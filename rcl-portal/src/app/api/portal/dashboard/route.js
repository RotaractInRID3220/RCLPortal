import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, ok, parseQuery } from '@/server/http.mjs'
import { portalOverview } from '@/server/dashboards/service.mjs'

// Club stats plus the leaderboard preview. The club comes from the session.
export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, {
    club_id: z.string().optional(),
    leaderboard_category: z.enum(['community', 'institute']).optional(),
    leaderboard_limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  if (!club.clubId) return fail(400, 'invalid_request', 'No club on this account.')
  const data = await portalOverview({ clubId: club.clubId, category: q.data.leaderboard_category ?? null, limit: q.data.leaderboard_limit ?? 10 })
  if (!data) return fail(404, 'club_not_found', 'Club not found.')
  const res = ok(data)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
