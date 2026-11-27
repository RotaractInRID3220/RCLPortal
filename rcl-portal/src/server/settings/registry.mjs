// Every admin-editable setting: its group, label, type and validation. The super-admin screen and
// the API are generated from this list, so nothing is hard-coded in the UI or the config file.
import { z } from 'zod'
import { validateLimitRules } from '../rules/limits.mjs'

const iso = z.string().datetime({ offset: true })
const int0 = z.number().int().min(0)
const three = z.array(int0).length(3)

const tiers = z.array(z.object({ lt: z.number().gt(0).lte(100), points: z.number().int().max(0) })).min(1).max(8)
  .superRefine((arr, ctx) => {
    const lts = arr.map((t) => t.lt)
    if (new Set(lts).size !== lts.length) ctx.addIssue({ code: 'custom', message: 'each threshold must be different' })
  })

const limits = z.any().superRefine((v, ctx) => {
  for (const p of validateLimitRules(v)) ctx.addIssue({ code: 'custom', message: p })
})

/** seeded: has a default value from db/seed/reference.sql that an admin must confirm. type: datetime | boolean | number | numbers | tiers | limits | day. clearable: may be unset again. */
export const SETTINGS = [
  { key: 'registration.open_at',  group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Registration opens', help: 'Until set, registration stays closed.' },
  { key: 'registration.close_at', group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Registration closes (generic deadline)', help: 'Used for every sport that has no deadline of its own. Unset = no generic deadline.' },
  { key: 'replacement.open_at',   group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Replacements and swaps open' },
  { key: 'replacement.close_at',  group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Replacements and swaps close' },
  { key: 'membership.cutoff',     group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Membership cutoff', help: 'Members created in RMIS after this moment cannot be registered. Until set, nobody can be registered.' },
  { key: 'event.start_at',        group: 'dates', type: 'datetime', clearable: true, schema: iso, label: 'Event start (public countdown)' },
  { key: 'checkin.open',          group: 'checkin', type: 'boolean', clearable: false, schema: z.boolean(), label: 'Day check-in open' },
  { key: 'checkin.require_registration', group: 'checkin', type: 'boolean', clearable: true, schema: z.boolean(), label: 'Check-in needs a registered sport that day', help: 'On (default when unset): a player with no sport on the current day cannot be checked in.' },
  { key: 'checkin.current_day',   group: 'checkin', type: 'day', clearable: true, schema: z.string().min(1).max(10), label: 'Current check-in day' },
  { key: 'worker.rmis_changes_interval_s', group: 'system', type: 'number', clearable: true, schema: z.number().int().min(30).max(600), label: 'RMIS member sync interval (seconds)', help: 'How often the worker pulls member changes from RMIS. Unset = 90.' },
  { key: 'fees.registration_per_player', seeded: true, group: 'money', type: 'number', schema: z.number().min(0).max(1_000_000), label: 'Registration fee per player (Rs.)' },
  { key: 'points.placement', seeded: true,             group: 'points', type: 'numbers', schema: three, label: 'Tournament placement points (1st, 2nd, 3rd)' },
  { key: 'points.track_individual', seeded: true,      group: 'points', type: 'numbers', schema: three, label: 'Individual track points (1st, 2nd, 3rd)' },
  { key: 'points.track_team', seeded: true,            group: 'points', type: 'numbers', schema: three, label: 'Team track points (1st, 2nd, 3rd)' },
  { key: 'points.track_participation', seeded: true,   group: 'points', type: 'number', schema: int0, label: 'Track participation points' },
  { key: 'points.participation_per_sport', seeded: true, group: 'points', type: 'number', schema: int0, label: 'Participation points per sport' },
  { key: 'participation.min_attendance_ratio', seeded: true, group: 'points', type: 'number', schema: z.number().gt(0).lte(1), label: 'Attendance needed for participation points (0-1)' },
  { key: 'penalty.min_players', seeded: true, group: 'penalty', type: 'number', schema: int0, label: 'Minimum players before a penalty can apply' },
  { key: 'penalty.tiers', seeded: true,       group: 'penalty', type: 'tiers', schema: tiers, label: 'Penalty tiers (general-member share below X% costs Y points)' },
  { key: 'limits.groups', seeded: true,       group: 'limits', type: 'limits', schema: limits, label: 'Registration limits per player' },
]

export const byKey = Object.fromEntries(SETTINGS.map((s) => [s.key, s]))

/** @returns {{ok:true,value:any}|{ok:false,message:string}} */
export function validateSetting(key, value) {
  const def = byKey[key]
  if (!def) return { ok: false, message: `Unknown setting "${key}".` }
  const r = def.schema.safeParse(value)
  if (!r.success) return { ok: false, message: r.error.issues.map((i) => i.message).join('; ') || 'Invalid value.' }
  return { ok: true, value: r.data }
}
