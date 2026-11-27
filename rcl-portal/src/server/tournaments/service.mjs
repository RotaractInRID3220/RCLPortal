// Tournaments: knockout brackets, manual score entry, winner advancement, standings and placement points.
//
// Bracket model (kept from the old app so the pages and the public schedule keep working):
//   round_id 0..3 and 5 are knockout rounds counted back from the final (R32=0, R16=1, QF=2, SF=3, Final=5),
//   round_id 4 is the consolation (3rd place) match between the two semi-final LOSERS.
//   A match feeds the next one through parent_match1_id / parent_match2_id: the winner of parent N
//   goes to team N of the child (the loser, when the child is the consolation match).
//
// Safety rules:
//   * Everything that changes a bracket runs in ONE transaction under a per-event advisory lock, so two
//     admins (or a double click) can never advance a winner twice or interleave a correction.
//   * Scores are integers >= 0 (0 is a real score); NULL means "not played". A knockout match needs a winner,
//     so equal scores are refused.
//   * Re-entering the same score is a no-op. Correcting a score re-propagates to the next match, or is
//     refused (409 next_match_has_result) when that match already has a result that the change would invalidate.
//   * Placement points live in club_points (kind='placement') under the unique key (club, sport, kind):
//     re-awarding replaces the rows of that event, it never adds a second set.
import { query, tx } from '../db.mjs'
import { validateSetting } from '../settings/registry.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_BRACKET = 4_206_000
const LOCK_AWARD = 4_207_000
export const FINAL_ROUND = 5
export const CONSOLATION_ROUND = 4
export const SEMI_ROUND = 3
const ROUND_BY_DEPTH = [5, 3, 2, 1, 0] // depth 0 = final
const MAX_TEAMS = 32
export const ROUND_NAMES = { 0: '1st Round', 1: '2nd Round', 2: 'Quarter Finals', 3: 'Semi Finals', 4: 'Consolation Finals', 5: 'Finals' }

const audit = (c, actor, action, id, detail) =>
  c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actor.member_id, action, 'match', String(id), JSON.stringify(detail)])

const uniqueViolation = (e) => e?.code === '23505'

// ---------------------------------------------------------------------------------------------- read
const MATCH_SELECT = `
  SELECT m.match_id, m.sport_id, m.match_name, m.start_time, m.team1_id, m.team2_id, m.round_id, m.match_order,
         m.team1_score, m.team2_score, m.completed, m.parent_match1_id, m.parent_match2_id,
         t1.seed_number AS seed1, c1.club_id AS club1_id, c1.club_name AS club1_name,
         t2.seed_number AS seed2, c2.club_id AS club2_id, c2.club_name AS club2_name
  FROM matches m
  LEFT JOIN teams t1 ON t1.team_id = m.team1_id LEFT JOIN clubs c1 ON c1.club_id = t1.club_id
  LEFT JOIN teams t2 ON t2.team_id = m.team2_id LEFT JOIN clubs c2 ON c2.club_id = t2.club_id`

const winnerSide = (m) => (m.completed && m.team1_score !== m.team2_score ? (m.team1_score > m.team2_score ? 1 : 2) : null)

function toSeed(m) {
  const side = winnerSide(m)
  return {
    id: m.match_id, matchId: m.match_id, sport_id: m.sport_id,
    date: m.start_time ? new Date(m.start_time).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' }) : 'TBD',
    start_time: m.start_time ? new Date(m.start_time).toISOString() : null,
    teams: [
      { name: m.club1_name || 'TBD', id: m.team1_id, seed: m.seed1, club_id: m.club1_id },
      { name: m.club2_name || 'TBD', id: m.team2_id, seed: m.seed2, club_id: m.club2_id },
    ],
    score: [m.team1_score ?? 0, m.team2_score ?? 0],
    status: m.completed ? 'completed' : 'scheduled',
    completed: m.completed,
    winner_team_id: side === 1 ? m.team1_id : side === 2 ? m.team2_id : null,
    round_id: m.round_id, match_order: m.match_order,
    parent_match1_id: m.parent_match1_id, parent_match2_id: m.parent_match2_id,
  }
}

/** Group matches into react-brackets rounds (ascending round_id). */
export function toRounds(matches) {
  const byRound = new Map()
  for (const m of matches) {
    if (!byRound.has(m.round_id)) byRound.set(m.round_id, [])
    byRound.get(m.round_id).push(toSeed(m))
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, seeds]) => ({
    title: ROUND_NAMES[round] || `Round ${round}`,
    seeds: seeds.sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0) || a.id - b.id),
  }))
}

