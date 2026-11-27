import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { createMatch, deleteMatch, listGames, updateMatch } from '@/server/tournaments/service.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const guard = () => requireUser({ admin: true })

// '' / null mean "not set yet" (TBD team, no parent, no start time); undefined means "leave unchanged".
const nullable = (inner) => z.preprocess((v) => (v === '' ? null : v), inner.nullable())
const id = nullable(z.coerce.number().int().positive())
const fields = {
  match_name: nullable(z.string().max(100)).optional(),
  start_time: nullable(z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date')).optional(),
  team1_id: id.optional(), team2_id: id.optional(),
  round_id: z.coerce.number().int().min(0).max(5).optional(),
  match_order: nullable(z.coerce.number().int().min(1).max(500)).optional(),
  parent_match1_id: id.optional(), parent_match2_id: id.optional(),
}

export async function GET(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sport_id: optInt, limit: z.coerce.number().int().min(1).max(200).default(20), offset: z.coerce.number().int().min(0).default(0) })
  if (!q.ok) return q.response
  const { sport_id, limit, offset } = q.data
  const r = await listGames({ sportId: sport_id ?? null, limit, offset })
  return Response.json({ matches: r.matches, filtered_by_sport: sport_id ?? null, totalCount: r.total, limit, offset, totalPages: Math.ceil(r.total / limit) }, { headers: NO_STORE })
}

// Scores are NOT accepted here: they go through POST /api/brackets so the winner is advanced.
export async function POST(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ ...fields, sport_id: z.coerce.number().int().positive(), round_id: z.coerce.number().int().min(0).max(5) }))
  if (!body.ok) return body.response
  return fromResult(await createMatch({ actor: auth.user, input: body.data }), (r) => Response.json({ match: r.match }, { headers: NO_STORE }))
}

export async function PUT(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ ...fields, match_id: z.coerce.number().int().positive() }))
  if (!body.ok) return body.response
  const { match_id, ...input } = body.data
  return fromResult(await updateMatch({ actor: auth.user, matchId: match_id, input }), (r) => Response.json({ match: r.match }, { headers: NO_STORE }))
}

export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { match_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  return fromResult(await deleteMatch({ actor: auth.user, matchId: q.data.match_id }), () => Response.json({ success: true }, { headers: NO_STORE }))
}
