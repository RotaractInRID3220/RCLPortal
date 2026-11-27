import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, optInt, parseQuery } from '@/server/http.mjs'
import { listRegistrationsAdmin } from '@/server/registration/service.mjs'

// Admin list: server-side paging + search (the old page pulled 5000 rows into the browser).
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { page: z.string().optional(), limit: z.string().optional(), sport_id: optInt, club_id: optInt, search: z.string().max(100).optional() })
  if (!q.ok) return q.response
  const res = await listRegistrationsAdmin({ page: q.data.page, limit: q.data.limit, sportId: q.data.sport_id ?? null, clubId: q.data.club_id ?? null, search: q.data.search ?? '' })
  return ok(res.rows, { total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages })
}