/** All matches of one event (or of every event when sportId is null). One query, no paging. */
export async function getBracket({ sportId = null, raw = false } = {}) {
  const { rows } = await query(`${MATCH_SELECT} WHERE ($1::int IS NULL OR m.sport_id = $1) ORDER BY m.round_id, m.match_order, m.match_id`, [sportId])
  const data = toRounds(rows)
  const out = { data, total_matches: rows.length }
  if (raw) {
    out.matches = rows.map((m) => ({
      match_id: m.match_id, sport_id: m.sport_id, team1_id: m.team1_id, team2_id: m.team2_id,
      team1_score: m.team1_score, team2_score: m.team2_score, completed: m.completed,
      round_id: m.round_id, match_order: m.match_order, parent_match1_id: m.parent_match1_id, parent_match2_id: m.parent_match2_id,
      start_time: m.start_time,
      team1: m.team1_id ? { team_id: m.team1_id, seed_number: m.seed1, club: { club_id: m.club1_id, club_name: m.club1_name } } : null,
      team2: m.team2_id ? { team_id: m.team2_id, seed_number: m.seed2, club: { club_id: m.club2_id, club_name: m.club2_name } } : null,
    }))
  }
  return { ok: true, ...out }
}

export async function listGames({ sportId = null, limit = 20, offset = 0 }) {
  const { rows } = await query(
    `SELECT m.*, count(*) OVER ()::int AS total FROM matches m WHERE ($1::int IS NULL OR m.sport_id = $1)
     ORDER BY m.start_time DESC NULLS LAST, m.match_id DESC LIMIT $2 OFFSET $3`, [sportId, limit, offset])
  const total = rows[0]?.total ?? 0
  return { ok: true, matches: rows.map(({ total: _t, ...m }) => m), total }
}

// ---------------------------------------------------------------------------------------------- locking helpers
async function lockMatchSport(c, matchId) {
  const { rows: [pre] } = await c.query('SELECT sport_id FROM matches WHERE match_id = $1', [matchId])
  if (!pre) return null
  await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BRACKET + pre.sport_id])
  const { rows: [m] } = await c.query('SELECT * FROM matches WHERE match_id = $1 FOR UPDATE', [matchId])
  return m ?? null // null when it was deleted while we waited for the lock
}

const childrenOf = async (c, matchId) =>
  (await c.query('SELECT * FROM matches WHERE parent_match1_id = $1 OR parent_match2_id = $1 ORDER BY match_id FOR UPDATE', [matchId])).rows

/** Which team a finished match sends into `child` (the loser for the consolation match). */
const sentTeam = (m, child, winnerId, loserId) => (child.round_id === CONSOLATION_ROUND ? loserId : winnerId)
const slotsFed = (child, matchId) => [1, 2].filter((k) => child[`parent_match${k}_id`] === matchId)

// ---------------------------------------------------------------------------------------------- score entry
/**
 * Save the score of one match and advance the winner. Idempotent; see the header for the correction rules.
 * `scores = null` clears the result (match goes back to "not played").
 */
