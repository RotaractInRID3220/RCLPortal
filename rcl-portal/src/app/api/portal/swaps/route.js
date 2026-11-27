import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { clubContext, createSwapRequest } from '@/server/changes/service.mjs'
import { swapsView } from '@/server/changes/shape.mjs'

export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const ctx = await clubContext({ clubId: club.clubId })
  return ok(swapsView(ctx))
}

// reg2_id set = swap two players; target_sport_id set = move one player.
const schema = z.object({
  reg1_id: z.coerce.number().int().positive(),
  reg2_id: z.coerce.number().int().positive().nullish(),
  target_sport_id: z.coerce.number().int().positive().nullish(),
  description: z.string().max(2000),
  club_id: z.coerce.number().int().positive().nullish(),
})

export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, schema)
  if (!body.ok) return body.response
  const club = resolveClubId(auth.user, body.data.club_id)
  if (!club.ok) return club.response
  const res = await createSwapRequest({ actor: auth.user, clubId: club.clubId, reg1Id: body.data.reg1_id, reg2Id: body.data.reg2_id ?? null,
    targetSportId: body.data.target_sport_id ?? null, description: body.data.description })
  return fromResult(res, (r) => ok(r.request, { message: 'Request submitted successfully' }, 201))
}
