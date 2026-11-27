import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, readJson } from '@/server/http.mjs'
import { decideReplacement } from '@/server/changes/service.mjs'

// The deciding admin comes from the session (any approved_by/rejected_by in the body is ignored).
// A request is decided once; approving re-checks everything against the current data.
export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ request_id: z.coerce.number().int().positive() }).passthrough())
  if (!body.ok) return body.response
  return fromResult(await decideReplacement({ actor: auth.user, id: body.data.request_id, approve: true }), () => ok({ id: body.data.request_id }, { message: 'Replacement approved' }))
}
