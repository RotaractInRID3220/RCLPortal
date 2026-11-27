// Dashboard numbers. Every figure is a single-statement SQL aggregate: no per-club loops, no
// row-limit paging, nothing computed by downloading rows and counting them in JS.
// Existing domain functions are reused where one exists (payments, penalties, check-in).
import { query } from '../db.mjs'
import { validateSetting } from '../settings/registry.mjs'
import { financeStats, clubFinance } from '../payments/service.mjs'
import { dayStats } from '../checkin/service.mjs'
import { getPenaltyRules, previewMembership } from '../penalties/service.mjs'
import { penaltyFor, penaltyTarget, sharePercent } from '../penalties/rules.mjs'

const DEFAULT_ATTENDANCE_RATIO = 0.5

// ---------------------------------------------------------------- admin
const ADMIN_STATS_SQL = `
  SELECT
    (SELECT count(*) FROM clubs WHERE status = 1)::int                                         AS total_clubs,
    (SELECT count(*) FROM clubs WHERE status = 1 AND category = 'community')::int              AS community_clubs,
    (SELECT count(*) FROM clubs WHERE status = 1 AND category = 'institute')::int              AS institute_clubs,
    (SELECT count(*) FROM clubs c WHERE c.status = 1 AND c.category = 'community'
        AND EXISTS (SELECT 1 FROM players p WHERE p.club_id = c.club_id))::int                 AS registered_community,
    (SELECT count(*) FROM clubs c WHERE c.status = 1 AND c.category = 'institute'
        AND EXISTS (SELECT 1 FROM players p WHERE p.club_id = c.club_id))::int                 AS registered_institute,
    (SELECT count(*) FROM players)::int                                                        AS total_players,
    (SELECT count(*) FROM players WHERE gender = 'M')::int                                     AS male_players,
    (SELECT count(*) FROM players WHERE gender = 'F')::int                                     AS female_players,
    (SELECT count(*) FROM registrations)::int                                                  AS total_registrations,
    (SELECT count(*) FROM registrations r JOIN events e USING (sport_id)
       WHERE e.sport_type IN ('individual', 'trackIndividual'))::int                           AS individual_registrations,
    (SELECT count(*) FROM registrations r JOIN events e USING (sport_id)
       WHERE e.sport_type IN ('team', 'trackTeam'))::int                                       AS team_registrations,
    (SELECT count(*) FROM events)::int                                                         AS total_events,
    (SELECT count(*) FROM teams)::int                                                          AS total_teams,
    (SELECT count(*) FROM payment_slips WHERE approved = true)::int                            AS approved_payments,
    (SELECT count(*) FROM replacement_requests WHERE status = 0)::int                         AS pending_replacements,
    (SELECT count(*) FROM swap_requests WHERE status = 0)::int                                 AS pending_swaps`

export async function adminStats() {
  const { rows: [r] } = await query(ADMIN_STATS_SQL)
  return {
    totalClubs: r.total_clubs, totalPlayers: r.total_players,
    communityClubs: r.community_clubs, instituteClubs: r.institute_clubs,
    registeredClubs: {
      community: { registered: r.registered_community, total: r.community_clubs },
      institute: { registered: r.registered_institute, total: r.institute_clubs },
    },
    totalRegistrations: r.total_registrations, totalEvents: r.total_events,
    totalTeams: r.total_teams, totalPayments: r.approved_payments,
    playersByGender: { male: r.male_players, female: r.female_players },
    registrationsByCategory: { individual: r.individual_registrations, team: r.team_registrations },
    pendingRequests: r.pending_replacements + r.pending_swaps,
    pendingReplacements: r.pending_replacements, pendingSwaps: r.pending_swaps,
  }
}

