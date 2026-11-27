// Local mirror of RMIS members (table rmis_members). Portal pages and registration read the
// mirror, never RMIS per request, so an RMIS slowdown cannot slow registration. A worker keeps it
// fresh from the change feed; "refresh this club" re-reads one club's roster on demand.
import { query } from '../db.mjs'
import { rmis as defaultRmis } from './client.mjs'
import { getSetting, setSetting } from '../settings.mjs'

const WATERMARK_KEY = 'rmis.changes_watermark'
const OVERLAP_MS = 2 * 60_000
const CHUNK = 1000
const defaultDb = { query }

const cols = (rows) => ({
  ids: rows.map((r) => r.member_id),
  mids: rows.map((r) => r.membership_id ?? null),
  clubs: rows.map((r) => r.club_id),
  status: rows.map((r) => r.status),
  roles: rows.map((r) => r.role_id ?? null),
  card: rows.map((r) => r.card_name),
  full: rows.map((r) => r.full_name ?? null),
  gender: rows.map((r) => r.gender ?? null),
  nic: rows.map((r) => r.nic ?? null),
  dob: rows.map((r) => r.dob ?? null),
  created: rows.map((r) => r.created_at),
  tcomp: rows.map((r) => r.transfer_completed_at ?? null),
  tinfo: rows.map((r) => Object.hasOwn(r, 'transfer_completed_at')),
  tpend: rows.map((r) => r.has_pending_transfer === true),
  updated: rows.map((r) => r.updated_at ?? '1970-01-01T00:00:00Z'),
})

const INSERT = `INSERT INTO rmis_members
  (member_id, membership_id, club_id, status, role_id, card_name, full_name, gender, nic, dob, created_at, updated_at, transfer_completed_at, transfer_info, has_pending_transfer, synced_at)
  SELECT *, now() FROM unnest($1::int[], $2::text[], $3::int[], $4::smallint[], $5::smallint[], $6::text[], $7::text[], $8::text[],
                              $9::text[], $10::date[], $11::timestamptz[], $12::timestamptz[], $13::timestamptz[], $14::boolean[], $15::boolean[])
  ON CONFLICT (member_id) DO UPDATE SET
    membership_id = EXCLUDED.membership_id, club_id = EXCLUDED.club_id, status = EXCLUDED.status, role_id = EXCLUDED.role_id,
    card_name = EXCLUDED.card_name, full_name = EXCLUDED.full_name, gender = EXCLUDED.gender, nic = EXCLUDED.nic,
    dob = EXCLUDED.dob, created_at = EXCLUDED.created_at,
    transfer_completed_at = EXCLUDED.transfer_completed_at, transfer_info = EXCLUDED.transfer_info,
    has_pending_transfer = EXCLUDED.has_pending_transfer, synced_at = now()`

async function upsert(rows, { conditional }, db) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const c = cols(rows.slice(i, i + CHUNK))
    // changes feed: only newer RMIS state wins. roster: authoritative current state, keeps the stored watermark.
    const sql = conditional
      ? `${INSERT}, updated_at = EXCLUDED.updated_at WHERE rmis_members.updated_at <= EXCLUDED.updated_at`
      : INSERT
    await db.query(sql, [c.ids, c.mids, c.clubs, c.status, c.roles, c.card, c.full, c.gender, c.nic, c.dob, c.created, c.updated, c.tcomp, c.tinfo, c.tpend])
  }
}

export const applyRoster = (rows, db = defaultDb) => upsert(rows, { conditional: false }, db)
export const applyChanges = (rows, db = defaultDb) => upsert(rows, { conditional: true }, db)

/**
 * Copy RMIS state onto already-registered players. A registered player's club is never moved
 * silently (registrations belong to it): `rmis_club_id` records the mismatch for an admin to see.
 * Returns what changed, for the "sync" report.
 */
export async function reconcilePlayers({ clubId = null } = {}, db = defaultDb) {
  const { rows } = await db.query(
    `WITH diff AS (
       SELECT p.member_id, p.name, p.club_id,
              p.status AS old_status, p.rmis_status AS old_rmis_status,
              CASE WHEN p.converted THEN p.status WHEN m.status IN (1, 3) THEN 1 WHEN m.status = 5 THEN 5 ELSE p.status END AS new_status,
              m.status AS new_rmis_status, m.club_id AS new_rmis_club_id,
              NULLIF(upper(regexp_replace(coalesce(m.nic, ''), '\\s', '', 'g')), '') AS new_nic,
              m.membership_id AS new_membership_id
       FROM players p JOIN rmis_members m USING (member_id)
       WHERE ($1::int IS NULL OR p.club_id = $1)
     ), changed AS (
       SELECT d.* FROM diff d JOIN players p USING (member_id)
       WHERE p.rmis_status IS DISTINCT FROM d.new_rmis_status OR p.rmis_club_id IS DISTINCT FROM d.new_rmis_club_id
          OR p.status IS DISTINCT FROM d.new_status OR (d.new_nic IS NOT NULL AND p.nic IS DISTINCT FROM d.new_nic)
          OR (d.new_membership_id IS NOT NULL AND p.membership_id IS DISTINCT FROM d.new_membership_id)
     ), upd AS (
       UPDATE players p SET status = c.new_status, rmis_status = c.new_rmis_status, rmis_club_id = c.new_rmis_club_id,
              rmis_synced_at = now(), nic = COALESCE(c.new_nic, p.nic), membership_id = COALESCE(c.new_membership_id, p.membership_id)
       FROM changed c WHERE p.member_id = c.member_id RETURNING p.member_id
     )
     SELECT c.member_id, c.name, c.club_id, c.old_status, c.new_status, c.old_rmis_status, c.new_rmis_status, c.new_rmis_club_id
     FROM changed c JOIN upd USING (member_id) ORDER BY c.name`,
    [clubId]
  )
  return rows
}

