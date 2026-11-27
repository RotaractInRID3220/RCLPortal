import { requireUser, resolveClubId } from '@/server/auth/guards'
import { fail, fromResult, ok, optInt, parseQuery } from '@/server/http.mjs'
import { createSlip, listClubSlips } from '@/server/payments/service.mjs'

// A club's own payment slips (admins may pass club_id).
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { club_id: optInt })
  if (!q.ok) return q.response
  const club = resolveClubId(auth.user, q.data.club_id)
  if (!club.ok) return club.response
  const payments = await listClubSlips(club.clubId)
  return ok(payments, { payments, count: payments.length }) // `payments` kept for the existing page code
}

// One request: multipart form with `file` (image), `value`, `slip_number`. The club is the session's club.
export async function POST(request) {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  let form
  try { form = await request.formData() } catch { return fail(400, 'invalid_request', 'Send the slip as a multipart form.') }
  const file = form.get('file')
  if (!file || typeof file === 'string') return fail(400, 'file_required', 'The slip image is required.')
  const club = resolveClubId(auth.user, form.get('club_id'))
  if (!club.ok) return club.response
  const buffer = Buffer.from(await file.arrayBuffer())
  const res = await createSlip({ actor: auth.user, clubId: club.clubId, value: form.get('value'), slipNumber: form.get('slip_number'), buffer })
  return fromResult(res, (r) => ok(r.slip, { message: 'Payment slip submitted', payment: r.slip }, 201))
}
