import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery, readJson } from '@/server/http.mjs'
import { exportPlayerNumbers, listPlayerNumbers } from '@/server/checkin/service.mjs'

export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, {
    sportDay: z.string().min(1).max(10), search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  if (!q.ok) return q.response
  const r = await listPlayerNumbers({ dayCode: q.data.sportDay, search: q.data.search ?? '', page: q.data.page ?? 1, limit: q.data.limit ?? 10 })
  const { data, ...rest } = r
  return ok(data, rest)
}

// Whole day for export (no paging).
export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ sportDay: z.string().min(1).max(10) }))
  if (!body.ok) return body.response
  const data = await exportPlayerNumbers({ dayCode: body.data.sportDay })
  return ok(data, { count: data.length })
}
