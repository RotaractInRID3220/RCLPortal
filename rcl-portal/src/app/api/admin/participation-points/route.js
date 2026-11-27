import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, ok, parseQuery } from '@/server/http.mjs'
import { overview } from '@/server/participation/service.mjs'

// Per-club attendance for one day (?sportDay=D-02; default = the current check-in day).
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sportDay: z.string().max(10).optional() })
  if (!q.ok) return q.response
  const res = await overview({ day: q.data.sportDay ?? null })
  return res.ok ? ok(res.data, { meta: res.meta }) : fail(res.status, res.code, res.message)
}
