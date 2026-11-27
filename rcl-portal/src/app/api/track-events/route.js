import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, parseQuery, readJson } from '@/server/http.mjs'
import { getEntries, saveResults, sync } from '@/server/track/service.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const reply = (r, body) => (r.ok ? Response.json({ success: true, ...body }, { headers: NO_STORE }) : fail(r.status ?? 400, r.code, r.message))

// Any signed-in account may read results (portal scorecard); only admins get member ids and team players.
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sport_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  const res = await getEntries({ sportId: q.data.sport_id, admin: Boolean(auth.user.hasAdminAccess) })
  return reply(res, { data: res.data })
}

// Create missing entries from registrations/teams (admin). Safe to repeat.
export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ sport_id: z.coerce.number().int().positive().nullish() }))
  if (!body.ok) return body.response
  const res = await sync({ actor: auth.user, sportId: body.data.sport_id ?? null })
  return reply(res, { message: 'Track events synced', inserted: res?.inserted, deleted: res?.deleted, processed: res?.processed })
}

const resultSchema = z.object({
  sport_id: z.coerce.number().int().positive(),
  results: z.array(z.object({
    member_id: z.number().int().positive().nullish(),
    team_id: z.number().int().positive().nullish(),
    score: z.string().max(20).nullish(),
    place: z.number().int().min(1).max(10000).nullish(),
  })).min(1).max(2000),
})

// Record/replace results for one event (admin, audit-logged, transactional, idempotent).
export async function PUT(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, resultSchema)
  if (!body.ok) return body.response
  const res = await saveResults({ actor: auth.user, sportId: body.data.sport_id, results: body.data.results })
  return reply(res, { data: { saved: res?.saved, awarded: res?.awarded } })
}
