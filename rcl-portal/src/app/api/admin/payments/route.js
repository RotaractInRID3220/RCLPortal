import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery } from '@/server/http.mjs'
import { listSlipsAdmin } from '@/server/payments/service.mjs'

// Payments are handled by super admins. Server-side paging and search (club name or slip number).
export async function GET(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { tab: z.enum(['pending', 'approved', 'rejected']).default('pending'), page: z.string().optional(), limit: z.string().optional(), search: z.string().max(100).optional() })
  if (!q.ok) return q.response
  const res = await listSlipsAdmin({ tab: q.data.tab, page: q.data.page, limit: q.data.limit, search: q.data.search ?? '' })
  return ok(res.payments, res)
}
