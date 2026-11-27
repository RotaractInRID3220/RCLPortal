import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const { validateSetting, SETTINGS, byKey } = await import('../src/server/settings/registry.mjs')
const admin = await import('../src/server/settings/admin.mjs')
const { windowStatus } = await import('../src/server/registration/eligibility.mjs')
const actor = { member_id: 7 }
const TOUCHED = ['fees.registration_per_player', 'registration.open_at', 'registration.close_at', 'replacement.open_at', 'replacement.close_at', 'membership.cutoff', 'event.start_at', 'checkin.current_day', 'checkin.open', 'penalty.tiers', 'points.placement']
let saved = {}
before(async () => { for (const k of TOUCHED) saved[k] = await getSetting(k) })
after(async () => {
  for (const k of TOUCHED) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await query("DELETE FROM event_days WHERE day_code LIKE 'ZT%'")
  await query("DELETE FROM audit_log WHERE actor_id = 7 AND entity IN ('setting','event_day')")
  await closePool()
})
beforeEach(async () => { await query("DELETE FROM settings WHERE key IN ('registration.open_at','registration.close_at','replacement.open_at','replacement.close_at')") })

const bad = (key, value, re) => { const r = validateSetting(key, value); assert.equal(r.ok, false, `${key}=${JSON.stringify(value)} should be rejected`); if (re) assert.match(r.message, re) }
const good = (key, value) => { const r = validateSetting(key, value); assert.equal(r.ok, true, `${key}: ${r.message}`) }

test('registry: every setting has a label, group, type and a schema; keys are unique', () => {
  assert.equal(new Set(SETTINGS.map((s) => s.key)).size, SETTINGS.length)
  for (const s of SETTINGS) for (const f of ['key', 'group', 'type', 'label', 'schema']) assert.ok(s[f], `${s.key} lacks ${f}`)
})

test('every seeded default value is valid according to the registry', async () => {
  const { rows } = await query('SELECT key, value FROM settings')
  const seeded = rows.filter((r) => byKey[r.key])
  assert.ok(seeded.length >= 9)
  for (const r of seeded) good(r.key, r.value)
})

test('dates: ISO with offset only', () => {
  good('registration.open_at', '2026-12-01T09:00:00+05:30')
  good('membership.cutoff', '2026-12-01T00:00:00Z')
  for (const v of ['2026-12-01', 'tomorrow', 12345, null, '2026-12-01T09:00:00']) bad('registration.open_at', v)
})

test('numbers: fee, ratio, points, tiers, limits', () => {
  good('fees.registration_per_player', 1000); bad('fees.registration_per_player', -1); bad('fees.registration_per_player', '1000')
  good('participation.min_attendance_ratio', 0.5); bad('participation.min_attendance_ratio', 0); bad('participation.min_attendance_ratio', 1.5)
  good('points.placement', [100, 75, 50]); bad('points.placement', [100, 75]); bad('points.placement', [100, 75, -5]); bad('points.placement', [1.5, 2, 3])
  good('penalty.tiers', [{ lt: 62, points: -80 }, { lt: 67, points: -50 }]); bad('penalty.tiers', []); bad('penalty.tiers', [{ lt: 62, points: 10 }])
  bad('penalty.tiers', [{ lt: 62, points: -1 }, { lt: 62, points: -2 }], /different/); bad('penalty.tiers', [{ lt: 0, points: -1 }]); bad('penalty.tiers', [{ lt: 101, points: -1 }])
  good('limits.groups', { standard: { per: 'day', max: 1 }, track: { per: 'total', max: 3 }, swimming: { per: 'total', max: 3 } })
  bad('limits.groups', { standard: { per: 'week', max: 1 } }); bad('limits.groups', {})
  good('checkin.open', true); bad('checkin.open', 'yes'); bad('no.such.key', 1, /Unknown/)
})

test('generic deadline: a sport without its own close time uses registration.close_at; the sport\'s own wins', () => {
  const open = '2026-01-01T00:00:00Z'
  const now = new Date('2026-12-05T12:00:00Z')
  assert.equal(windowStatus({ openAt: open, eventClose: null, closeAt: '2026-12-01T00:00:00Z', now }).code, 'registration_closed')
  assert.equal(windowStatus({ openAt: open, eventClose: null, closeAt: '2026-12-31T00:00:00Z', now }).open, true)
  assert.equal(windowStatus({ openAt: open, eventClose: '2026-12-31T00:00:00Z', closeAt: '2026-12-01T00:00:00Z', now }).open, true)   // own later deadline wins
  assert.equal(windowStatus({ openAt: open, eventClose: '2026-12-01T00:00:00Z', closeAt: '2026-12-31T00:00:00Z', now }).code, 'registration_closed') // own earlier deadline wins
  assert.equal(windowStatus({ openAt: open, eventClose: null, closeAt: undefined, now }).open, true) // neither set = no deadline
})

test('admin: update validates, saves, audits; unknown/invalid values are refused', async () => {
  assert.equal((await admin.updateSetting({ actor, key: 'registration.open_at', value: 'nonsense' })).code, 'invalid_value')
  assert.equal((await admin.updateSetting({ actor, key: 'bogus', value: 1 })).code, 'invalid_value')
  const r = await admin.updateSetting({ actor, key: 'registration.open_at', value: '2026-12-01T09:00:00+05:30' })
  assert.equal(r.ok, true)
  assert.equal(await getSetting('registration.open_at'), '2026-12-01T09:00:00+05:30')
  const { rows } = await query("SELECT detail FROM audit_log WHERE actor_id = 7 AND action = 'setting.update' AND entity_id = 'registration.open_at' ORDER BY id DESC LIMIT 1")
  assert.equal(rows[0].detail.after, '2026-12-01T09:00:00+05:30')
  const list = await admin.listSettingsForAdmin()
  const row = list.find((s) => s.key === 'registration.open_at')
  assert.equal(row.isSet, true); assert.equal(row.updated_by, 7)
  assert.equal(list.find((s) => s.key === 'replacement.open_at').isSet, false)
})

