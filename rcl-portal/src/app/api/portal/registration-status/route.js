import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { getSettings, isOpenSince } from '@/server/settings.mjs'
import { penaltyTarget } from '@/server/penalties/rules.mjs'

// What the registration pages need to show the right state. The server still enforces everything;
// this only drives the UI. Unset dates mean "not scheduled yet" (closed).
export async function GET() {
  const auth = await requireUser({ portal: true })
  if (!auth.ok) return auth.response
  const s = await getSettings(['registration.open_at', 'membership.cutoff', 'replacement.open_at', 'replacement.close_at', 'penalty.tiers', 'penalty.min_players'])
  return ok({
    registrationOpenAt: s['registration.open_at'] ?? null,
    registrationOpen: isOpenSince(s['registration.open_at']),
    cutoffSet: Boolean(s['membership.cutoff']),
    replacementOpenAt: s['replacement.open_at'] ?? null,
    replacementCloseAt: s['replacement.close_at'] ?? null,
    penaltyTarget: Array.isArray(s['penalty.tiers']) ? penaltyTarget(s['penalty.tiers']) : null,
    penaltyMinPlayers: s['penalty.min_players'] ?? null,
    serverTime: new Date().toISOString(),
  })
}
