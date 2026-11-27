import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, readJson } from '@/server/http.mjs'
import { award } from '@/server/participation/service.mjs'

// Awarding changes club points, so super admins only. Safe to repeat: it only adds what is missing.
export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ sportDay: z.string().min(1).max(10) }))
  if (!body.ok) return body.response
  const res = await award({ actor: auth.user, day: body.data.sportDay })
  if (!res.ok) return fail(res.status, res.code, res.message)
  const s = res.summary
  return Response.json({ success: true, summary: s, message: s.sportsAwarded === 0 ? 'Nothing new to award: every eligible sport already has its participation points.'
    : `Participation points awarded to ${s.clubsAwarded} club(s) for ${s.sportsAwarded} sport(s).` })
}
