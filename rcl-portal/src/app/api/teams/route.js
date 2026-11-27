import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fail, fromResult, ok, optInt, parseQuery, readJson } from '@/server/http.mjs'
import { addTeamManual, createTeamsBulk, deleteTeam, listAllTeams, listTeamsForSport } from '@/server/teams/service.mjs'

// Teams are managed by admins only (the list includes players of every club).
const guard = () => requireUser({ admin: true })

export async function GET(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { sport_id: optInt, search: z.string().max(100).optional() })
  if (!q.ok) return q.response
  if (!q.data.sport_id) return Response.json({ teams: await listAllTeams() })
  const res = await listTeamsForSport({ sportId: q.data.sport_id, search: q.data.search ?? '' })
  return res.ok ? Response.json({ teams: res.teams, sport_name: res.sport_name, eligible_clubs: res.eligible_clubs }) : fail(res.status, res.code, res.message)
}

const postSchema = z.object({
  sport_id: z.coerce.number().int().positive().nullish(),
  manual_addition: z.boolean().optional(),
  club_id: z.coerce.number().int().positive().nullish(),
})

export async function POST(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, postSchema)
  if (!body.ok) return body.response
  const { sport_id, manual_addition, club_id } = body.data
  if (manual_addition) {
    if (!sport_id || !club_id) return fail(400, 'invalid_request', 'sport_id and club_id are required.')
    return fromResult(await addTeamManual({ actor: auth.user, sportId: sport_id, clubId: club_id }),
      (r) => Response.json({ success: true, message: 'Team created successfully', team: r.team }))
  }
  return fromResult(await createTeamsBulk({ actor: auth.user, sportId: sport_id ?? null }), (r) => Response.json({
    success: true, message: `Created ${r.created} teams, skipped ${r.skipped} existing teams`,
    total_created: r.created, total_skipped: r.skipped, results: r.results,
  }))
}

export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { team_id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  return fromResult(await deleteTeam({ actor: auth.user, teamId: q.data.team_id }), () => Response.json({ success: true, message: 'Team deleted successfully' }))
}
