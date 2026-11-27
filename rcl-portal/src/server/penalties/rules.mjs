// Membership penalty rules as pure functions. The tiers and the minimum player count are settings
// (`penalty.tiers`, `penalty.min_players`), so nothing here is a hard-coded percentage.
//
// A club's general-member share = players with status 1 / ALL its players (prospective and
// converted players count in the total). The lowest tier threshold the share is BELOW applies;
// at or above every threshold there is no penalty. Comparison uses cross-multiplication
// (general*100 < lt*total), so there is no floating-point rounding at the boundaries.

/** @returns {number} points (0 or negative) */
export function penaltyFor({ general, total, tiers, minPlayers }) {
  if (!Number.isFinite(general) || !Number.isFinite(total) || total <= 0) return 0
  if (total < minPlayers) return 0 // too few players for a fair percentage
  const sorted = [...tiers].sort((a, b) => a.lt - b.lt)
  for (const t of sorted) if (general * 100 < t.lt * total) return t.points
  return 0
}

export const sharePercent = (general, total) => (total > 0 ? (general / total) * 100 : 0)

/** The share a club should reach to avoid any penalty: the highest threshold. */
export const penaltyTarget = (tiers) => (tiers?.length ? Math.max(...tiers.map((t) => t.lt)) : null)
