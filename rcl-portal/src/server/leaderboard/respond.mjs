// Revalidate-every-time responses for snapshot endpoints: `no-cache` (never max-age) + a strong ETag
// = snapshot version, so an unchanged leaderboard costs a 304 and a changed one is seen at once.
import { etagMatches } from './snapshots.mjs'

export function snapshotResponse(request, result) {
  const headers = {
    'Cache-Control': 'no-cache',
    ETag: result.etag,
    'X-Snapshot-Version': String(result.version),
  }
  if (etagMatches(request, result.etag)) return new Response(null, { status: 304, headers })
  return Response.json(result.body, { headers })
}
