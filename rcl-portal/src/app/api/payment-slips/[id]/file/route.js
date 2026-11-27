import { requireUser } from '@/server/auth/guards'
import { fail } from '@/server/http.mjs'
import { getSlipFile } from '@/server/payments/service.mjs'

// The slip image, only for the club that uploaded it and for admins. Never cached or public.
export async function GET(_request, { params }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!/^\d{1,12}$/.test(id)) return fail(400, 'invalid_request', 'Bad slip id.')
  const res = await getSlipFile({ user: auth.user, id: Number(id) })
  if (!res.ok) return fail(res.status, res.code, res.message)
  return new Response(res.body, { headers: {
    'Content-Type': res.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
  } })
}
