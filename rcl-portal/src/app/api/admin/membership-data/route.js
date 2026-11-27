import { requireUser } from '@/server/auth/guards'
import { fail, ok } from '@/server/http.mjs'
import { previewMembership } from '@/server/penalties/service.mjs'

// Per-club general/prospective counts with the penalty the current rules give, and the penalty stored.
export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const res = await previewMembership()
  return res.ok ? ok(res.clubs, { rules: res.rules }) : fail(res.status, res.code, res.message)
}
