import { z } from 'zod'
import { ok, parseQuery } from '@/server/http.mjs'
import { searchPlayersPublic } from '@/server/registration/service.mjs'

// PUBLIC (QR page). Find a registered player by name (>= 3 characters, partial), NIC (exact) or
// membership id (exact). Never returns the NIC; at most 20 results.
export async function GET(request) {
  const q = parseQuery(request, {
    name: z.string().max(100).optional(), nic: z.string().max(20).optional(),
    membershipId: z.string().max(20).optional(), rmisId: z.string().max(20).optional(), // rmisId: old parameter name
  })
  if (!q.ok) return q.response
  const res = await searchPlayersPublic({ name: q.data.name, nic: q.data.nic, membershipId: q.data.membershipId ?? q.data.rmisId })
  return Response.json({ success: true, data: { players: res.players, total: res.players.length, page: 1, limit: 20, totalPages: 1 }, reason: res.reason ?? undefined },
    { headers: { 'Cache-Control': 'no-store' } })
}
