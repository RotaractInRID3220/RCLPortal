import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery } from '@/server/http.mjs'
import { adminOverview } from '@/server/dashboards/service.mjs'

// Everything the admin dashboard shows in one call: counts, leaderboard, pending requests,
// payment status, check-in per day and the membership-share check.
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, {
    leaderboard_category: z.enum(['community', 'institute']).optional(),
    leaderboard_limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  if (!q.ok) return q.response
  const data = await adminOverview({ category: q.data.leaderboard_category ?? 'community', limit: q.data.leaderboard_limit ?? 10 })
  const res = ok(data)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
