// Admin-editable settings (table `settings`). Absent key = "not set": callers must fail closed.
import { query } from './db.mjs'

/** @returns the JSON value, or `undefined` when the key is not set. */
export async function getSetting(key) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key])
  return rows.length ? rows[0].value : undefined
}

export async function getSettings(keys) {
  const { rows } = await query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys])
  const out = Object.fromEntries(keys.map((k) => [k, undefined]))
  for (const r of rows) out[r.key] = r.value
  return out
}

export async function setSetting(key, value, updatedBy = null) {
  await query(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), updatedBy]
  )
}

/** True only when `registration.open_at` is set and already passed (unset = closed). */
export function isOpenSince(isoTimestamp, now = new Date()) {
  if (!isoTimestamp) return false
  const t = Date.parse(isoTimestamp)
  return Number.isFinite(t) && t <= now.getTime()
}
