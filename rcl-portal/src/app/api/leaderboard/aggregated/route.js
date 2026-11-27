import { z } from 'zod'
import { fail, parseQuery } from '@/server/http.mjs'
import { getAggregated } from '@/server/leaderboard/service.mjs'
import { snapshotResponse } from '@/server/leaderboard/respond.mjs'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard/aggregated?category=&limit=&offset=   (PUBLIC)
 * Reads the latest versioned snapshot (rebuilt inline if it is stale). Sends ETag + `no-cache`, so
 * clients revalidate every poll and get a 304 while nothing changed. Ties share a rank.
 */
export async function GET(request) {
  const q = parseQuery(request, {
    category: z.string().max(20).optional(),
    limit: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(500).optional()),
    offset: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).default(0)),
  })
  if (!q.ok) return q.response
  try {
    const r = await getAggregated(q.data)
    if (!r.ok) return fail(r.status, r.code, r.message)
    return snapshotResponse(request, r)
  } catch (err) {
    console.error('[leaderboard] aggregated failed:', err.message)
    return fail(500, 'internal_error', 'Internal server error')
  }
}
