import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { clubsSummary } from '@/server/payments/service.mjs'

export async function GET() {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const s = await clubsSummary()
  return ok(s.clubs, s)
}
