import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, parseQuery, readJson } from '@/server/http.mjs'
import { adminReplace, adminSwapOrMove, clubContext } from '@/server/changes/service.mjs'
import { swapsView } from '@/server/changes/shape.mjs'

// Direct changes by an administrator: no club request, no window. Each is validated with the same
// rules as a request and recorded as an approved request.
const guard = () => requireUser({ admin: true, permission: 'administrator' })

export async function GET(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  const ctx = await clubContext({ clubId: q.data.club_id })
  const view = swapsView(ctx)
  return ok({ sports: view.sports, sportRegistrations: view.sportRegistrations, pending: { replacements: ctx.replacements.filter((r) => r.status === 0).length, swaps: ctx.swaps.filter((r) => r.status === 0).length } })
}

const id = z.coerce.number().int().positive()
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('replacement'), registration_id: id, replacement_member_id: id, ri_id: z.string().max(60).nullish(), reason: z.string().max(2000) }).passthrough(),
  z.object({ action: z.literal('swap'), club_id: id, reg1_id: id, reg2_id: id, reason: z.string().max(2000) }).passthrough(),
  z.object({ action: z.literal('move'), club_id: id, reg1_id: id, target_sport_id: id, reason: z.string().max(2000) }).passthrough(),
])

export async function POST(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, schema)
  if (!body.ok) return body.response
  const d = body.data
  if (d.action === 'replacement') {
    return fromResult(await adminReplace({ actor: auth.user, registrationId: d.registration_id, replacementMemberId: d.replacement_member_id, reason: d.reason, riId: d.ri_id ?? null }),
      (r) => ok(r.request, { message: 'Player replaced successfully' }))
  }
  const res = await adminSwapOrMove({ actor: auth.user, clubId: d.club_id, reg1Id: d.reg1_id, reg2Id: d.action === 'swap' ? d.reg2_id : null, targetSportId: d.action === 'move' ? d.target_sport_id : null, reason: d.reason })
  return fromResult(res, (r) => ok(r.request, { message: d.action === 'swap' ? 'Players swapped successfully' : 'Player moved successfully' }))
}
