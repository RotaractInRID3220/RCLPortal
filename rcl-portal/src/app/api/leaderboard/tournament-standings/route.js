import { requireUser } from '@/server/auth/guards'
import { fail, parseQuery, intParam } from '@/server/http.mjs'
import { standings } from '@/server/tournaments/service.mjs'

// GET /api/leaderboard/tournament-standings?sportId={id}  (admin: used before awarding)
// Computed from the match results on every call (no-store).
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sportId: intParam })
  if (!q.ok) return q.response
  const res = await standings({ sportId: q.data.sportId })
  if (!res.ok) return fail(res.status, res.code, res.message)
  return Response.json({ success: true, standings: res.standings, complete: res.complete, already_awarded: res.already_awarded, points_configured: res.points_configured, sport_name: res.sport_name },
    { headers: { 'Cache-Control': 'no-store' } })
}
