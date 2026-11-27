import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, ok, optInt, parseQuery } from '@/server/http.mjs'
import { query } from '@/server/db.mjs'
import { syncClubs } from '@/server/rmis/mirror.mjs'
import { RmisError } from '@/server/rmis/client.mjs'

// Clubs come from RMIS (synced, not typed in). Signed-in users may list them.
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt, category: z.enum(['community', 'institute']).optional(), include_inactive: z.enum(['0', '1']).optional() })
  if (!q.ok) return q.response
  // inactive (closed) clubs are only listed for admins who ask for them
  const withInactive = q.data.include_inactive === '1' && auth.user.hasAdminAccess
  const { rows } = await query(
    `SELECT club_id, club_name, category, status, synced_at FROM clubs WHERE ($3::boolean OR status = 1) AND ($1::int IS NULL OR club_id = $1) AND ($2::text IS NULL OR category = $2) ORDER BY club_name`,
    [q.data.club_id ?? null, q.data.category ?? null, withInactive])
  return ok(rows, { clubs: rows, count: rows.length })
}

// Super admin: pull the club list from RMIS now (the worker also does it hourly).
export async function POST() {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  try { return ok(await syncClubs()) } catch (e) {
    if (e instanceof RmisError) return fail(503, 'rmis_unavailable', 'RMIS is not reachable right now.')
    throw e
  }
}
