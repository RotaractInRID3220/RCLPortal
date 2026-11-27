import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, ok, parseQuery, readJson } from '@/server/http.mjs'
import { checkIn, getCheckin } from '@/server/checkin/service.mjs'

// Day check-in (admin side). The day is always the one set as "current" on the server; the
// sport_day a page sends is only checked against it, never trusted.
export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({
    RMIS_ID: z.coerce.number().int().positive().optional(), member_id: z.coerce.number().int().positive().optional(), sport_day: z.string().max(10).optional(),
  }))
  if (!body.ok) return body.response
  const memberId = body.data.member_id ?? body.data.RMIS_ID
  if (!memberId) return fail(400, 'invalid_request', 'member_id is required')
  const r = await checkIn({ actor: auth.user, memberId, dayCode: body.data.sport_day })
  if (!r.ok) return Response.json({ success: false, error: r.message, code: r.code, alreadyRegistered: r.code === 'already_checked_in', portalClosed: r.code === 'checkin_closed', data: r.registration ?? null }, { status: r.status })
  return ok(r.registration, { message: 'Player checked in' })
}

export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { rmisId: z.coerce.number().int().positive(), sportDay: z.string().min(1).max(10) })
  if (!q.ok) return q.response
  return ok(await getCheckin(q.data.rmisId, q.data.sportDay))
}
