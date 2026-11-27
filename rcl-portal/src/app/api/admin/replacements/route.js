import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery } from '@/server/http.mjs'
import { listReplacementsAdmin } from '@/server/changes/service.mjs'
import { adminReplacementItem } from '@/server/changes/shape.mjs'

export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { tab: z.enum(['pending', 'approved', 'rejected']).default('pending'), page: z.string().optional(), limit: z.string().optional(), search: z.string().max(100).optional() })
  if (!q.ok) return q.response
  const res = await listReplacementsAdmin({ tab: q.data.tab, page: q.data.page, limit: q.data.limit, search: q.data.search ?? '' })
  const requests = res.requests.map(adminReplacementItem)
  return ok(requests, { requests, totalCount: res.totalCount, totalPages: res.totalPages, currentPage: res.currentPage, counts: res.counts })
}