/** Registered players an admin should look at: gone/inactive in RMIS, or moved to another club. */
export async function listRmisFlags(db = defaultDb) {
  const cutoff = await getSetting('membership.cutoff')
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT p.member_id, p.name, p.club_id, p.status, p.rmis_status, p.rmis_club_id,
              CASE WHEN p.rmis_status IS NOT NULL AND p.rmis_status NOT IN (1, 3, 5) THEN 'not_active_in_rmis'
                   WHEN p.rmis_club_id IS NOT NULL AND p.rmis_club_id <> p.club_id THEN 'club_changed_in_rmis'
                   WHEN m.transfer_completed_at IS NOT NULL AND $1::timestamptz IS NOT NULL AND m.transfer_completed_at > $1::timestamptz THEN 'transferred_after_cutoff' END AS flag
       FROM players p LEFT JOIN rmis_members m USING (member_id)
     ) f WHERE flag IS NOT NULL ORDER BY club_id, name`, [cutoff || null]
  )
  return rows
}

export async function syncClubs({ rmis = defaultRmis, db = defaultDb } = {}) {
  const clubs = await rmis.listClubs({ includeInactive: true })
  if (!clubs.length) return { clubs: 0 }
  await db.query(
    `INSERT INTO clubs (club_id, club_name, category, status, synced_at)
     SELECT *, now() FROM unnest($1::int[], $2::text[], $3::text[], $4::smallint[])
     ON CONFLICT (club_id) DO UPDATE SET club_name = EXCLUDED.club_name, category = EXCLUDED.category,
       status = EXCLUDED.status, synced_at = now()`,
    [clubs.map((c) => c.club_id), clubs.map((c) => c.club_name), clubs.map((c) => c.category), clubs.map((c) => c.status)]
  )
  return { clubs: clubs.length }
}

/**
 * One pass over the RMIS change feed. First run (no watermark) loads everything. The watermark
 * is the server_time of the FIRST page of a run, re-read with a 2-minute overlap next time, so
 * rows committed late in RMIS are never missed (upserts are idempotent).
 */
export async function syncChangesOnce({ rmis = defaultRmis, db = defaultDb, now = () => Date.now() } = {}) {
  const watermark = await getSetting(WATERMARK_KEY)
  const since = watermark ? new Date(Date.parse(watermark) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z'
  let cursor, firstServerTime, pages = 0, seen = 0
  do {
    const page = await rmis.changes({ updatedSince: since, cursor, limit: 1000 })
    firstServerTime ??= page.serverTime
    if (page.members.length) await applyChanges(page.members, db)
    seen += page.members.length
    cursor = page.nextCursor
    pages++
  } while (cursor)
  await setSetting(WATERMARK_KEY, firstServerTime ?? new Date(now()).toISOString())
  const changed = await reconcilePlayers({}, db)
  return { pages, seen, playersChanged: changed.length, firstRun: !watermark }
}

/** "Refresh this club now": re-read the roster from RMIS, update the mirror and the club's players. */
export async function refreshClub(clubId, { rmis = defaultRmis, db = defaultDb } = {}) {
  const roster = await rmis.listClubMembers(clubId) // statuses 1,3,5 by default
  await applyRoster(roster, db)
  const changes = await reconcilePlayers({ clubId }, db)
  return { members: roster.length, changes }
}

/**
 * Members of a club that may be registered, from the mirror. Cutoff unset = nobody (fail closed).
 * NIC is included because a club sees its own members' details.
 */
export async function listEligibleMembers(clubId, { db = defaultDb } = {}) {
  const cutoff = await getSetting('membership.cutoff')
  if (!cutoff || !Number.isFinite(Date.parse(cutoff))) return { cutoffSet: false, members: [], excluded: [] }
  const { rows } = await db.query(
    `SELECT member_id, membership_id, COALESCE(NULLIF(btrim(card_name), ''), NULLIF(btrim(full_name), '')) AS card_name, full_name, gender, status AS rmis_status,
            CASE WHEN status IN (1, 3) THEN 1 ELSE 5 END AS status, nic, dob, created_at
     FROM rmis_members
     WHERE club_id = $1 AND status IN (1, 3, 5) AND gender IN ('M', 'F') AND created_at <= $2::timestamptz
       AND (transfer_completed_at IS NULL OR transfer_completed_at <= $2::timestamptz)
       AND NOT (status = 3 AND transfer_completed_at IS NULL AND NOT transfer_info)
       AND COALESCE(NULLIF(btrim(card_name), ''), NULLIF(btrim(full_name), '')) IS NOT NULL
     ORDER BY 3, member_id`,
    [clubId, cutoff]
  )
  // members hidden only because of a transfer, so the club can see WHY someone is missing
  const { rows: excluded } = await db.query(
    `SELECT member_id, membership_id, card_name,
            CASE WHEN transfer_completed_at > $2::timestamptz THEN 'transfer_after_cutoff' ELSE 'transfer_info_unavailable' END AS reason
     FROM rmis_members
     WHERE club_id = $1 AND status IN (1, 3, 5) AND gender IN ('M', 'F') AND created_at <= $2::timestamptz
       AND (transfer_completed_at > $2::timestamptz OR (status = 3 AND transfer_completed_at IS NULL AND NOT transfer_info))
     ORDER BY card_name, member_id`,
    [clubId, cutoff]
  )
  return { cutoffSet: true, members: rows, excluded }
}
