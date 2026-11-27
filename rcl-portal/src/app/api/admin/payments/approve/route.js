import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, readJson } from '@/server/http.mjs'
import { decideSlip } from '@/server/payments/service.mjs'

// The deciding admin comes from the session (any approved_by in the body is ignored). A slip can be
// decided once; deciding it again returns 409.
export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ payment_id: z.coerce.number().int().positive() }).passthrough())
  if (!body.ok) return body.response
  return fromResult(await decideSlip({ actor: auth.user, id: body.data.payment_id, approve: true }), (r) => ok(r.slip, { message: 'Payment approved successfully', payment: r.slip }))
}
