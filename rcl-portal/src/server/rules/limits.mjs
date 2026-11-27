// Per-player registration limits. Pure functions: the data comes in, a verdict comes out, so the
// rules can be unit-tested and reused by registration, replacement and swap flows.
//
// Rules live in the `limits.groups` setting, e.g.
//   { standard: { per: 'day',   max: 1 },   // team / individual events
//     track:    { per: 'total', max: 3 },   // track events + shot put + discus
//     swimming: { per: 'total', max: 3 } }  // swimming events
// Each event has a `limit_group`. `per: 'day'` counts within the event's day, `per: 'total'`
// counts across the whole competition. The road race sits on its own day, so it never competes
// with other events for the daily limit.

export const LIMIT_GROUPS = ['standard', 'track', 'swimming']

/** Default group for a new event; admins mark swimming events explicitly. */
export function defaultLimitGroup(sportType) {
  return sportType === 'trackIndividual' || sportType === 'trackTeam' ? 'track' : 'standard'
}

/** @returns {string[]} problems; empty when the settings value is usable. */
export function validateLimitRules(rules) {
  const problems = []
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return ['limits.groups must be an object']
  for (const g of LIMIT_GROUPS) {
    const r = rules[g]
    if (!r) { problems.push(`group "${g}" is missing`); continue }
    if (r.per !== 'day' && r.per !== 'total') problems.push(`group "${g}": per must be "day" or "total"`)
    if (!Number.isInteger(r.max) || r.max < 0) problems.push(`group "${g}": max must be a whole number >= 0`)
  }
  for (const g of Object.keys(rules)) if (!LIMIT_GROUPS.includes(g)) problems.push(`unknown group "${g}"`)
  return problems
}

/**
 * Can the player take `candidate` on top of `existing` registrations?
 *  - existing: [{ sport_id, sport_day, limit_group }]
 *  - candidate: { sport_id, sport_day, limit_group }
 *  - ignoreSportIds: registrations being replaced/moved away (swap, replacement), not counted
 * Fails closed when the rules are missing or invalid.
 */
export function checkRegistrationLimits({ existing, candidate, rules, ignoreSportIds = [] }) {
  if (validateLimitRules(rules).length) {
    return { ok: false, code: 'limits_not_configured', message: 'Registration limits are not configured.' }
  }
  const ignored = new Set(ignoreSportIds)
  const current = existing.filter((r) => !ignored.has(r.sport_id))

  if (current.some((r) => r.sport_id === candidate.sport_id)) {
    return { ok: false, code: 'already_registered', message: 'This player is already registered for this sport.' }
  }

  const group = candidate.limit_group
  const rule = rules[group]
  if (!rule) return { ok: false, code: 'unknown_limit_group', message: `Unknown limit group "${group}".` }

  // Athletics (track) and swimming take a player's whole day: on a day where they have one of them they
  // cannot enter a normal sport, and the other way round. Different days are independent, and the road
  // race sits on its own day, so it never clashes.
  const takesWholeDay = group !== 'standard'
  if (current.some((r) => r.sport_day === candidate.sport_day && (r.limit_group !== 'standard') !== takesWholeDay)) {
    return {
      ok: false,
      code: 'day_conflict',
      message: 'Athletics and swimming players cannot enter any other sport on the same day.',
      group, day: candidate.sport_day,
    }
  }

  const counted = current.filter(
    (r) => r.limit_group === group && (rule.per === 'total' || r.sport_day === candidate.sport_day)
  )
  if (counted.length >= rule.max) {
    return {
      ok: false,
      code: 'limit_reached',
      message: rule.per === 'day'
        ? `A player can enter at most ${rule.max} ${group} event(s) per day.`
        : `A player can enter at most ${rule.max} ${group} event(s) in total.`,
      group, per: rule.per, max: rule.max, day: rule.per === 'day' ? candidate.sport_day : null,
    }
  }
  return { ok: true }
}

/**
 * Swap/move check for one player: they give up `giveUp` (a sport_id) and take `candidate`.
 */
export function checkMove({ existing, giveUpSportId, candidate, rules }) {
  return checkRegistrationLimits({ existing, candidate, rules, ignoreSportIds: [giveUpSportId] })
}
