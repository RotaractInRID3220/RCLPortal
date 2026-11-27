import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, parseQuery } from '@/server/http.mjs'
import { nonEligibleClubs } from '@/server/teams/service.mjs'

export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sport_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  const res = await nonEligibleClubs(q.data.sport_id)
  return res.ok ? Response.json({ success: true, non_eligible_clubs: res.non_eligible_clubs, min_count: res.min_count, sport_name: res.sport_name }) : fail(res.status, res.code, res.message)
}
