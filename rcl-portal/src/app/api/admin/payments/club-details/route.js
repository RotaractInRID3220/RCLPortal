import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery } from '@/server/http.mjs'
import { clubFinance } from '@/server/payments/service.mjs'

export async function GET(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  const f = await clubFinance(q.data.club_id)
  return ok(f, f)
}
