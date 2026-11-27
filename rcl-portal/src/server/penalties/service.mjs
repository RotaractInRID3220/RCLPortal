// Membership penalties. The old bug: every "apply" inserted a NEW penalty row per club, so a
// double-click, a retry or two admins stacked penalties. Now:
//   * a club has at most ONE penalty row (unique index), and "apply" SETS it to the current value
//     (insert/update when the club is below the target, remove when it is compliant);
//   * the whole run is one transaction under an advisory lock, so concurrent runs are serialised and
//     a failure leaves nothing half-applied;
//   * if the RMIS refresh (the first step) fails, nothing is applied at all.
import { query, tx } from '../db.mjs'
import { validateSetting } from '../settings/registry.mjs'
import { syncChangesOnce } from '../rmis/mirror.mjs'
import { penaltyFor, sharePercent } from './rules.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const LOCK_KEY = 4_204_001 // arbitrary constant: one apply at a time

async function loadRules(db) {
  const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('penalty.tiers', 'penalty.min_players')")
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const tiers = validateSetting('penalty.tiers', s['penalty.tiers'])
  const min = validateSetting('penalty.min_players', s['penalty.min_players'])
  if (!tiers.ok || !min.ok) return null // missing or invalid: fail closed
  return { tiers: tiers.value, minPlayers: min.value }
}
export const getPenaltyRules = () => loadRules({ query })

const STATS_SQL = `
  SELECT c.club_id, c.club_name,
         count(p.member_id) FILTER (WHERE p.status = 1)::int AS general,
         count(p.member_id) FILTER (WHERE p.status = 5)::int AS prospective,
         count(p.member_id)::int AS total,
         (SELECT cp.points FROM club_points cp WHERE cp.club_id = c.club_id AND cp.kind = 'penalty') AS applied
  FROM clubs c LEFT JOIN players p ON p.club_id = c.club_id
  WHERE c.status = 1 GROUP BY c.club_id, c.club_name ORDER BY c.club_name`

function present(r, rules) {
  const deduction = penaltyFor({ general: r.general, total: r.total, tiers: rules.tiers, minPlayers: rules.minPlayers })
  const applied = r.applied ?? 0
  return {
    club_id: r.club_id, club_name: r.club_name,
    general_members_count: r.general, prospective_members_count: r.prospective, total_players_count: r.total,
    general_member_percentage: sharePercent(r.general, r.total),
    deduction,            // what the rules say right now
    applied_penalty: applied, // what is stored for the club
    pending_change: deduction !== applied,
  }
}

/** Per-club figures with the penalty the rules give today (nothing is changed). */
export async function previewMembership() {
  const rules = await getPenaltyRules()
  if (!rules) return fail(503, 'penalty_not_configured', 'The penalty tiers or minimum players are not configured.')
  const { rows } = await query(STATS_SQL)
  return { ok: true, rules, clubs: rows.map((r) => present(r, rules)) }
}

/**
 * Apply the penalty rules. `refresh`: re-read RMIS first (members who left or changed status).
 * `clean`: drop players with no registrations first (they are not real participants).
 * Idempotent: running it any number of times gives the same rows.
 */
export async function applyMembershipRules({ actor, refresh = true, clean = true, rmis }) {
  const rules0 = await getPenaltyRules()
  if (!rules0) return fail(503, 'penalty_not_configured', 'The penalty tiers or minimum players are not configured.')

  let refreshed = null
  if (refresh) refreshed = await syncChangesOnce(rmis ? { rmis } : {}) // throws on RMIS failure: nothing applied

  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    const rules = await loadRules(c) // read again under the lock
    if (!rules) return fail(503, 'penalty_not_configured', 'The penalty tiers or minimum players are not configured.')

    let cleaned = 0
    if (clean) {
      const { rowCount } = await c.query('DELETE FROM players p WHERE NOT EXISTS (SELECT 1 FROM registrations r WHERE r.member_id = p.member_id)')
      cleaned = rowCount
    }

    const { rows } = await c.query(STATS_SQL)
    const results = []
    for (const r of rows) {
      const row = present(r, rules)
      if (row.deduction !== 0) {
        await c.query(
          `INSERT INTO club_points (club_id, kind, points, note, created_by) VALUES ($1, 'penalty', $2, $3, $4)
           ON CONFLICT (club_id) WHERE kind = 'penalty'
           DO UPDATE SET points = EXCLUDED.points, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now()`,
          [r.club_id, row.deduction, `Membership penalty: ${r.general}/${r.total} general members`, actor.member_id])
      } else if (r.applied != null) {
        await c.query("DELETE FROM club_points WHERE club_id = $1 AND kind = 'penalty'", [r.club_id])
      }
      results.push({ ...row, previous: row.applied_penalty, applied_penalty: row.deduction, pending_change: false, changed: row.deduction !== row.applied_penalty })
    }
    const changed = results.filter((x) => x.changed)
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'penalty.apply', 'club_points', 'all', JSON.stringify({
        refreshed: refreshed ? { seen: refreshed.seen, playersChanged: refreshed.playersChanged } : null, cleaned,
        penalised: results.filter((x) => x.deduction !== 0).length, changes: changed.map((x) => ({ club_id: x.club_id, from: x.previous, to: x.deduction })) })])
    return { ok: true, results, changed: changed.length, penalised: results.filter((x) => x.deduction !== 0).length, cleaned, refreshed }
  })
}

/** Remove penalty rows (one club, or all). */
export async function revokePenalties({ actor, clubId = null }) {
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    const { rows } = await c.query("DELETE FROM club_points WHERE kind = 'penalty' AND ($1::int IS NULL OR club_id = $1) RETURNING club_id, points", [clubId])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'penalty.revoke', 'club_points', clubId == null ? 'all' : String(clubId), JSON.stringify({ removed: rows })])
    return { ok: true, removed: rows.length }
  })
}