const LEADERBOARD_SQL = `
  SELECT club_id, club_name, category, total_points, entries_count, rank FROM (
    SELECT c.club_id, c.club_name, c.category,
           coalesce(sum(cp.points), 0)::int AS total_points, count(cp.point_id)::int AS entries_count,
           rank() OVER (ORDER BY coalesce(sum(cp.points), 0) DESC)::int AS rank
    FROM clubs c LEFT JOIN club_points cp ON cp.club_id = c.club_id
    WHERE c.status = 1 AND ($1::text IS NULL OR c.category = $1)
    GROUP BY c.club_id, c.club_name, c.category) t
  ORDER BY total_points DESC, club_name LIMIT $2`

/** Top clubs by points (ties share a rank). `category` null = all. */
export async function leaderboard({ category = null, limit = 10 } = {}) {
  const { rows } = await query(LEADERBOARD_SQL, [category, Math.min(Math.max(limit, 1), 200)])
  return rows
}

const PAYMENT_STATUS_SQL = `
  SELECT count(*) FILTER (WHERE approved IS NULL)::int AS pending, count(*) FILTER (WHERE approved = true)::int AS approved,
         count(*) FILTER (WHERE approved = false)::int AS rejected,
         coalesce(sum(value) FILTER (WHERE approved = true), 0)::float8 AS approved_amount
  FROM payment_slips`

export async function paymentsSummary() {
  const [{ rows: [s] }, fin] = await Promise.all([query(PAYMENT_STATUS_SQL), financeStats()])
  return {
    pendingSlips: s.pending, approvedSlips: s.approved, rejectedSlips: s.rejected, approvedAmount: s.approved_amount,
    registrationFee: fin.registrationFee, expectedIncome: fin.totalIncome, amountYetToCome: fin.amountYetToCome,
  }
}

/** Clubs whose general-member share is under the penalty threshold, from the same figures the penalty run uses. */
export async function membershipSummary({ listLimit = 10 } = {}) {
  const r = await previewMembership()
  if (!r.ok) return null
  const target = penaltyTarget(r.rules.tiers)
  const below = r.clubs.filter((c) => c.total_players_count > 0 && c.deduction !== 0)
  return {
    target, minPlayers: r.rules.minPlayers,
    clubsWithPlayers: r.clubs.filter((c) => c.total_players_count > 0).length,
    clubsPenalised: below.length,
    belowTarget: below.sort((a, b) => a.general_member_percentage - b.general_member_percentage).slice(0, listLimit)
      .map((c) => ({ club_id: c.club_id, club_name: c.club_name, general: c.general_members_count, total: c.total_players_count, percentage: c.general_member_percentage, deduction: c.deduction })),
  }
}

/** Everything the admin dashboard shows, in 6 statements that run in parallel. */
export async function adminOverview({ category = 'community', limit = 10 } = {}) {
  const [stats, board, payments, checkin, membership] = await Promise.all([
    adminStats(), leaderboard({ category, limit }), paymentsSummary(), dayStats(), membershipSummary(),
  ])
  return { stats, leaderboard: board, pendingRequests: stats.pendingRequests, payments, checkin, membership }
}

const BY_SPORT_SQL = `
  SELECT e.sport_id, e.sport_name, e.sport_type, e.gender_type, e.category, e.sport_day,
         count(r.id)::int AS registrations, count(DISTINCT r.club_id)::int AS clubs,
         count(r.id) FILTER (WHERE r.main_player)::int AS main_players, count(r.id) FILTER (WHERE NOT r.main_player)::int AS reserves
  FROM events e LEFT JOIN registrations r USING (sport_id)
  GROUP BY e.sport_id ORDER BY e.sport_day NULLS LAST, e.sport_name`

const BY_CLUB_SQL = `
  SELECT c.club_id, c.club_name, c.category,
         count(DISTINCT p.member_id)::int AS players,
         (SELECT count(*) FROM registrations r WHERE r.club_id = c.club_id)::int AS registrations,
         (SELECT count(DISTINCT r.sport_id) FROM registrations r WHERE r.club_id = c.club_id)::int AS sports
  FROM clubs c LEFT JOIN players p ON p.club_id = c.club_id
  WHERE c.status = 1 GROUP BY c.club_id, c.club_name, c.category ORDER BY c.club_name`

