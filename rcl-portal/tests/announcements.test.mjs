import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const svc = await import('../src/server/announcements/service.mjs')
const { subscribe } = await import('../src/server/realtime/hub.mjs')

const actor = { member_id: 54 }
const KEYS = ['registration.open_at', 'registration.close_at', 'replacement.open_at', 'replacement.close_at']
const saved = {}
const H = 3_600_000
async function cleanup() {
  await query("DELETE FROM announcements WHERE title LIKE '__an_%' OR kind = 'auto'")
  await query("DELETE FROM events WHERE sport_name LIKE '__an_%'")
  await query('DELETE FROM audit_log WHERE actor_id = 54')
}
before(async () => { for (const k of KEYS) saved[k] = await getSetting(k); await cleanup() })
after(async () => {
  await cleanup()
  for (const k of KEYS) { if (saved[k] === undefined) await query('DELETE FROM settings WHERE key = $1', [k]); else await setSetting(k, saved[k]) }
  await closePool()
})
beforeEach(async () => { await cleanup(); for (const k of KEYS) await query('DELETE FROM settings WHERE key = $1', [k]) })

test('admin sends an announcement; every user sees it; read marks are per user and never reset', async () => {
  const r = await svc.createAnnouncement({ actor, title: '__an_ Hello', body: 'Line 1\r\nLine 2' })
  assert.equal(r.ok, true)
  const a = await svc.listForUser(901), b = await svc.listForUser(902)
  assert.equal(a.items.some((x) => x.title === '__an_ Hello' && x.read === false), true)
  assert.equal(b.items.some((x) => x.title === '__an_ Hello'), true)
  const id = r.announcement.id
  assert.equal((await svc.markRead(901, [id])).marked, 1)
  assert.equal((await svc.markRead(901, [id])).marked, 0)                          // idempotent
  assert.equal((await svc.listForUser(901)).items.find((x) => x.id === id).read, true)
  assert.equal((await svc.listForUser(902)).items.find((x) => x.id === id).read, false)
  assert.equal((await svc.listForAdmin()).items.find((x) => x.id === id).read_count, 1)
})

test('sender: portal users see "Admin" or "RDSC" (RMIS role 4), never the name; the admin portal sees the name', async () => {
  await query("INSERT INTO rmis_members (member_id, membership_id, club_id, status, role_id, card_name, full_name, gender, created_at, updated_at, transfer_info) VALUES (980001,'ANX1',1,1,4,'Rae Dee Sec','Rae Dee Sec','F','2026-06-23T10:00:00Z','2026-06-23T10:00:00Z',true), (980002,'ANX2',1,1,2,'Ann Admin','Ann Admin','F','2026-06-23T10:00:00Z','2026-06-23T10:00:00Z',true) ON CONFLICT (member_id) DO NOTHING")
  try {
    await svc.createAnnouncement({ actor: { member_id: 980001 }, title: '__an_ from rdsc' })
    await svc.createAnnouncement({ actor: { member_id: 980002 }, title: '__an_ from admin' })
    const portal = (await svc.listForUser(901)).items
    const pr = portal.find((x) => x.title === '__an_ from rdsc'), pa = portal.find((x) => x.title === '__an_ from admin')
    assert.equal(pr.sent_as, 'RDSC'); assert.equal(pa.sent_as, 'Admin')
    assert.equal(pr.author_name, null); assert.equal(pa.author_name, null)                 // no names in the portal
    const adm = (await svc.listForUser(901, { withNames: true })).items
    assert.equal(adm.find((x) => x.title === '__an_ from rdsc').author_name, 'Rae Dee Sec')
    assert.equal((await svc.listForAdmin()).items.find((x) => x.title === '__an_ from admin').author_name, 'Ann Admin')
  } finally { await query('DELETE FROM rmis_members WHERE member_id IN (980001, 980002)') }
})

test('validation, expiry and retract', async () => {
  assert.equal((await svc.createAnnouncement({ actor, title: '   ' })).code, 'title_required')
  assert.equal((await svc.createAnnouncement({ actor, title: '__an_ x', expiresAt: 'nope' })).code, 'invalid_expiry')
  const past = await svc.createAnnouncement({ actor, title: '__an_ expired', expiresAt: new Date(Date.now() - H).toISOString() })
  const live = await svc.createAnnouncement({ actor, title: '__an_ live' })
  const titles = (await svc.listForUser(901)).items.map((x) => x.title)
  assert.ok(titles.includes('__an_ live') && !titles.includes('__an_ expired'))
  assert.equal((await svc.retractAnnouncement({ actor, id: live.announcement.id })).ok, true)
  assert.equal((await svc.retractAnnouncement({ actor, id: live.announcement.id })).code, 'not_found')
  assert.ok(!(await svc.listForUser(901)).items.some((x) => x.title === '__an_ live'))
  assert.equal((await svc.markRead(901)).marked >= 0, true)
})

