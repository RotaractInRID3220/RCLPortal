import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { dayStats } from '@/server/checkin/service.mjs'

export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  return ok(await dayStats())
}
