import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { ok, readJson } from '@/server/http.mjs'
import { cleanUnregisteredPlayers } from '@/server/registration/service.mjs'

// Delete players that have no registrations (one SQL statement, no row limits; the old version read
// players and registrations unpaginated and could delete registered players).
// Club users: their own club only. Admins: one club, or every club when no club_id is given.
export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ club_id: z.coerce.number().int().positive().nullish() }).passthrough())
  if (!body.ok) return body.response
  let clubId = null
  if (!(auth.user.hasAdminAccess && !body.data.club_id)) {
    const club = resolveClubId(auth.user, body.data.club_id)
    if (!club.ok) return club.response
    clubId = club.clubId
  }
  const removed = await cleanUnregisteredPlayers({ clubId })
  return ok({ removed: removed.length, players: removed }, { deletedCount: removed.length })
}
