import { fail } from '@/server/http.mjs'
import { getClubDetails } from '@/server/leaderboard/service.mjs'
import { snapshotResponse } from '@/server/leaderboard/respond.mjs'

export const dynamic = 'force-dynamic'

/** GET /api/leaderboard/club-details/[clubId]  (PUBLIC): points breakdown of one club from the snapshot. */
export async function GET(request, { params }) {
  const { clubId: raw } = await params
  const clubId = Number(raw)
  if (!Number.isInteger(clubId) || clubId <= 0) return fail(400, 'invalid_request', 'Club ID is required')
  try {
    const r = await getClubDetails(clubId)
    if (!r.ok) return fail(r.status, r.code, r.message)
    return snapshotResponse(request, r)
  } catch (err) {
    console.error('[leaderboard] club details failed:', err.message)
    return fail(500, 'internal_error', 'Internal server error')
  }
}