/** System statistics page: totals, per sport, per club, payments, check-in, membership share. */
export async function administrationOverview() {
  const [stats, bySport, byClub, payments, checkin, membership] = await Promise.all([
    adminStats(), query(BY_SPORT_SQL), query(BY_CLUB_SQL), paymentsSummary(), dayStats(), membershipSummary({ listLimit: 20 }),
  ])
  return { ...stats, registrationsBySport: bySport.rows, registrationsByClub: byClub.rows, payments, checkin, membership }
}

// ---------------------------------------------------------------- portal (one club)
const CLUB_STATS_SQL = `
  WITH me AS (SELECT club_id, club_name, category FROM clubs WHERE club_id = $1),
  mine AS (SELECT coalesce(sum(points), 0)::int AS pts FROM club_points WHERE club_id = $1),
  totals AS (
    SELECT c.club_id, coalesce(sum(cp.points), 0)::int AS pts
    FROM clubs c LEFT JOIN club_points cp ON cp.club_id = c.club_id
    WHERE c.status = 1 AND c.category = (SELECT category FROM me) GROUP BY c.club_id)
  SELECT me.club_id, me.club_name, me.category, mine.pts AS total_points,
         (SELECT count(*) + 1 FROM totals t WHERE t.pts > mine.pts)::int AS club_rank,
         (SELECT count(DISTINCT sport_id) FROM registrations WHERE club_id = $1)::int AS registered_events,
         (SELECT count(*) FROM players WHERE club_id = $1 AND status = 1)::int AS general,
         (SELECT count(*) FROM players WHERE club_id = $1 AND status = 5)::int AS prospective,
         (SELECT count(*) FROM players WHERE club_id = $1)::int AS total_players,
         (SELECT count(*) FROM payment_slips WHERE club_id = $1 AND approved IS NULL)::int AS slips_pending,
         (SELECT count(*) FROM payment_slips WHERE club_id = $1 AND approved = true)::int AS slips_approved,
         (SELECT count(*) FROM payment_slips WHERE club_id = $1 AND approved = false)::int AS slips_rejected,
         (SELECT points FROM club_points WHERE club_id = $1 AND kind = 'penalty') AS applied_penalty
  FROM me, mine`

// registered vs checked-in players of ONE club for each event day, in one statement
const CLUB_CHECKIN_SQL = `
  SELECT d.day_code, d.label,
         coalesce(x.players, 0)::int AS players, coalesce(x.checked_in, 0)::int AS checked_in
  FROM event_days d
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT r.member_id) AS players,
           count(DISTINCT r.member_id) FILTER (WHERE EXISTS (SELECT 1 FROM day_registrations dr WHERE dr.member_id = r.member_id AND dr.day_code = d.day_code)) AS checked_in
    FROM registrations r JOIN events e USING (sport_id) WHERE r.club_id = $1 AND e.sport_day = d.day_code) x ON true
  ORDER BY d.sort_order`

/** @returns {Promise<object|null>} null when the club does not exist */
export async function portalStats(clubId) {
  const [{ rows: [r] }, { rows: days }, rules, finance] = await Promise.all([
    query(CLUB_STATS_SQL, [clubId]), query(CLUB_CHECKIN_SQL, [clubId]), getPenaltyRules(), clubFinance(clubId),
  ])
  if (!r) return null
  const share = sharePercent(r.general, r.total_players)
  return {
    registeredEvents: r.registered_events, registeredPlayers: r.total_players,
    totalPoints: r.total_points, clubRank: r.club_rank,
    clubInfo: { club_id: r.club_id, club_name: r.club_name, category: r.category },
    playerBreakdown: { general: r.general, prospective: r.prospective, total: r.total_players },
    membership: {
      generalPercentage: share,
      target: rules ? penaltyTarget(rules.tiers) : null,
      minPlayers: rules?.minPlayers ?? null,
      deduction: rules ? penaltyFor({ general: r.general, total: r.total_players, tiers: rules.tiers, minPlayers: rules.minPlayers }) : null,
      appliedPenalty: r.applied_penalty ?? 0,
    },
    payments: { pendingSlips: r.slips_pending, approvedSlips: r.slips_approved, rejectedSlips: r.slips_rejected, ...finance },
    checkin: days.map((d) => ({ sportDay: d.day_code, label: d.label, players: d.players, checkedIn: d.checked_in })),
  }
}

