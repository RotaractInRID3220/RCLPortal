import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { administrationOverview } from '@/server/dashboards/service.mjs'

// System statistics page: totals plus registrations per sport and per club, payments, check-in.
export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const res = ok(await administrationOverview())
  res.headers.set('Cache-Control', 'no-store')
  return res
}
