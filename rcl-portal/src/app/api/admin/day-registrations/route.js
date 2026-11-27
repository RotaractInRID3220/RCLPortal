import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, optInt, parseQuery } from '@/server/http.mjs'
import { listDayCheckins } from '@/server/checkin/service.mjs'

// Checked-in players grouped by event. Filters: sportDay, sportId.
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sportDay: z.string().max(10).optional(), sportId: optInt })
  if (!q.ok) return q.response
  return ok(await listDayCheckins({ dayCode: q.data.sportDay || null, sportId: q.data.sportId ?? null }))
}
