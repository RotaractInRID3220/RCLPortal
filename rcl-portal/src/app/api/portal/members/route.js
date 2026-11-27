import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, ok } from '@/server/http.mjs'
import { listEligibleMembers } from '@/server/rmis/mirror.mjs'

// Replaces /api/council: the club's registrable members, from the local RMIS mirror.
export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const club = resolveClubId(auth.user, new URL(request.url).searchParams.get('club_id'))
  if (!club.ok) return club.response
  const { cutoffSet, members, excluded } = await listEligibleMembers(club.clubId)
  return ok(members, { cutoffSet, count: members.length, clubId: club.clubId, excluded })
}
