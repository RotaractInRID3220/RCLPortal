import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { financeStats } from '@/server/payments/service.mjs'

export async function GET() {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const s = await financeStats()
  return ok(s, s) // flat keys kept for the existing page
}
