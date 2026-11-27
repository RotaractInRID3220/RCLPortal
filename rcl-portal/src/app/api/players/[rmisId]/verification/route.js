import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, ok, parseQuery } from '@/server/http.mjs'
import { verifyPlayer } from '@/server/checkin/service.mjs'

// One call for the check-in screen: player, their sports on the day, and whether they are checked in.
// Contains the NIC, so admin only.
export async function GET(request, { params }) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const { rmisId } = await params
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(rmisId)) return fail(400, 'invalid_request', 'Invalid player id')
  const q = parseQuery(request, { sportDay: z.string().min(1).max(10) })
  if (!q.ok) return q.response
  const data = await verifyPlayer(rmisId, q.data.sportDay)
  return data ? ok(data) : fail(404, 'player_not_found', 'Player not found')
}
