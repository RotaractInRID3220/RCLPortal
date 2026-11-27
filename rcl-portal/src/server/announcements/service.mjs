// Announcements: admins write them; the worker adds deadline reminders (a day before and an hour
// before). Everyone with portal or admin access sees them (they are the same list for all users),
// gets them pushed live, and has a per-user "read" mark for the unread badge.
import { query, tx } from '../db.mjs'
import { getSettings } from '../settings.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const clean = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

export async function createAnnouncement({ actor, title, body = '', expiresAt = null }) {
  const t = clean(title, 150)
  if (!t) return fail(400, 'title_required', 'A title is required.')
  const b = clean(body, 2000)
  if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) return fail(400, 'invalid_expiry', 'The expiry time is not valid.')
  return tx(async (c) => {
    const { rows: [me] } = await c.query('SELECT card_name, full_name, role_id FROM rmis_members WHERE member_id = $1', [actor.member_id])
    const author = (me?.card_name || me?.full_name || '').trim() || 'Admin'
    const sentAs = me?.role_id === 4 ? 'RDSC' : 'Admin'            // RMIS role 4 = RDSC; every other sender shows as Admin
    const { rows: [row] } = await c.query(
      `INSERT INTO announcements (kind, title, body, author_name, sent_as, created_by, expires_at) VALUES ('manual', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [t, b, author, sentAs, actor.member_id, expiresAt || null])
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)',
      [actor.member_id, 'announcement.create', 'announcement', String(row.id), JSON.stringify({ title: t })])
    return { ok: true, announcement: row }
  })
}

export async function retractAnnouncement({ actor, id }) {
  return tx(async (c) => {
    const { rows: [row] } = await c.query('UPDATE announcements SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id])
    if (!row) return fail(404, 'not_found', 'Announcement not found.')
    await c.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)', [actor.member_id, 'announcement.retract', 'announcement', String(id), '{}'])
    return { ok: true }
  })
}

const LIVE = 'a.deleted_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > now())'

/**
 * What a user sees: live announcements, newest first, each with whether this user has read it.
 * Portal users see only the role label ("Admin" / "RDSC"); the sender's name is for the admin portal (`withNames`).
 */
export async function listForUser(memberId, { limit = 30, withNames = false } = {}) {
  const { rows } = await query(
    `SELECT a.id, a.kind, a.title, a.body, a.sent_as, CASE WHEN $3::boolean THEN a.author_name END AS author_name, a.created_at, a.expires_at, (r.member_id IS NOT NULL) AS read
     FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.member_id = $1
     WHERE ${LIVE} ORDER BY a.created_at DESC, a.id DESC LIMIT $2`, [memberId, limit, withNames])
  return { items: rows, unread: rows.filter((x) => !x.read).length }
}

export async function markRead(memberId, ids = null) {
  const { rowCount } = await query(
    `INSERT INTO announcement_reads (announcement_id, member_id)
     SELECT a.id, $1 FROM announcements a WHERE ${LIVE} AND ($2::bigint[] IS NULL OR a.id = ANY($2))
     ON CONFLICT DO NOTHING`, [memberId, ids])
  return { marked: rowCount }
}

/** Admin history with reach: how many people have read it, out of everyone who can sign in to the portal. */
export async function listForAdmin({ limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT a.id, a.kind, a.title, a.body, a.author_name, a.sent_as, a.created_at, a.expires_at,
            (SELECT count(*)::int FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count
     FROM announcements a WHERE a.deleted_at IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT $1`, [limit])
  const { rows: [aud] } = await query(
    `SELECT count(*)::int AS n FROM rmis_members m JOIN clubs c USING (club_id)
     WHERE m.role_id BETWEEN 1 AND 6 AND m.status IN (1, 3, 5) AND c.status = 1`)
  return { items: rows, audience: aud.n }
}

// ---------------------------------------------------------------- deadline reminders

const fmt = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso))
const HOUR = 3_600_000

/** Which reminder is due for a deadline right now: '1h' within the last hour, '24h' within the last day, otherwise none. */
export function dueReminder(deadlineIso, now = Date.now()) {
  const left = Date.parse(deadlineIso) - now
  if (!Number.isFinite(left) || left <= 0) return null
  if (left <= HOUR) return '1h'
  if (left <= 24 * HOUR) return '24h'
  return null
}

async function putReminder(c, { key, title, body, expiresAt }) {
  const { rowCount } = await c.query(
    `INSERT INTO announcements (kind, title, body, auto_key, expires_at) VALUES ('auto', $1, $2, $3, $4) ON CONFLICT (auto_key) DO NOTHING`,
    [title, body, key, expiresAt])
  return rowCount === 1
}

/**
 * Create the "closes within 24 hours / within 1 hour" announcements that are due now. Idempotent
 * (unique key per deadline + reminder), so it is safe to run every minute from the worker and
 * from the API. Deadlines: registration close, replacement/swap close, and each sport's own close.
 */
export async function runDeadlineReminders({ now = Date.now() } = {}) {
  const s = await getSettings(['registration.open_at', 'registration.close_at', 'replacement.open_at', 'replacement.close_at'])
  const nowIso = new Date(now).toISOString()
  const items = []
  const opened = (openAt) => !openAt || Date.parse(openAt) <= now
  if (s['registration.close_at'] && opened(s['registration.open_at'])) {
    items.push({ kind: 'registration', at: s['registration.close_at'], what: 'Player registration', body: (when) => `Register your players before ${when} (Sri Lanka time). Sports with their own closing time are announced separately.` })
  }
  if (s['replacement.close_at'] && opened(s['replacement.open_at'])) {
    items.push({ kind: 'replacement', at: s['replacement.close_at'], what: 'Replacements and swaps', body: (when) => `Submit any player replacement or swap request before ${when} (Sri Lanka time).` })
  }
  // sports with their own closing time, grouped by the instant so one reminder covers them all
  const { rows } = await query(
    `SELECT registration_close, array_agg(sport_name ORDER BY sport_name) AS names FROM events
     WHERE registration_close > $1::timestamptz AND registration_close <= $1::timestamptz + interval '1 day' GROUP BY registration_close`, [nowIso])
  for (const r of rows) {
    const names = [...new Set(r.names)]
    const shown = names.length > 8 ? `${names.slice(0, 8).join(', ')} and ${names.length - 8} more` : names.join(', ')
    items.push({ kind: `sports`, at: r.registration_close.toISOString(), what: 'Registration for some sports', body: (when) => `Registration for ${shown} closes ${when} (Sri Lanka time).` })
  }
  const created = []
  await tx(async (c) => {
    for (const it of items) {
      const due = dueReminder(it.at, now)
      if (!due) continue
      const iso = new Date(it.at).toISOString()
      const when = fmt(iso)
      const title = `${it.what} closes within ${due === '1h' ? '1 hour' : '24 hours'}`
      const key = `deadline:${it.kind}:${iso}:${due}`
      if (await putReminder(c, { key, title, body: it.body(when), expiresAt: iso })) created.push(key)
    }
  })
  return { created }
}

let lastCheck = 0
/** Cheap guard used by the API so reminders still go out if the worker is down (at most once a minute per process). */
export async function maybeRunDeadlineReminders() {
  const t = Date.now()
  if (t - lastCheck < 60_000) return
  lastCheck = t
  try { await runDeadlineReminders() } catch (e) { console.error('deadline reminders failed:', e.message) }
}