export async function portalOverview({ clubId, category = null, limit = 10 }) {
  const stats = await portalStats(clubId)
  if (!stats) return null
  return { stats, leaderboard: await leaderboard({ category: category ?? stats.clubInfo.category, limit }) }
}

// ---------------------------------------------------------------- public: events a club registered
async function attendanceRatio() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'participation.min_attendance_ratio'")
  const v = validateSetting('participation.min_attendance_ratio', rows[0]?.value)
  return v.ok ? v.value : DEFAULT_ATTENDANCE_RATIO
}

// An event counts for the club when at least `ratio` of the club's players registered in it (main +
// reserve) have a day registration for the event's day: the same rule as participation points,
// compared in exact decimal arithmetic.
const REGISTERED_EVENTS_SQL = `
  SELECT e.sport_id, e.sport_name, e.sport_day, e.sport_type, e.min_count,
         count(DISTINCT r.member_id)::int AS registered,
         count(DISTINCT r.member_id) FILTER (WHERE e.sport_day IS NOT NULL AND EXISTS
           (SELECT 1 FROM day_registrations d WHERE d.member_id = r.member_id AND d.day_code = e.sport_day))::int AS attended,
         greatest(1, ceil($2::numeric * count(DISTINCT r.member_id)))::int AS required,
         (e.sport_day IS NOT NULL AND count(DISTINCT r.member_id) > 0 AND
          count(DISTINCT r.member_id) FILTER (WHERE EXISTS
            (SELECT 1 FROM day_registrations d WHERE d.member_id = r.member_id AND d.day_code = e.sport_day)) >= $2::numeric * count(DISTINCT r.member_id)) AS eligible
  FROM registrations r JOIN events e USING (sport_id)
  WHERE r.club_id = $1 GROUP BY e.sport_id ORDER BY e.sport_day NULLS LAST, e.sport_name`

const REGISTERED_PLAYERS_SQL = `
  SELECT count(DISTINCT r.member_id)::int AS registered,
         count(DISTINCT r.member_id) FILTER (WHERE EXISTS (SELECT 1 FROM day_registrations d WHERE d.member_id = r.member_id
           AND d.day_code IN (SELECT e.sport_day FROM events e JOIN registrations r2 USING (sport_id) WHERE r2.club_id = $1 AND e.sport_day IS NOT NULL)))::int AS day_registered
  FROM registrations r WHERE r.club_id = $1`

/** Contract consumed by the citation-checklist app: keep the keys exactly. null = unknown club. */
export async function clubRegisteredEvents(clubId) {
  const { rows: [club] } = await query('SELECT club_id, club_name, category FROM clubs WHERE club_id = $1', [clubId])
  if (!club) return null
  const ratio = await attendanceRatio()
  const [{ rows }, { rows: [p] }] = await Promise.all([query(REGISTERED_EVENTS_SQL, [clubId, ratio]), query(REGISTERED_PLAYERS_SQL, [clubId])])
  const events = rows.map((e) => ({
    sport_id: e.sport_id, sport_name: e.sport_name, sport_day: e.sport_day, sport_type: e.sport_type, min_count: e.min_count,
    registered_player_count: e.registered, day_registered_player_count: e.attended,
    required_day_registered_count: e.required, eligible: e.eligible,
  }))
  const eligible = events.filter((e) => e.eligible).length
  return {
    club,
    summary: {
      event_count: eligible, eligible_events_count: eligible, raw_registered_events_count: events.length,
      registered_players_count: p.registered, day_registered_players_count: p.day_registered,
    },
    events,
  }
}
