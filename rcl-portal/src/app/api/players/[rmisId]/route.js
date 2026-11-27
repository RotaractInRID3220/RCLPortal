import { fail, ok } from '@/server/http.mjs'
import { getPlayerPublic } from '@/server/registration/service.mjs'

// PUBLIC (QR page). The path segment is the player's member_id. No NIC in the answer.
export async function GET(_request, { params }) {
  const { rmisId } = await params
  if (!/^\d{1,9}$/.test(rmisId)) return fail(400, 'invalid_request', 'Bad player id.')
  const player = await getPlayerPublic(Number(rmisId))
  if (!player) return fail(404, 'player_not_found', 'Player not found.')
  return Response.json({ success: true, data: player }, { headers: { 'Cache-Control': 'no-store' } })
}
