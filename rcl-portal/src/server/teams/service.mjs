// Teams = a club's entry in a sport. A club is eligible when it is in the sport's category and has
// at least `min_count` registrations (main + reserve) in that sport. All counting happens in SQL.
// UNIQUE (club_id, sport_id) means two admins creating teams at once can never duplicate a team.
import { query, tx } from '../db.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const minOf = (event) => Math.max(event.min_count ?? 1, 1)
const audit = (c, actor, action, id, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)', [actor.member_id, action, 'team', String(id), JSON.stringify(detail)])

async function getEvent(sportId, db = { query }) {
  const { rows: [e] } = await db.query('SELECT sport_id, sport_name, category, min_count FROM events WHERE sport_id = $1', [sportId])
  return e ?? null
}

/** Every active club of the sport's category with its registration count and whether it has a team. */
async function clubCounts(event, db = { query }) {
  const { rows } = await db.query(
    `SELECT c.club_id, c.club_name, c.category, count(r.id)::int AS registration_count, bool_or(t.team_id IS NOT NULL) AS has_team
     FROM clubs c
     LEFT JOIN registrations r ON r.club_id = c.club_id AND r.sport_id = $1
     LEFT JOIN teams t ON t.club_id = c.club_id AND t.sport_id = $1
     WHERE c.category = $2 AND c.status = 1 GROUP BY c.club_id, c.club_name, c.category`, [event.sport_id, event.category])
  return rows.map((r) => ({ ...r, has_team: Boolean(r.has_team) }))
}

export async function listTeamsForSport({ sportId, search = '' }) {
  const event = await getEvent(sportId)
  if (!event) return fail(404, 'sport_not_found', 'Sport not found.')
  const like = search ? `%${String(search).replace(/[\\%_]/g, '\\$&')}%` : null
  const { rows: teams } = await query(
    `SELECT t.team_id, t.club_id, t.sport_id, t.seed_number, t.created_at,
            json_build_object('club_id', c.club_id, 'club_name', c.club_name, 'category', c.category) AS clubs,
            count(r.id)::int AS player_count,
            coalesce(json_agg(json_build_object('member_id', r.member_id, 'main_player', r.main_player,
                     'players', json_build_object('name', p.name, 'member_id', p.member_id, 'membership_id', p.membership_id))
                     ORDER BY r.main_player DESC, p.name) FILTER (WHERE r.id IS NOT NULL), '[]') AS registrations
     FROM teams t JOIN clubs c USING (club_id)
     LEFT JOIN registrations r ON r.club_id = t.club_id AND r.sport_id = t.sport_id
     LEFT JOIN players p ON p.member_id = r.member_id
     WHERE t.sport_id = $1 AND ($2::text IS NULL OR c.club_name ILIKE $2)
     GROUP BY t.team_id, c.club_id ORDER BY player_count DESC, c.club_name`, [sportId, like])
  const counts = await clubCounts(event)
  const eligible = counts.filter((c) => !c.has_team && c.registration_count >= minOf(event))
    .map((c) => ({ club_id: c.club_id, club_name: c.club_name, count: c.registration_count }))
  return { ok: true, teams, sport_name: event.sport_name, eligible_clubs: eligible }
}

export async function listAllTeams() {
  const { rows } = await query(
    `SELECT t.team_id, t.club_id, t.sport_id, t.seed_number, t.created_at, json_build_object('club_id', c.club_id, 'club_name', c.club_name) AS clubs
     FROM teams t JOIN clubs c USING (club_id) ORDER BY t.sport_id, c.club_name`)
  return rows
}

export async function availableClubs(sportId) {
  const event = await getEvent(sportId)
  if (!event) return fail(404, 'sport_not_found', 'Sport not found.')
  const rows = (await clubCounts(event)).sort((a, b) =>
    (a.has_team - b.has_team) || (b.registration_count - a.registration_count) || a.club_name.localeCompare(b.club_name))
  return { ok: true, available_clubs: rows, sport_name: event.sport_name }
}

