import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { hasPermission } from '@/server/auth/permissions.mjs'
import { fail, readJson } from '@/server/http.mjs'
import { awardPlacement } from '@/server/tournaments/service.mjs'

// Awards the placement points (1st/2nd/3rd) of one tournament. The standings are recomputed on the
// server from the match results: the client only says WHICH event. Safe to repeat (replaces, never
// duplicates). First award: super admin. Re-award: administrator (checked in the service).
export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ sport_id: z.coerce.number().int().positive() }).passthrough())
  if (!body.ok) return body.response
  const res = await awardPlacement({ actor: auth.user, sportId: body.data.sport_id, hasPermission })
  if (!res.ok) return fail(res.status, res.code, res.message)
  const msg = res.incomplete_podium ? `Awarded points to ${res.updated} club(s). Third place is not decided yet: award again when it is.` : `Successfully awarded points to ${res.updated} club(s)`
  return Response.json({ success: true, message: msg, updated: res.updated, removed: res.removed, replaced: res.replaced, awards: res.awards }, { headers: { 'Cache-Control': 'no-store' } })
}