export async function recordScore({ actor, matchId, team1Score, team2Score, clear = false }) {
  return tx(async (c) => {
    const m = await lockMatchSport(c, matchId)
    if (!m) return fail(404, 'match_not_found', 'Match not found.')
    if (!m.team1_id || !m.team2_id) return fail(409, 'teams_not_set', 'Both teams must be known before a score can be entered.')
    const children = await childrenOf(c, matchId)

    if (clear) {
      if (!m.completed) return { ok: true, changed: false, match: m, advanced: [] }
      const w = m.team1_score > m.team2_score ? [m.team1_id, m.team2_id] : [m.team2_id, m.team1_id]
      const advanced = []
      for (const child of children) {
        for (const k of slotsFed(child, matchId)) {
          const sent = sentTeam(m, child, w[0], w[1])
          if (child[`team${k}_id`] !== sent) continue // slot was edited by hand; leave it
          if (child.completed) return fail(409, 'next_match_has_result', `Match ${child.match_id} (the next round) already has a result. Clear that result first.`)
          await c.query(`UPDATE matches SET team${k}_id = NULL WHERE match_id = $1`, [child.match_id])
          advanced.push({ match_id: child.match_id, slot: k, team_id: null })
        }
      }
      const { rows: [row] } = await c.query('UPDATE matches SET team1_score = NULL, team2_score = NULL, completed = false WHERE match_id = $1 RETURNING *', [matchId])
      await audit(c, actor, 'match.score_clear', matchId, { sport_id: m.sport_id, was: [m.team1_score, m.team2_score] })
      return { ok: true, changed: true, match: row, advanced }
    }

    if (team1Score === team2Score) return fail(409, 'tie_not_allowed', 'A knockout match needs a winner: the two scores cannot be equal.')
    const [winnerId, loserId] = team1Score > team2Score ? [m.team1_id, m.team2_id] : [m.team2_id, m.team1_id]

    // plan the advancement first, so a refusal changes nothing
    const plan = []
    for (const child of children) {
      for (const k of slotsFed(child, matchId)) {
        const sent = sentTeam(m, child, winnerId, loserId)
        const current = child[`team${k}_id`]
        if (current === sent) continue
        if (child.completed) return fail(409, 'next_match_has_result', `Match ${child.match_id} (the next round) already has a result that depends on this one. Clear that result first, then correct this score.`)
        const other = child[`team${k === 1 ? 2 : 1}_id`]
        if (other === sent) return fail(409, 'invalid_bracket', `Match ${child.match_id} would have the same team on both sides. Check the bracket.`)
        plan.push({ child, k, team: sent })
      }
    }
    const same = m.completed && m.team1_score === team1Score && m.team2_score === team2Score
    const { rows: [row] } = same ? { rows: [m] }
      : await c.query('UPDATE matches SET team1_score = $2, team2_score = $3, completed = true WHERE match_id = $1 RETURNING *', [matchId, team1Score, team2Score])
    const advanced = []
    for (const { child, k, team } of plan) {
      await c.query(`UPDATE matches SET team${k}_id = $2 WHERE match_id = $1`, [child.match_id, team])
      advanced.push({ match_id: child.match_id, slot: k, team_id: team })
    }
    if (!same) await audit(c, actor, m.completed ? 'match.score_correct' : 'match.score', matchId, { sport_id: m.sport_id, was: m.completed ? [m.team1_score, m.team2_score] : null, now: [team1Score, team2Score], advanced })
    return { ok: true, changed: !same, match: row, advanced, winner_team_id: winnerId }
  })
}

// ---------------------------------------------------------------------------------------------- bracket generation
/** Standard seeding order for a bracket of `size` slots: [1, 8, 4, 5, 2, 7, 3, 6] for 8. */
export function seedOrder(size) {
  let arr = [1]
  while (arr.length < size) { const m = arr.length * 2; arr = arr.flatMap((s) => [s, m + 1 - s]) }
  return arr
}

/**
 * Build a single-elimination bracket from the teams of an event. Seeds first (seed_number, then team id);
 * top seeds get the byes when the team count is not a power of two. Byes create no match: the team is
 * placed straight into its round-2 slot. A consolation match is added whenever there are two semi-finals.
 */
