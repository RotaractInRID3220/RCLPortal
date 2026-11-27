import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, ok, readJson } from '@/server/http.mjs'
import { refreshClub, syncChangesOnce } from '@/server/rmis/mirror.mjs'
import { RmisError } from '@/server/rmis/client.mjs'

// Re-read RMIS and update registered players. A club user refreshes their own club; an admin may
// give a club_id, or omit it to run a full pass of the change feed.
export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ club_id: z.coerce.number().int().positive().nullish() }).passthrough())
  if (!body.ok) return body.response
  try {
    if (auth.user.hasAdminAccess && !body.data.club_id) {
      const r = await syncChangesOnce()
      return ok({ mode: 'all', ...r }, { message: `Synced ${r.seen} members from RMIS${r.playersChanged ? `; ${r.playersChanged} registered players updated` : ''}.` })
    }
    const club = resolveClubId(auth.user, body.data.club_id)
    if (!club.ok) return club.response
    const r = await refreshClub(club.clubId)
    return ok({ mode: 'club', clubId: club.clubId, members: r.members, changes: r.changes }, { message: `Refreshed ${r.members} members from RMIS${r.changes?.length ? `; ${r.changes.length} registered players updated` : ''}.` })
  } catch (e) {
    if (e instanceof RmisError) return fail(503, 'rmis_unavailable', 'RMIS is not reachable right now. Try again shortly.')
    throw e
  }
}
