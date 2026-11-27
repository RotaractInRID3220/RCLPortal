import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { convertPlayer, listPlayersByClub } from '@/server/registration/service.mjs'

// A club's players (own club; admins pass club_id).
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const players = await listPlayersByClub(club.clubId)
  return ok(players, { players, count: players.length }) // `players` kept for the existing page code
}

// Players are created by registering them (server-side, from RMIS data), never from a client-sent
// member object. Only the admin conversion (general -> prospective) is left here.
const putSchema = z.object({ member_id: z.coerce.number().int().positive() })

export async function PUT(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, putSchema)
  if (!body.ok) return body.response
  return fromResult(await convertPlayer({ actor: auth.user, memberId: body.data.member_id }), () => ok({ converted: true }))
}
