import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, parseQuery } from '@/server/http.mjs'
import { lookupPlayer } from '@/server/checkin/service.mjs'

// Search a day's registrations by player number, member/membership id or NIC.
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, {
    query: z.string().min(1).max(60), sportDay: z.string().min(1).max(10),
    searchType: z.enum(['auto', 'playerNumber', 'rmisId', 'nic']).optional(),
  })
  if (!q.ok) return q.response
  return fromResult(await lookupPlayer({ queryText: q.data.query, searchType: q.data.searchType ?? 'auto', dayCode: q.data.sportDay }), (r) => ok(r.data))
}
