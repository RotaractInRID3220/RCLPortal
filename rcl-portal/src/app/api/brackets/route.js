import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { generateBracket, getBracket, recordScore } from '@/server/tournaments/service.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

// PUBLIC (schedule + portal brackets), never cached: scores change during the event.
export async function GET(request) {
  const q = parseQuery(request, { sport_id: optInt, raw: z.enum(['1', 'true']).optional() })
  if (!q.ok) return q.response
  const res = await getBracket({ sportId: q.data.sport_id ?? null, raw: Boolean(q.data.raw) })
  return Response.json({ success: true, data: res.data, total_matches: res.total_matches, ...(res.matches ? { matches: res.matches } : {}) }, { headers: NO_STORE })
}

// Scores are integers; 0 is a real score. Strings of digits are accepted (form inputs), nothing else.
const score = z.preprocess((v) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v), z.number().int().min(0).max(100000))
const bool = z.boolean().optional()
const bodySchema = z.object({
  action: z.enum(['score', 'clear', 'generate']).optional(),
  match_id: z.coerce.number().int().positive().optional(),
  team1_score: score.optional(),
  team2_score: score.optional(),
  sport_id: z.coerce.number().int().positive().optional(),
  replace: bool,
  force: bool,
})

// Admin writes: enter / correct / clear a score (advances the winner) or build the bracket of an event.
export async function POST(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const body = await readJson(request, bodySchema)
  if (!body.ok) return body.response
  const b = body.data
  const action = b.action ?? (b.team1_score !== undefined || b.team2_score !== undefined ? 'score' : null)
  if (action === 'generate') {
    if (!b.sport_id) return fail(400, 'invalid_request', 'sport_id is required.')
    return fromResult(await generateBracket({ actor: auth.user, sportId: b.sport_id, replace: Boolean(b.replace), force: Boolean(b.force) }),
      (r) => Response.json({ success: true, message: `Bracket created: ${r.matches} matches for ${r.teams} teams.`, ...r }, { headers: NO_STORE }))
  }
  if (!b.match_id) return fail(400, 'invalid_request', 'match_id is required.')
  if (action === 'clear') {
    return fromResult(await recordScore({ actor: auth.user, matchId: b.match_id, clear: true }),
      (r) => Response.json({ success: true, data: r.match, advanced: r.advanced, changed: r.changed, message: 'Result cleared.' }, { headers: NO_STORE }))
  }
  if (b.team1_score === undefined || b.team2_score === undefined) return fail(400, 'invalid_request', 'team1_score and team2_score are required whole numbers (0 is allowed).')
  return fromResult(await recordScore({ actor: auth.user, matchId: b.match_id, team1Score: b.team1_score, team2Score: b.team2_score }),
    (r) => Response.json({ success: true, data: r.match, advanced: r.advanced, changed: r.changed, winner_team_id: r.winner_team_id, message: r.changed ? 'Match updated successfully' : 'Score unchanged' }, { headers: NO_STORE }))
}
