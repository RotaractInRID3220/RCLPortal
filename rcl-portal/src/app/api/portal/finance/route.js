import { requireUser, resolveClubId } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { clubFinance } from '@/server/payments/service.mjs'

// What the club owes and has paid (players x fee, approved slips). Computed in SQL on the server.
export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const club = resolveClubId(auth.user, new URL(request.url).searchParams.get('club_id'))
  if (!club.ok) return club.response
  return ok(await clubFinance(club.clubId))
}
