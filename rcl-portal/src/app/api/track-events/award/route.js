import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, readJson } from '@/server/http.mjs'
import { award } from '@/server/track/service.mjs'

// Super admin for the first award; administrator to re-award (checked in the service). Safe to repeat.
export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ sport_id: z.coerce.number().int().positive() }))
  if (!body.ok) return body.response
  const res = await award({ actor: auth.user, sportId: body.data.sport_id })
  if (!res.ok) return fail(res.status, res.code, res.message)
  return Response.json({ success: true, updated: res.updated, summary: res.summary, sport: res.sport }, { headers: { 'Cache-Control': 'no-store' } })
}
