import { requireUser } from '@/server/auth/guards'
import { fail, ok } from '@/server/http.mjs'
import { getReplacementAdmin } from '@/server/changes/service.mjs'
import { adminReplacementDetail } from '@/server/changes/shape.mjs'

export async function GET(_request, { params }) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!/^\d{1,12}$/.test(id)) return fail(400, 'invalid_request', 'Bad request id.')
  const row = await getReplacementAdmin(Number(id))
  return row ? ok(adminReplacementDetail(row), { request: adminReplacementDetail(row) }) : fail(404, 'request_not_found', 'Request not found.')
}
