import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { adminStats } from '@/server/dashboards/service.mjs'

// Club and player counts for the admin overview (one SQL statement).
export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const s = await adminStats()
  const res = ok({
    totalClubs: s.totalClubs, totalPlayers: s.totalPlayers,
    communityClubs: s.communityClubs, instituteClubs: s.instituteClubs, registeredClubs: s.registeredClubs,
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
