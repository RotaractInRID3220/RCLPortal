import { query, tx } from '../db.mjs'
import { SETTINGS, byKey, validateSetting } from './registry.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })

export async function listSettingsForAdmin() {
  const { rows } = await query('SELECT key, value, updated_by, updated_at FROM settings')
  const stored = Object.fromEntries(rows.map((r) => [r.key, r]))
  return SETTINGS.map((s) => ({
    key: s.key, group: s.group, type: s.type, label: s.label, help: s.help ?? null, clearable: Boolean(s.clearable),
    // a seeded default nobody has saved yet: the screen asks an admin to confirm or change it
    unconfirmed: Boolean(s.seeded) && Boolean(stored[s.key]) && stored[s.key].updated_by == null,
    value: stored[s.key]?.value ?? null, isSet: Boolean(stored[s.key]), updated_by: stored[s.key]?.updated_by ?? null, updated_at: stored[s.key]?.updated_at ?? null,
  }))
}

const PAIRS = { 'registration.close_at': 'registration.open_at', 'replacement.close_at': 'replacement.open_at' }

async function currentValue(c, key) {
  const { rows } = await c.query('SELECT value FROM settings WHERE key = $1', [key])
  return rows[0]?.value
}

export async function updateSetting({ actor, key, value }) {
  const v = validateSetting(key, value)
  if (!v.ok) return fail(400, 'invalid_value', v.message)
  return tx(async (c) => {
    // a window must end after it starts
    for (const [closeKey, openKey] of Object.entries(PAIRS)) {
      if (key !== closeKey && key !== openKey) continue
      const open = key === openKey ? v.value : await currentValue(c, openKey)
      const close = key === closeKey ? v.value : await currentValue(c, closeKey)
      if (open && close && Date.parse(close) <= Date.parse(open)) {
        return fail(400, 'invalid_window', 'The closing time must be after the opening time.')
      }
    }
    if (key === 'checkin.current_day') {
      const { rows } = await c.query('SELECT 1 FROM event_days WHERE day_code = $1', [v.value])
      if (!rows.length) return fail(400, 'unknown_day', `"${v.value}" is not a defined event day.`)
    }
    const before = await currentValue(c, key)
    await c.query(
      `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(v.value), actor.member_id])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'setting.update', 'setting', key, JSON.stringify({ before: before ?? null, after: v.value })])
    return { ok: true }
  })
}

export async function clearSetting({ actor, key }) {
  const def = byKey[key]
  if (!def) return fail(400, 'unknown_setting', `Unknown setting "${key}".`)
  if (!def.clearable) return fail(400, 'not_clearable', 'This setting must always have a value.')
  return tx(async (c) => {
    const before = await currentValue(c, key)
    await c.query('DELETE FROM settings WHERE key = $1', [key])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor.member_id, 'setting.clear', 'setting', key, JSON.stringify({ before: before ?? null })])
    return { ok: true }
  })
}

// ---- event days (data, not code) ---------------------------------------------------------------
export async function listEventDays() {
  const { rows } = await query(
    `SELECT d.day_code, d.label, d.sort_order, d.event_date,
            (SELECT count(*)::int FROM events e WHERE e.sport_day = d.day_code) AS events,
            (SELECT count(*)::int FROM day_registrations r WHERE r.day_code = d.day_code) AS check_ins
     FROM event_days d ORDER BY d.sort_order`)
  return rows
}

export async function saveEventDay({ actor, day }) {
  try {
    await query(
      `INSERT INTO event_days (day_code, label, sort_order, event_date) VALUES ($1, $2, $3, $4)
       ON CONFLICT (day_code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, event_date = EXCLUDED.event_date`,
      [day.day_code, day.label, day.sort_order, day.event_date ?? null])
  } catch (e) {
    if (e.code === '23505') return fail(409, 'sort_order_taken', 'Another day already uses that order number.')
    throw e
  }
  await query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actor.member_id, 'event_day.save', 'event_day', day.day_code, JSON.stringify(day)])
  return { ok: true }
}

export async function deleteEventDay({ actor, dayCode }) {
  const days = await listEventDays()
  const d = days.find((x) => x.day_code === dayCode)
  if (!d) return fail(404, 'day_not_found', 'Day not found.')
  if (d.events || d.check_ins) return fail(409, 'day_in_use', `This day is used by ${d.events} sport(s) and ${d.check_ins} check-in(s).`)
  await query('DELETE FROM event_days WHERE day_code = $1', [dayCode])
  await query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actor.member_id, 'event_day.delete', 'event_day', dayCode, '{}'])
  return { ok: true }
}

/** What the public site may show: dates and day labels only. */
export async function getPublicEventInfo() {
  const keys = ['registration.open_at', 'registration.close_at', 'replacement.open_at', 'replacement.close_at', 'event.start_at', 'checkin.open', 'checkin.current_day']
  const { rows } = await query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys])
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const { rows: days } = await query('SELECT day_code, label, event_date FROM event_days ORDER BY sort_order')
  return {
    registrationOpenAt: s['registration.open_at'] ?? null, registrationCloseAt: s['registration.close_at'] ?? null,
    replacementOpenAt: s['replacement.open_at'] ?? null, replacementCloseAt: s['replacement.close_at'] ?? null,
    eventStartAt: s['event.start_at'] ?? null, checkinOpen: s['checkin.open'] === true, checkinDay: s['checkin.current_day'] ?? null, days, serverTime: new Date().toISOString(),
  }
}
