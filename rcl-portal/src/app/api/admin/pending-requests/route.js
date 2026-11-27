import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { query } from '@/server/db.mjs'

// Real counts (this used to return a hard-coded 10).
export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const { rows: [r] } = await query(
    `SELECT (SELECT count(*)::int FROM replacement_requests WHERE status = 0) AS replacements,
            (SELECT count(*)::int FROM swap_requests WHERE status = 0) AS swaps`)
  const count = r.replacements + r.swaps
  return ok({ pendingCount: count, count, ...r })   // `pendingCount` is what the dashboard reads
}
