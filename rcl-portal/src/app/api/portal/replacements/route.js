import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { clubContext, createReplacementRequest } from '@/server/changes/service.mjs'
import { replacementsView } from '@/server/changes/shape.mjs'

// The club comes from the session. GET: the club's registrations, requests and the window state.
export async function GET(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const ctx = await clubContext({ clubId: club.clubId })
  return ok(replacementsView(ctx))
}

const schema = z.object({
  registration_id: z.coerce.number().int().positive(),
  replacement_member_id: z.coerce.number().int().positive(),
  reason: z.string().max(2000),
  supporting_link: z.string().max(1000).nullish(),
  ri_id: z.string().max(60).nullish(),
  club_id: z.coerce.number().int().positive().nullish(),
})

export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, schema)
  if (!body.ok) return body.response
  const club = resolveClubId(auth.user, body.data.club_id)
  if (!club.ok) return club.response
  const res = await createReplacementRequest({ actor: auth.user, clubId: club.clubId, registrationId: body.data.registration_id,
    replacementMemberId: body.data.replacement_member_id, reason: body.data.reason, link: body.data.supporting_link, riId: body.data.ri_id ?? null })
  return fromResult(res, (r) => ok(r.request, { message: 'Replacement request submitted successfully' }, 201))
}
