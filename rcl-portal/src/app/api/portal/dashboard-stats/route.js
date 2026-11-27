import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, ok } from '@/server/http.mjs'
import { portalStats } from '@/server/dashboards/service.mjs'

// The signed-in user's club only: the club comes from the session (a different ?club_id is refused).
export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const club = resolveClubId(auth.user, new URL(request.url).searchParams.get('club_id'))
  if (!club.ok) return club.response
  if (!club.clubId) return fail(400, 'invalid_request', 'No club on this account.')
  const stats = await portalStats(club.clubId)
  if (!stats) return fail(404, 'club_not_found', 'Club not found.')
  const res = ok(stats)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