test('admin: a closing time must be after the opening time (both directions)', async () => {
  await admin.updateSetting({ actor, key: 'registration.open_at', value: '2026-12-01T09:00:00Z' })
  assert.equal((await admin.updateSetting({ actor, key: 'registration.close_at', value: '2026-12-01T09:00:00Z' })).code, 'invalid_window')
  assert.equal((await admin.updateSetting({ actor, key: 'registration.close_at', value: '2026-11-30T09:00:00Z' })).code, 'invalid_window')
  assert.equal((await admin.updateSetting({ actor, key: 'registration.close_at', value: '2026-12-10T09:00:00Z' })).ok, true)
  assert.equal((await admin.updateSetting({ actor, key: 'registration.open_at', value: '2026-12-20T09:00:00Z' })).code, 'invalid_window')
  await admin.updateSetting({ actor, key: 'replacement.open_at', value: '2026-12-01T00:00:00Z' })
  assert.equal((await admin.updateSetting({ actor, key: 'replacement.close_at', value: '2026-11-01T00:00:00Z' })).code, 'invalid_window')
})

test('seeded defaults are flagged unconfirmed until an admin saves them', async () => {
  await query("UPDATE settings SET updated_by = NULL WHERE key IN ('fees.registration_per_player','penalty.tiers')")
  let list = await admin.listSettingsForAdmin()
  assert.equal(list.find((s) => s.key === 'fees.registration_per_player').unconfirmed, true)
  assert.equal(list.find((s) => s.key === 'penalty.tiers').unconfirmed, true)
  assert.equal(list.find((s) => s.key === 'registration.open_at').unconfirmed, false) // dates have no default
  await admin.updateSetting({ actor, key: 'fees.registration_per_player', value: 1000 }) // confirm as is
  list = await admin.listSettingsForAdmin()
  assert.equal(list.find((s) => s.key === 'fees.registration_per_player').unconfirmed, false)
  assert.equal(list.find((s) => s.key === 'penalty.tiers').unconfirmed, true)
})

test('admin: clear works for dates only; fees/points/limits must keep a value', async () => {
  await admin.updateSetting({ actor, key: 'membership.cutoff', value: '2026-12-31T00:00:00Z' })
  assert.equal((await admin.clearSetting({ actor, key: 'membership.cutoff' })).ok, true)
  assert.equal(await getSetting('membership.cutoff'), undefined)
  for (const k of ['fees.registration_per_player', 'limits.groups', 'penalty.tiers', 'checkin.open']) assert.equal((await admin.clearSetting({ actor, key: k })).code, 'not_clearable')
  assert.equal((await admin.clearSetting({ actor, key: 'nope' })).code, 'unknown_setting')
})

test('admin: check-in day must be a defined event day', async () => {
  assert.equal((await admin.updateSetting({ actor, key: 'checkin.current_day', value: 'D-99' })).code, 'unknown_day')
  assert.equal((await admin.updateSetting({ actor, key: 'checkin.current_day', value: 'D-02' })).ok, true)
})

test('event days: create, edit, order clash, delete unused, refuse delete when in use', async () => {
  assert.equal((await admin.saveEventDay({ actor, day: { day_code: 'ZT1', label: 'Test day', sort_order: 801, event_date: '2026-12-10' } })).ok, true)
  assert.equal((await admin.saveEventDay({ actor, day: { day_code: 'ZT1', label: 'Renamed', sort_order: 801, event_date: null } })).ok, true)
  assert.equal((await admin.listEventDays()).find((d) => d.day_code === 'ZT1').label, 'Renamed')
  assert.equal((await admin.saveEventDay({ actor, day: { day_code: 'ZT2', label: 'Clash', sort_order: 801 } })).code, 'sort_order_taken')
  await query("INSERT INTO events (sport_name, sport_type, gender_type, category, sport_day) VALUES ('__t_zt','individual','mixed','community','ZT1')")
  assert.equal((await admin.deleteEventDay({ actor, dayCode: 'ZT1' })).code, 'day_in_use')
  await query("DELETE FROM events WHERE sport_name = '__t_zt'")
  assert.equal((await admin.deleteEventDay({ actor, dayCode: 'ZT1' })).ok, true)
  assert.equal((await admin.deleteEventDay({ actor, dayCode: 'ZT1' })).code, 'day_not_found')
})

test('public event info exposes dates, day labels and the check-in switch only', async () => {
  await admin.updateSetting({ actor, key: 'event.start_at', value: '2026-12-10T07:00:00+05:30' })
  const info = await admin.getPublicEventInfo()
  assert.equal(info.eventStartAt, '2026-12-10T07:00:00+05:30')
  assert.ok(info.days.length >= 5 && info.days.every((d) => d.day_code && d.label))
  assert.deepEqual(Object.keys(info).sort(), ['checkinDay', 'checkinOpen', 'days', 'eventStartAt', 'registrationCloseAt', 'registrationOpenAt', 'replacementCloseAt', 'replacementOpenAt', 'serverTime'])
})