export async function generateBracket({ actor, sportId, replace = false, force = false }) {
  return tx(async (c) => {
    const { rows: [ev] } = await c.query('SELECT sport_id, sport_name FROM events WHERE sport_id = $1', [sportId])
    if (!ev) return fail(404, 'sport_not_found', 'Event not found.')
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BRACKET + sportId])
    const { rows: teams } = await c.query('SELECT team_id, seed_number FROM teams WHERE sport_id = $1 ORDER BY seed_number NULLS LAST, team_id', [sportId])
    const n = teams.length
    if (n < 2) return fail(409, 'not_enough_teams', `An event needs at least 2 teams to build a bracket (it has ${n}). Create the teams first.`)
    if (n > MAX_TEAMS) return fail(409, 'too_many_teams', `Automatic brackets support up to ${MAX_TEAMS} teams (this event has ${n}). Add the matches by hand.`)
    const { rows: [ex] } = await c.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE completed)::int AS played FROM matches WHERE sport_id = $1', [sportId])
    if (ex.total > 0) {
      if (!replace) return fail(409, 'bracket_exists', `This event already has ${ex.total} match(es). Choose "replace" to rebuild it.`)
      if (ex.played > 0 && !force) return fail(409, 'bracket_has_results', `${ex.played} match(es) already have a result. Rebuilding deletes them; confirm to continue.`)
      await c.query('DELETE FROM matches WHERE sport_id = $1', [sportId])
    }

    let size = 2
    while (size < n) size *= 2
    const levels = Math.log2(size) // number of knockout rounds
    const order = seedOrder(size)
    const teamOf = (seed) => (seed <= n ? teams[seed - 1].team_id : null)
    const insert = async (round, ord, t1, t2, p1, p2) => (await c.query(
      `INSERT INTO matches (sport_id, round_id, match_order, team1_id, team2_id, parent_match1_id, parent_match2_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING match_id`, [sportId, round, ord, t1, t2, p1, p2])).rows[0].match_id

    // first round: a pair with a bye is just the team that advances
    let nodes = []
    for (let i = 0; i < order.length; i += 2) {
      const a = teamOf(order[i]), b = teamOf(order[i + 1])
      nodes.push(a && b ? { match: await insert(ROUND_BY_DEPTH[levels - 1], i / 2 + 1, a, b, null, null) } : { team: a ?? b })
    }
    let created = nodes.filter((x) => x.match).length
    let semis = levels === 1 ? [] : nodes
    for (let depth = levels - 2; depth >= 0; depth--) {
      const next = []
      for (let i = 0; i < nodes.length; i += 2) {
        const [l, r] = [nodes[i], nodes[i + 1]]
        const id = await insert(ROUND_BY_DEPTH[depth], i / 2 + 1, l.team ?? null, r.team ?? null, l.match ?? null, r.match ?? null)
        created++
        next.push({ match: id })
      }
      nodes = next
      if (depth === 1) semis = nodes
    }
    if (levels >= 2 && semis.length === 2 && semis.every((s) => s.match)) {
      await insert(CONSOLATION_ROUND, 1, null, null, semis[0].match, semis[1].match)
      created++
    }
    await audit(c, actor, 'bracket.generate', sportId, { teams: n, matches: created, replaced: ex.total, force })
    return { ok: true, matches: created, teams: n, replaced: ex.total }
  })
}

// ---------------------------------------------------------------------------------------------- manual match CRUD
async function checkTeams(c, sportId, ids) {
  const given = ids.filter((x) => x != null)
  if (given.length === 0) return true
  const { rows } = await c.query('SELECT team_id FROM teams WHERE sport_id = $1 AND team_id = ANY($2)', [sportId, given])
  return rows.length === new Set(given).size
}
async function checkParents(c, sportId, selfId, ids) {
  const given = ids.filter((x) => x != null)
  if (given.some((x) => x === selfId)) return false
  if (given.length === 0) return true
  const { rows } = await c.query('SELECT match_id FROM matches WHERE sport_id = $1 AND match_id = ANY($2)', [sportId, given])
  return rows.length === new Set(given).size
}

