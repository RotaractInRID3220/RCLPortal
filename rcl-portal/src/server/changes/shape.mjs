// Shapes the club pages read (kept close to what the pages already consumed), built from the
// service's plain rows. Identity is always member_id; membership_id is display only.

const sportOf = (r) => ({ sport_id: r.sport_id, sport_name: r.sport_name, sport_day: r.sport_day, sport_type: r.sport_type, gender_type: r.gender_type })
const regOf = (r) => ({ id: r.id, member_id: r.member_id, sport_id: r.sport_id, club_id: r.club_id, main_player: r.main_player, has_pending: r.has_pending,
  player: { name: r.player_name, status: r.player_status, gender: r.player_gender, membership_id: r.membership_id, ri_id: r.ri_id } })

export function replacementsView(ctx) {
  const sports = [], sportRegistrations = {}, playerRegistrationMap = {}
  for (const r of ctx.registrations) {
    if (!sports.some((s) => s.sport_id === r.sport_id)) sports.push(sportOf(r))
    ;(sportRegistrations[r.sport_id] ??= []).push(regOf(r))
    ;(playerRegistrationMap[r.member_id] ??= []).push({ sport_id: r.sport_id, sport_day: r.sport_day, sport_type: r.sport_type })
  }
  const requests = ctx.replacements.map((q) => ({
    id: q.id, status: q.status, registration_id: q.registration_id, created_at: q.created_at, decided_at: q.decided_at,
    reason: q.reason, supporting_link: q.supporting_link, ri_id: q.rep_ri_id,
    sport: { sport_id: q.sport_id, sport_name: q.sport_name },
    original_player: { member_id: q.original_member_id, name: q.original_name },
    replacement_player: { member_id: q.replacement_member_id, name: q.rep_name, membership_id: q.rep_membership_id, status: q.rep_status },
  }))
  return { sports, sportRegistrations, playerRegistrationMap, requests, window: ctx.window }
}

export function swapsView(ctx) {
  const sportRegistrations = {}, playerRegistrationMap = {}
  for (const r of ctx.registrations) {
    ;(sportRegistrations[r.sport_id] ??= []).push({ ...regOf(r), sport_day: r.sport_day })
    ;(playerRegistrationMap[r.member_id] ??= []).push({ sport_id: r.sport_id, sport_day: r.sport_day, sport_type: r.sport_type })
  }
  const requests = ctx.swaps.map((s) => ({
    id: s.id, status: s.status, kind: s.kind, created_at: s.created_at, decided_at: s.decided_at, reason: s.description,
    reg1_id: s.reg1_id, reg2_id: s.reg2_id,
    sport_one: { sport_id: s.sport1_id, sport_name: s.sport1_name }, sport_two: { sport_id: s.sport2_id, sport_name: s.sport2_name },
    player_one: { name: s.player1_name }, player_two: s.player2_name ? { name: s.player2_name } : null,
  }))
  // every sport of the club's category: the page uses them as sources (with registrations) and as destinations
  return { sports: ctx.events, sportRegistrations, playerRegistrationMap, requests, window: ctx.window }
}

// ---- admin pages ----------------------------------------------------------------------------

export const adminReplacementItem = (q) => ({
  id: q.id, status: q.status, club_id: q.club_id, club_name: q.club_name, created_at: q.created_at,
  approved_by: q.decided_by, approved_at: q.decided_at, reason: q.reason, supporting_link: q.supporting_link,
  sport: { sport_id: q.sport_id, sport_name: q.sport_name, sport_day: q.sport_day },
  original_player: { member_id: q.original_member_id, name: q.original_name },
  replacement_player: { member_id: q.replacement_member_id, name: q.rep_name, status: q.rep_status, ri_id: q.rep_ri_id },
})

export const adminReplacementDetail = (q) => ({
  id: q.id, status: q.status, club_id: q.club_id, club_name: q.club_name, created_at: q.created_at, reason: q.reason, supporting_link: q.supporting_link,
  requested_by: q.requested_by, approved_by: q.decided_by, approved_at: q.decided_at,
  still_applicable: q.still_applicable, replacement_rmis_status: q.replacement_rmis_status, replacement_rmis_club_id: q.replacement_rmis_club_id,
  sport: { sport_id: q.sport_id, sport_name: q.sport_name, sport_day: q.sport_day, sport_type: q.sport_type, gender_type: q.gender_type, category: q.club_category },
  original_player: { member_id: q.original_member_id, membership_id: q.original_membership_id, name: q.original_name, nic: q.original_nic, gender: q.original_gender,
    status: q.original_status, ri_id: q.original_ri_id },
  replacement_player: { member_id: q.replacement_member_id, membership_id: q.rep_membership_id, name: q.rep_name, status: q.rep_status, ri_id: q.rep_ri_id,
    nic: q.rep_nic, gender: q.rep_gender, birthdate: q.rep_birthdate },
})

export const adminSwapItem = (s) => ({
  id: s.id, status: s.status, club_id: s.club_id, club_name: s.club_name, created_at: s.created_at, description: s.description,
  approved_by: s.decided_by, approved_at: s.decided_at, type: s.is_move ? 'single-move' : 'player-swap',
  player1: { name: s.player1_name, current_sport: { sport_id: s.sport1_id, sport_name: s.sport1_name } },
  player2: s.player2_name ? { name: s.player2_name, current_sport: { sport_id: s.sport2_id, sport_name: s.sport2_name } } : null,
  target_sport: { sport_id: s.sport2_id, sport_name: s.sport2_name },
})
