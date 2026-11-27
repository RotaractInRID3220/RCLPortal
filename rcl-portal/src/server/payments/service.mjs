// Payment slips: a club uploads a bank-slip image with the amount, an admin approves or rejects it.
// Rules: the club always comes from the session; the image type is read from its bytes; a decision
// can only be made once (UPDATE ... WHERE approved IS NULL); money is computed in SQL from the
// fee setting, never in the browser.
import { randomUUID } from 'node:crypto'
import { query } from '../db.mjs'
import { getStorage } from '../storage/index.mjs'
import { MAX_SLIP_BYTES, sniffImage } from './image.mjs'

const fail = (status, code, message) => ({ ok: false, status, code, message })
const MAX_VALUE = 10_000_000

export async function getFee() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'fees.registration_per_player'")
  const fee = rows[0]?.value
  return typeof fee === 'number' && fee >= 0 ? fee : null
}

const present = (r) => ({
  payment_id: r.payment_id, club_id: r.club_id, value: Number(r.value), slip_number: r.slip_number,
  approved: r.approved, date: r.created_at, decided_at: r.decided_at,
  link: `/api/payment-slips/${r.payment_id}/file`, // authenticated route, not a public URL
})

export async function createSlip({ actor, clubId, value, slipNumber, buffer }) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_VALUE) return fail(400, 'invalid_value', 'The amount must be a positive number.')
  const rounded = Math.round(amount * 100) / 100
  const slip = String(slipNumber ?? '').trim()
  if (!slip || slip.length > 40) return fail(400, 'invalid_slip_number', 'A slip number (up to 40 characters) is required.')
  if (!buffer?.length) return fail(400, 'file_required', 'The slip image is required.')
  if (buffer.length > MAX_SLIP_BYTES) return fail(413, 'file_too_large', 'The image must be 5 MB or smaller.')
  const img = sniffImage(buffer)
  if (!img) return fail(415, 'invalid_file_type', 'Only JPEG, PNG or WebP images are accepted.')

  const { rows: [dup] } = await query(
    'SELECT 1 FROM payment_slips WHERE club_id = $1 AND lower(slip_number) = lower($2) AND approved IS DISTINCT FROM false LIMIT 1', [clubId, slip])
  if (dup) return fail(409, 'duplicate_slip', 'A slip with this number has already been submitted for your club.')

  const storage = await getStorage()
  const key = `slips/${clubId}/${randomUUID()}.${img.ext}`
  await storage.put(key, buffer)
  try {
    const { rows: [row] } = await query(
      `INSERT INTO payment_slips (club_id, value, slip_number, object_key, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [clubId, rounded, slip, key, actor.member_id])
    return { ok: true, slip: present(row) }
  } catch (e) {
    await storage.delete(key).catch(() => {}) // never leave an orphan file behind
    throw e
  }
}

export async function listClubSlips(clubId) {
  const { rows } = await query('SELECT * FROM payment_slips WHERE club_id = $1 ORDER BY created_at DESC, payment_id DESC', [clubId])
  return rows.map(present)
}

/** The slip image for the owning club or any admin. */
export async function getSlipFile({ user, id }) {
  const { rows: [row] } = await query('SELECT club_id, object_key FROM payment_slips WHERE payment_id = $1', [id])
  if (!row) return fail(404, 'slip_not_found', 'Payment slip not found.')
  if (!user.hasAdminAccess && row.club_id !== user.club_id) return fail(403, 'forbidden', 'This slip belongs to another club.')
  const file = await (await getStorage()).get(row.object_key)
  if (!file) return fail(404, 'file_missing', 'The slip image is missing.')
  return { ok: true, ...file }
}

/** Approve or reject once. A slip that already has a decision cannot be flipped. */
export async function decideSlip({ actor, id, approve }) {
  const { rows: [row] } = await query(
    `UPDATE payment_slips SET approved = $2, decided_by = $3, decided_at = now()
     WHERE payment_id = $1 AND approved IS NULL RETURNING *`, [id, approve, actor.member_id])
  if (!row) {
    const { rows: [exists] } = await query('SELECT approved FROM payment_slips WHERE payment_id = $1', [id])
    return exists ? fail(409, 'already_decided', `This slip was already ${exists.approved ? 'approved' : 'rejected'}.`) : fail(404, 'slip_not_found', 'Payment slip not found.')
  }
  await query('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actor.member_id, approve ? 'payment.approve' : 'payment.reject', 'payment_slip', String(id), JSON.stringify({ club_id: row.club_id, value: Number(row.value) })])
  return { ok: true, slip: present(row) }
}

const TABS = { pending: 'ps.approved IS NULL', approved: 'ps.approved = true', rejected: 'ps.approved = false' }

export async function listSlipsAdmin({ tab = 'pending', page = 1, limit = 10, search = '' }) {
  const cond = TABS[tab] ?? TABS.pending
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 100)
  const pg = Math.max(Number(page) || 1, 1)
  const like = search ? `%${String(search).replace(/[\\%_]/g, '\\$&')}%` : null
  const where = `${cond} AND ($1::text IS NULL OR c.club_name ILIKE $1 OR ps.slip_number ILIKE $1)`
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(`SELECT ps.*, c.club_name FROM payment_slips ps JOIN clubs c USING (club_id) WHERE ${where}
           ORDER BY ps.created_at DESC, ps.payment_id DESC LIMIT $2 OFFSET $3`, [like, lim, (pg - 1) * lim]),
    query(`SELECT count(*)::int AS total FROM payment_slips ps JOIN clubs c USING (club_id) WHERE ${where}`, [like]),
  ])
  return { payments: rows.map((r) => ({ ...present(r), club_name: r.club_name })), totalCount: total, totalPages: Math.ceil(total / lim), currentPage: pg }
}

/** Money per club: players x fee, paid = approved slips, remaining never below 0. */
export async function clubFinance(clubId) {
  const fee = await getFee()
  const { rows: [r] } = await query(
    `SELECT (SELECT count(*)::int FROM players WHERE club_id = $1) AS players,
            (SELECT coalesce(sum(value), 0) FROM payment_slips WHERE club_id = $1 AND approved = true) AS paid`, [clubId])
  const total = fee == null ? null : r.players * fee
  const paid = Number(r.paid)
  return { fee, totalPlayers: r.players, totalAmount: total, paidAmount: paid, remainingAmount: total == null ? null : Math.max(0, total - paid) }
}

export async function financeStats() {
  const fee = await getFee()
  const { rows: [r] } = await query(
    `SELECT (SELECT count(*)::int FROM players) AS players,
            (SELECT coalesce(sum(value), 0) FROM payment_slips WHERE approved = true) AS paid,
            (SELECT count(*)::int FROM payment_slips WHERE approved IS NULL) AS pending`)
  const income = fee == null ? null : r.players * fee
  const paid = Number(r.paid)
  return { totalPlayers: r.players, registrationFee: fee, totalIncome: income, totalPaymentsReceived: paid,
           amountYetToCome: income == null ? null : Math.max(0, income - paid), pendingSlips: r.pending }
}

export async function clubsSummary() {
  const fee = await getFee()
  const { rows } = await query(
    `SELECT c.club_id, c.club_name, count(p.member_id)::int AS player_count,
            coalesce((SELECT sum(value) FROM payment_slips s WHERE s.club_id = c.club_id AND s.approved = true), 0) AS paid
     FROM clubs c LEFT JOIN players p USING (club_id) GROUP BY c.club_id, c.club_name HAVING count(p.member_id) > 0 ORDER BY c.club_name`)
  const clubs = rows.map((r) => {
    const total = fee == null ? null : r.player_count * fee
    const paid = Number(r.paid)
    return { club_id: r.club_id, club_name: r.club_name, playerCount: r.player_count, totalAmount: total, paidAmount: paid, toBePaid: total == null ? null : Math.max(0, total - paid) }
  })
  return { clubs, totalClubs: clubs.length, registrationFee: fee }
}
