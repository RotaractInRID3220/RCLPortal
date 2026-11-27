import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, parseQuery } from '@/server/http.mjs'
import { assignMissingBibs, bibStatus, listBibs } from '@/server/bibs/service.mjs'

// Bib numbers (track events, swimming, road race). GET: counts + list. POST: assign every missing number.
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, {
    filter: z.enum(['all', 'assigned', 'missing', 'unused']).optional(), search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
    all: z.enum(['0', '1']).optional(),
  })
  if (!q.ok) return q.response
  const [status, list] = await Promise.all([bibStatus(), listBibs({ filter: q.data.filter ?? 'all', search: q.data.search ?? '', page: q.data.page ?? 1, limit: q.data.limit ?? 25, all: q.data.all === '1' })])
  return ok(list.rows, { total: list.total, status })
}

// One click: numbers for everyone who needs one and has none. Existing numbers never change.
export async function POST() {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  return fromResult(await assignMissingBibs({ actor: auth.user }), (r) => ok({ assigned: r.assigned, first: r.first, last: r.last }, {
    message: r.assigned ? `Assigned ${r.assigned} bib numbers (${r.first} to ${r.last}).` : 'Everyone who needs a bib number already has one.',
  }))
}
