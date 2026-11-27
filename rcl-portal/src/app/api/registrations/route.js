import { z } from 'zod'
import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { listRegistrations, registerPlayer, unregisterPlayer } from '@/server/registration/service.mjs'

// Identity always comes from the session: portal users act for their own club only; a `club_id`
// sent by the browser is checked against it. Admins may pass a club_id.

export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt, sport_id: optInt, member_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const rows = await listRegistrations({ clubId: club.clubId, sportId: q.data.sport_id ?? null, memberId: q.data.member_id ?? null })
  return ok(rows, { count: rows.length })
}

const postSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  sport_id: z.coerce.number().int().positive(),
  main_player: z.boolean().default(true),
  ri_id: z.string().trim().max(30).nullish(),
  club_id: z.coerce.number().int().positive().nullish(),
})

export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, postSchema)
  if (!body.ok) return body.response
  const club = resolveClubId(auth.user, body.data.club_id)
  if (!club.ok) return club.response
  const res = await registerPlayer({
    actor: auth.user, clubId: club.clubId, memberId: body.data.member_id, sportId: body.data.sport_id,
    mainPlayer: body.data.main_player, riId: body.data.ri_id ?? null,
  })
  return fromResult(res, (r) => ok(r.registration, { message: 'Player registered' }, 201))
}

export async function DELETE(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { member_id: z.coerce.number().int().positive(), sport_id: z.coerce.number().int().positive(), club_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const res = await unregisterPlayer({ actor: auth.user, clubId: club.clubId, memberId: q.data.member_id, sportId: q.data.sport_id })
  return fromResult(res, () => ok({ deleted: true }))
}
