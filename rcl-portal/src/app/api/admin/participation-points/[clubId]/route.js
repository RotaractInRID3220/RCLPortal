import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, ok, parseQuery } from '@/server/http.mjs'
import { clubDetail } from '@/server/participation/service.mjs'

export async function GET(request, { params }) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const { clubId } = await params
  if (!/^\d{1,9}$/.test(clubId)) return fail(400, 'invalid_request', 'Bad club id.')
  const q = parseQuery(request, { sportDay: z.string().max(10).optional() })
  if (!q.ok) return q.response
  const res = await clubDetail({ clubId: Number(clubId), day: q.data.sportDay ?? null })
  return res.ok ? ok(res.data) : fail(res.status, res.code, res.message)
}
