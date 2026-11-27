import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { applyMembershipRules, revokePenalties } from '@/server/penalties/service.mjs'
import { RmisError } from '@/server/rmis/client.mjs'

// Penalties change club points, so only super admins can apply or revoke them.
const guard = () => requireUser({ admin: true, permission: 'super_admin' })

// Applying is idempotent: it SETS each club's penalty to the current value (one row per club).
export async function POST(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ refresh: z.boolean().default(true), clean: z.boolean().default(true) }).passthrough())
  if (!body.ok) return body.response
  try {
    const res = await applyMembershipRules({ actor: auth.user, refresh: body.data.refresh, clean: body.data.clean })
    return fromResult(res, (r) => ok(r.results, {
      results: r.results, changed: r.changed, penalised: r.penalised, cleaned: r.cleaned, refreshed: r.refreshed,
      message: r.changed === 0 ? 'Penalties are already up to date. Nothing changed.' : `Updated penalties for ${r.changed} club(s); ${r.penalised} club(s) currently carry a penalty.`,
    }))
  } catch (e) {
    if (e instanceof RmisError) return fail(503, 'rmis_unavailable', 'RMIS could not be reached, so nothing was applied. Try again, or apply without refreshing from RMIS.')
    throw e
  }
}

// Remove penalties for one club (?club_id=) or for all clubs.
export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt })
  if (!q.ok) return q.response
  const r = await revokePenalties({ actor: auth.user, clubId: q.data.club_id ?? null })
  return ok({ removed: r.removed }, { message: `Removed ${r.removed} penalty row(s).` })
}
