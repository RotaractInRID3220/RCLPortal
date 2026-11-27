import { requireUser } from '@/server/auth/guards'
import { fail } from '@/server/http.mjs'
import { parseQuery } from '@/server/http.mjs'
import { z } from 'zod'
import { availableClubs } from '@/server/teams/service.mjs'

export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sport_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  const res = await availableClubs(q.data.sport_id)
  return res.ok ? Response.json({ success: true, available_clubs: res.available_clubs, sport_name: res.sport_name }) : fail(res.status, res.code, res.message)
}
