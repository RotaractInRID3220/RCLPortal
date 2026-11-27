import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, parseQuery, readJson } from '@/server/http.mjs'
import { createEvent, listEvents } from '@/server/events/service.mjs'

// Public list (GET). Creating events is admin-only.
export async function GET(request) {
  const q = parseQuery(request, {
    sport_id: z.coerce.number().int().positive().optional(), category: z.enum(['community', 'institute']).optional(),
    day: z.string().max(10).optional(), type: z.string().max(80).optional(), gender: z.enum(['male', 'female', 'mixed']).optional(),
    limit: z.string().optional(), offset: z.string().optional(),
  })
  if (!q.ok) return q.response
  const { sport_id, category, day, type, gender, limit, offset } = q.data
  const res = await listEvents({ sportId: sport_id, category, day, types: type?.split(',').map((t) => t.trim()).filter(Boolean), gender, limit, offset })
  return ok(res.rows, { count: res.rows.length, totalCount: res.total, limit: res.limit, offset: res.offset, totalPages: Math.ceil(res.total / res.limit) })
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  day: z.string().trim().min(1).max(10),
  type: z.enum(['team', 'individual', 'trackIndividual', 'trackTeam']),
  gender: z.enum(['male', 'female', 'mixed']),
  category: z.enum(['community', 'institute']),
  minPlayers: z.coerce.number().int().min(0).max(200).nullish(),
  maxPlayers: z.coerce.number().int().min(0).max(200).nullish(),
  reservePlayers: z.coerce.number().int().min(0).max(200).nullish(),
  regClose: z.string().datetime({ offset: true }).nullish().or(z.literal('').transform(() => null)),
  limitGroup: z.enum(['standard', 'track', 'swimming']).optional(),
})

export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, createSchema)
  if (!body.ok) return body.response
  return fromResult(await createEvent(body.data), (r) => ok(r.event, { message: 'Event created successfully' }, 201))
}
