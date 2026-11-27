import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { addManualPoints, deleteManualPoints, listPoints, normaliseCategory } from '@/server/leaderboard/service.mjs'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }

/** GET /api/club-points?sport_id=&club_id=&category=&limit=&offset=  (PUBLIC, live rows, never cached). */
export async function GET(request) {
  const q = parseQuery(request, {
    sport_id: optInt, club_id: optInt, category: z.string().max(20).optional(), limit: optInt,
    offset: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).default(0)),
  })
  if (!q.ok) return q.response
  const category = normaliseCategory(q.data.category)
  if (category === undefined) return fail(400, 'invalid_request', 'category must be community or institute.')
  const r = await listPoints({ sportId: q.data.sport_id, clubId: q.data.club_id, category, limit: q.data.limit, offset: q.data.offset })
  return Response.json({
    success: true, data: r.data,
    pagination: q.data.limit ? { limit: r.limit, offset: r.offset, total: r.total, hasMore: r.offset + r.limit < r.total } : null,
  }, { headers: NO_STORE })
}

const manualBody = z.object({
  club_id: z.coerce.number().int().positive(),
  sport_id: z.coerce.number().int().positive().nullish(),
  points: z.coerce.number().int().min(-1000).max(1000).refine((n) => n !== 0, 'points must not be 0'),
  place: z.coerce.number().int().min(1).max(999).nullish(),
  note: z.string().trim().max(200).nullish(),
})

/** POST: admin manual points entry (kind='manual'). Actor = session. */
export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, manualBody)
  if (!body.ok) return body.response
  const d = body.data
  const r = await addManualPoints({ actor: auth.user, clubId: d.club_id, sportId: d.sport_id ?? null, points: d.points, place: d.place ?? null, note: d.note || null })
  return fromResult(r, (res) => ok(res.row, {}, 201))
}

/** DELETE ?point_id=: remove a MANUAL entry. */
export async function DELETE(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { point_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  return fromResult(await deleteManualPoints({ actor: auth.user, pointId: q.data.point_id }), () => ok(null, { message: 'Club point entry deleted successfully' }))
}