test('a new announcement is pushed to open pages immediately', async () => {
  const got = []
  const off = await subscribe((ch, payload) => { if (ch === 'rcl_announce') got.push(payload) })
  const r = await svc.createAnnouncement({ actor, title: '__an_ push' })
  const t = Date.now(); while (!got.length && Date.now() - t < 2000) await new Promise((x) => setTimeout(x, 10))
  assert.equal(got[0], String(r.announcement.id))
  await off()
})

test('dueReminder: nothing earlier than 24 h, 24 h inside the last day, 1 h inside the last hour, nothing after', () => {
  const now = Date.parse('2026-12-01T00:00:00Z')
  assert.equal(svc.dueReminder(new Date(now + 25 * H).toISOString(), now), null)
  assert.equal(svc.dueReminder(new Date(now + 24 * H).toISOString(), now), '24h')
  assert.equal(svc.dueReminder(new Date(now + 2 * H).toISOString(), now), '24h')
  assert.equal(svc.dueReminder(new Date(now + H).toISOString(), now), '1h')
  assert.equal(svc.dueReminder(new Date(now + 60_000).toISOString(), now), '1h')
  assert.equal(svc.dueReminder(new Date(now).toISOString(), now), null)
  assert.equal(svc.dueReminder(new Date(now - H).toISOString(), now), null)
})

test('deadline reminders: one a day before, one an hour before, never repeated, none after the deadline', async () => {
  const now = Date.now()
  const close = new Date(now + 24 * H - 5 * 60_000).toISOString()              // 23 h 55 min away: the 24 h reminder is due
  await setSetting('registration.close_at', close)
  let r = await svc.runDeadlineReminders({ now })
  assert.equal(r.created.length, 1); assert.match(r.created[0], /:24h$/)
  r = await svc.runDeadlineReminders({ now: now + 60_000 })
  assert.equal(r.created.length, 0)                                              // running again changes nothing
  r = await svc.runDeadlineReminders({ now: Date.parse(close) - 30 * 60_000 })   // 30 min before
  assert.equal(r.created.length, 1); assert.match(r.created[0], /:1h$/)
  r = await svc.runDeadlineReminders({ now: Date.parse(close) - 20 * 60_000 })
  assert.equal(r.created.length, 0)
  r = await svc.runDeadlineReminders({ now: Date.parse(close) + 1000 })          // deadline passed
  assert.equal(r.created.length, 0)
  const titles = (await query("SELECT title, body, expires_at FROM announcements WHERE kind = 'auto' ORDER BY id")).rows
  assert.deepEqual(titles.map((x) => x.title), ['Player registration closes within 24 hours', 'Player registration closes within 1 hour'])
  assert.match(titles[0].body, /Sri Lanka time/); assert.equal(titles[0].expires_at.toISOString(), close)
})

test('reminders: missed 24 h reminder is skipped when already inside the last hour; not before the window opens; replacement deadline and per-sport deadlines', async () => {
  const now = Date.now()
  await setSetting('registration.close_at', new Date(now + 30 * 60_000).toISOString())
  let r = await svc.runDeadlineReminders({ now })
  assert.deepEqual(r.created.map((k) => k.split(':').at(-1)), ['1h'])             // no late "24 hours" message
  await query("DELETE FROM announcements WHERE kind = 'auto'")
  await setSetting('registration.open_at', new Date(now + 5 * H).toISOString())  // registration not open yet: closing reminder makes no sense
  assert.equal((await svc.runDeadlineReminders({ now })).created.length, 0)
  await query("DELETE FROM settings WHERE key IN ('registration.open_at', 'registration.close_at')")
  await setSetting('replacement.close_at', new Date(now + 10 * H).toISOString())
  r = await svc.runDeadlineReminders({ now })
  assert.equal(r.created.length, 1)
  assert.equal((await query("SELECT title FROM announcements WHERE kind = 'auto'")).rows[0].title, 'Replacements and swaps closes within 24 hours')
  await query("DELETE FROM announcements WHERE kind = 'auto'"); await query("DELETE FROM settings WHERE key = 'replacement.close_at'")
  const close = new Date(now + 3 * H)
  await query("INSERT INTO events (sport_name, sport_type, gender_type, category, registration_close, sport_day) VALUES ('__an_ A','team','mixed','community',$1,'D-01'), ('__an_ B','team','mixed','community',$1,'D-01')", [close])
  r = await svc.runDeadlineReminders({ now })
  assert.equal(r.created.length, 1)                                               // both sports share one reminder
  const row = (await query("SELECT body FROM announcements WHERE kind = 'auto'")).rows[0]
  assert.match(row.body, /__an_ A, __an_ B/)
})