export async function nonEligibleClubs(sportId) {
  const event = await getEvent(sportId)
  if (!event) return fail(404, 'sport_not_found', 'Sport not found.')
  const rows = (await clubCounts(event)).filter((c) => !c.has_team && c.registration_count > 0 && c.registration_count < minOf(event))
    .sort((a, b) => b.registration_count - a.registration_count)
  return { ok: true, non_eligible_clubs: rows, min_count: event.min_count, sport_name: event.sport_name }
}

/** Create teams for every eligible club, for one sport or for every team/trackTeam/individual sport. */
export async function createTeamsBulk({ actor, sportId = null }) {
  return tx(async (c) => {
    const { rows: sports } = sportId
      ? await c.query('SELECT sport_id, sport_name, category, min_count FROM events WHERE sport_id = $1', [sportId])
      : await c.query("SELECT sport_id, sport_name, category, min_count FROM events WHERE sport_type IN ('team', 'trackTeam', 'individual') ORDER BY sport_id")
    if (sportId && !sports.length) return fail(404, 'sport_not_found', 'Sport not found.')
    const results = []
    let created = 0, skipped = 0
    for (const sport of sports) {
      const { rows: eligible } = await c.query(
        `SELECT c.club_id FROM clubs c WHERE c.category = $2 AND c.status = 1
         AND (SELECT count(*) FROM registrations r WHERE r.club_id = c.club_id AND r.sport_id = $1) >= $3`, [sport.sport_id, sport.category, minOf(sport)])
      const { rows: made } = await c.query(
        `INSERT INTO teams (club_id, sport_id) SELECT club_id, $1 FROM unnest($2::int[]) AS club_id
         ON CONFLICT (club_id, sport_id) DO NOTHING RETURNING team_id, club_id`, [sport.sport_id, eligible.map((e) => e.club_id)])
      const skip = eligible.length - made.length
      created += made.length; skipped += skip
      results.push({ sport_id: sport.sport_id, sport_name: sport.sport_name, created: made.length, skipped: skip,
        ...(eligible.length === 0 ? { message: 'No eligible clubs found' } : made.length === 0 ? { message: 'No eligible clubs found or all teams already exist' } : {}) })
    }
    await audit(c, actor, 'team.create_bulk', sportId ?? 'all', { created, skipped, sports: sports.length })
    return { ok: true, created, skipped, results }
  })
}

/** Admin override: add a club to a sport even below the minimum (category must still match). */
export async function addTeamManual({ actor, sportId, clubId }) {
  return tx(async (c) => {
    const event = await getEvent(sportId, c)
    if (!event) return fail(404, 'sport_not_found', 'Sport not found.')
    const { rows: [club] } = await c.query('SELECT club_id, category FROM clubs WHERE club_id = $1 AND status = 1', [clubId])
    if (!club) return fail(404, 'club_not_found', 'Club not found.')
    if (club.category !== event.category) return fail(422, 'category_mismatch', `This sport is for ${event.category} clubs.`)
    const { rows: [team] } = await c.query(
      'INSERT INTO teams (club_id, sport_id) VALUES ($1, $2) ON CONFLICT (club_id, sport_id) DO NOTHING RETURNING team_id, club_id, sport_id', [clubId, sportId])
    if (!team) return fail(409, 'team_exists', 'This club already has a team in this sport.')
    await audit(c, actor, 'team.create_manual', team.team_id, { club_id: clubId, sport_id: sportId })
    return { ok: true, team }
  })
}

export async function deleteTeam({ actor, teamId }) {
  try {
    return await tx(async (c) => {
      const { rows: [t] } = await c.query('SELECT team_id, club_id, sport_id FROM teams WHERE team_id = $1 FOR UPDATE', [teamId])
      if (!t) return fail(404, 'team_not_found', 'Team not found.')
      await c.query('DELETE FROM teams WHERE team_id = $1', [teamId])
      await audit(c, actor, 'team.delete', teamId, { club_id: t.club_id, sport_id: t.sport_id })
      return { ok: true }
    })
  } catch (e) {
    if (e.code === '23503') return fail(409, 'team_in_use', 'This team already has matches or track results and cannot be deleted.')
    throw e
  }
}
