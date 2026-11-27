import { query } from '../db.mjs'
import { defaultLimitGroup } from '../rules/limits.mjs'

const clamp = (n, lo, hi, d) => { const v = Number.parseInt(n, 10); return Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : d }

export async function listEvents({ sportId, category, day, types, gender, limit, offset } = {}) {
  const lim = clamp(limit, 1, 500, 100)
  const off = clamp(offset, 0, 1_000_000, 0)
  const where = `($1::int IS NULL OR sport_id = $1) AND ($2::text IS NULL OR category = $2) AND ($3::text IS NULL OR sport_day = $3)
                 AND ($4::text[] IS NULL OR sport_type = ANY($4)) AND ($5::text IS NULL OR gender_type = $5)`
  const params = [sportId ?? null, category ?? null, day ?? null, types?.length ? types : null, gender ?? null]
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(`SELECT * FROM events WHERE ${where} ORDER BY sport_day, sport_name, sport_id LIMIT $6 OFFSET $7`, [...params, lim, off]),
    query(`SELECT count(*)::int AS total FROM events WHERE ${where}`, params),
  ])
  return { rows, total, limit: lim, offset: off }
}

/** @returns {{ok:true,event}|{ok:false,status,code,message}} */
export async function createEvent(input) {
  const { rows: [day] } = await query('SELECT 1 FROM event_days WHERE day_code = $1', [input.day])
  if (!day) return { ok: false, status: 400, code: 'unknown_day', message: `"${input.day}" is not a defined event day.` }
  if (input.minPlayers != null && input.maxPlayers != null && input.minPlayers > input.maxPlayers) {
    return { ok: false, status: 400, code: 'invalid_counts', message: 'The minimum cannot be larger than the maximum.' }
  }
  const { rows: [event] } = await query(
    `INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, registration_close, sport_day, limit_group, bib_required)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $10 <> 'standard' OR $9 = (SELECT day_code FROM event_days ORDER BY sort_order DESC LIMIT 1)) RETURNING *`,
    [input.name, input.type, input.gender, input.category, input.minPlayers ?? null, input.maxPlayers ?? null, input.reservePlayers ?? null,
     input.regClose ?? null, input.day, input.limitGroup ?? defaultLimitGroup(input.type)])
  return { ok: true, event }
}