export async function createMatch({ actor, input }) {
  return tx(async (c) => {
    const { rows: [ev] } = await c.query('SELECT sport_id FROM events WHERE sport_id = $1', [input.sport_id])
    if (!ev) return fail(404, 'sport_not_found', 'Event not found.')
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_BRACKET + input.sport_id])
    if (!(await checkTeams(c, input.sport_id, [input.team1_id, input.team2_id]))) return fail(400, 'invalid_team', 'A selected team does not belong to this event.')
    if (!(await checkParents(c, input.sport_id, null, [input.parent_match1_id, input.parent_match2_id]))) return fail(400, 'invalid_parent', 'A parent match does not belong to this event.')
    try {
      const { rows: [row] } = await c.query(
        `INSERT INTO matches (sport_id, match_name, start_time, team1_id, team2_id, round_id, match_order, parent_match1_id, parent_match2_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [input.sport_id, input.match_name ?? null, input.start_time ?? null, input.team1_id ?? null, input.team2_id ?? null, input.round_id, input.match_order ?? null, input.parent_match1_id ?? null, input.parent_match2_id ?? null])
      await audit(c, actor, 'match.create', row.match_id, { sport_id: row.sport_id, round_id: row.round_id, match_order: row.match_order })
      return { ok: true, match: row }
    } catch (e) {
      if (uniqueViolation(e)) return fail(409, 'slot_taken', 'Another match already uses that round and position.')
      throw e
    }
  })
}

const EDITABLE = ['match_name', 'start_time', 'team1_id', 'team2_id', 'round_id', 'match_order', 'parent_match1_id', 'parent_match2_id']

export async function updateMatch({ actor, matchId, input }) {
  return tx(async (c) => {
    const m = await lockMatchSport(c, matchId)
    if (!m) return fail(404, 'match_not_found', 'Match not found.')
    const patch = Object.fromEntries(EDITABLE.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]))
    const teamsChanged = ['team1_id', 'team2_id'].some((k) => k in patch && patch[k] !== m[k])
    if (m.completed && teamsChanged) return fail(409, 'match_completed', 'This match already has a result. Clear the score before changing its teams.')
    if (!(await checkTeams(c, m.sport_id, [patch.team1_id ?? m.team1_id, patch.team2_id ?? m.team2_id]))) return fail(400, 'invalid_team', 'A selected team does not belong to this event.')
    if (!(await checkParents(c, m.sport_id, matchId, [patch.parent_match1_id, patch.parent_match2_id]))) return fail(400, 'invalid_parent', 'A parent match does not belong to this event.')
    const keys = Object.keys(patch)
    if (keys.length === 0) return { ok: true, match: m }
    try {
      const { rows: [row] } = await c.query(`UPDATE matches SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE match_id = $1 RETURNING *`, [matchId, ...keys.map((k) => patch[k])])
      await audit(c, actor, 'match.update', matchId, { sport_id: m.sport_id, patch })
      return { ok: true, match: row }
    } catch (e) {
      if (uniqueViolation(e)) return fail(409, 'slot_taken', 'Another match already uses that round and position.')
      if (e?.code === '23514') return fail(409, 'invalid_match', 'The two teams must be different.')
      throw e
    }
  })
}

export async function deleteMatch({ actor, matchId }) {
  return tx(async (c) => {
    const m = await lockMatchSport(c, matchId)
    if (!m) return fail(404, 'match_not_found', 'Match not found.')
    const children = await childrenOf(c, matchId)
    if (m.completed) {
      const w = m.team1_score > m.team2_score ? [m.team1_id, m.team2_id] : [m.team2_id, m.team1_id]
      for (const child of children) for (const k of slotsFed(child, matchId)) {
        if (child[`team${k}_id`] !== sentTeam(m, child, w[0], w[1])) continue
        if (child.completed) return fail(409, 'next_match_has_result', `Match ${child.match_id} (the next round) already has a result that depends on this one.`)
        await c.query(`UPDATE matches SET team${k}_id = NULL WHERE match_id = $1`, [child.match_id])
      }
    }
    await c.query('DELETE FROM matches WHERE match_id = $1', [matchId])
    await audit(c, actor, 'match.delete', matchId, { sport_id: m.sport_id, round_id: m.round_id, match_order: m.match_order, completed: m.completed })
    return { ok: true }
  })
}

// ---------------------------------------------------------------------------------------------- standings + placement points
async function loadPlacementPoints(db) {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'points.placement'")
  const v = validateSetting('points.placement', rows[0]?.value)
  return v.ok ? v.value : null
}

/**
 * Final positions of an event, computed from the matches (never from client data).
 * 1st/2nd: the final. 3rd/4th: the consolation match, else the semi-final losers (a single loser when the
 * other semi had a bye; two losers are ranked by their semi-final score, equal scores share 3rd).
 * Everyone else is ranked by points scored (provisional: true). Only decided places 1-3 carry placement points.
 */
export async function computeStandings(sportId, db = { query }) {
  const { rows } = await db.query(`${MATCH_SELECT} WHERE m.sport_id = $1`, [sportId])
  const podium = await loadPlacementPoints(db)
  const clubs = new Map()
  const club = (id, name) => { if (id && !clubs.has(id)) clubs.set(id, { club_id: id, club_name: name, total: 0 }); return clubs.get(id) }
  const decide = (m) => {
    if (!m.completed || !m.team1_id || !m.team2_id || m.team1_score === m.team2_score) return null
    const one = m.team1_score > m.team2_score
    const side = (k) => ({ club_id: m[`club${k}_id`], club_name: m[`club${k}_name`], score: m[`team${k}_score`] })
    return { winner: one ? side(1) : side(2), loser: one ? side(2) : side(1) }
  }
  for (const m of rows) {
    for (const k of [1, 2]) {
      const c = club(m[`club${k}_id`], m[`club${k}_name`])
      if (c && m.completed) c.total += m[`team${k}_score`] ?? 0
    }
  }
  const placed = []
  const put = (c, place, extra = {}) => placed.push({ club_id: c.club_id, club_name: c.club_name, place, ...extra })
  const final = decide(rows.find((m) => m.round_id === FINAL_ROUND) ?? {})
  if (final) { put(final.winner, 1); put(final.loser, 2) }
  const consolationRow = rows.find((m) => m.round_id === CONSOLATION_ROUND)
  const consolation = decide(consolationRow ?? {})
  const semis = rows.filter((m) => m.round_id === SEMI_ROUND)
  if (consolation) { put(consolation.winner, 3); put(consolation.loser, 4) }
  else if (!consolationRow && final && semis.length > 0 && semis.every((m) => decide(m))) {
    const losers = semis.map((m) => decide(m).loser)
    if (losers.length === 1) put(losers[0], 3)
    else if (losers.length === 2) {
      if (losers[0].score === losers[1].score) { put(losers[0], 3, { tie: true }); put(losers[1], 3, { tie: true }) }
      else { const [a, b] = losers.sort((x, y) => y.score - x.score); put(a, 3); put(b, 4) }
    }
  }
  const done = new Set(placed.map((p) => p.club_id))
  const rest = [...clubs.values()].filter((c) => !done.has(c.club_id)).sort((a, b) => b.total - a.total || a.club_name.localeCompare(b.club_name))
  rest.forEach((c, i) => put(c, i > 0 && rest[i - 1].total === c.total ? placed.find((p) => p.club_id === rest[i - 1].club_id).place : placed.length + 1, { provisional: true }))
  const standings = placed.map((p) => ({ ...p, points: !p.provisional && p.place <= 3 && podium ? podium[p.place - 1] : 0 }))
  return { standings, complete: Boolean(final), points_configured: Boolean(podium), podium }
}

export async function standings({ sportId }) {
  const { rows: [ev] } = await query('SELECT sport_id, sport_name FROM events WHERE sport_id = $1', [sportId])
  if (!ev) return fail(404, 'sport_not_found', 'Event not found.')
  const s = await computeStandings(sportId)
  const { rows: [{ n }] } = await query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1 AND kind = 'placement'", [sportId])
  return { ok: true, ...s, already_awarded: n > 0, sport_name: ev.sport_name }
}

/**
 * Write the placement points of one event. Standings are recomputed on the server. Repeatable: the
 * event's placement rows are replaced (clubs that no longer place are removed). The first award needs
 * super_admin, re-awarding (rows exist) needs administrator.
 */
export async function awardPlacement({ actor, sportId, hasPermission }) {
  return tx(async (c) => {
    const { rows: [ev] } = await c.query('SELECT sport_id, sport_name FROM events WHERE sport_id = $1', [sportId])
    if (!ev) return fail(404, 'sport_not_found', 'Event not found.')
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_AWARD + sportId])
    const { rows: [{ n: existing }] } = await c.query("SELECT count(*)::int AS n FROM club_points WHERE sport_id = $1 AND kind = 'placement'", [sportId])
    const needed = existing > 0 ? 'administrator' : 'super_admin'
    if (!hasPermission(actor.permission_level, needed)) return fail(403, 'forbidden', existing > 0 ? 'Re-awarding an event needs the administrator level.' : 'Awarding needs the super admin level.')
    const s = await computeStandings(sportId, c)
    if (!s.points_configured) return fail(503, 'placement_points_not_configured', 'The placement point setting is missing or invalid.')
    if (!s.complete) return fail(409, 'final_not_played', 'The final has no result yet, so there are no placements to award.')
    const podium = s.standings.filter((p) => p.place <= 3 && !p.provisional)
    const clubIds = podium.map((p) => p.club_id)
    const del = await c.query("DELETE FROM club_points WHERE sport_id = $1 AND kind = 'placement' AND NOT (club_id = ANY($2))", [sportId, clubIds])
    for (const p of podium) {
      await c.query(
        `INSERT INTO club_points (club_id, sport_id, kind, points, place, note, created_by) VALUES ($1, $2, 'placement', $3, $4, $5, $6)
         ON CONFLICT (club_id, sport_id, kind) WHERE kind IN ('placement', 'participation', 'track')
         DO UPDATE SET points = EXCLUDED.points, place = EXCLUDED.place, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now()`,
        [p.club_id, sportId, p.points, p.place, `Placement ${ev.sport_name}`, actor.member_id])
    }
    const summary = { updated: podium.length, removed: del.rowCount, replaced: existing > 0, incomplete_podium: podium.length < 3,
      awards: podium.map((p) => ({ club_id: p.club_id, place: p.place, points: p.points })) }
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'placement.award', 'club_points', String(sportId), JSON.stringify(summary)])
    return { ok: true, ...summary }
  })
}
