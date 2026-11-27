import { query } from '@/server/db.mjs'

// PUBLIC liveness/readiness probe for Dokploy and uptime monitors. Reveals no data, only ok/not ok
// plus ages in seconds. 200 = database reachable; 503 = it is not.
export async function GET() {
  const t0 = Date.now()
  try {
    const { rows: [r] } = await query(
      `SELECT (SELECT extract(epoch FROM now() - max(computed_at)) FROM snapshots)::int AS snapshot_age_s,
              (SELECT extract(epoch FROM now() - updated_at) FROM settings WHERE key = 'rmis.changes_watermark')::int AS rmis_sync_age_s`)
    return Response.json({ ok: true, db_ms: Date.now() - t0, snapshot_age_s: r.snapshot_age_s, rmis_sync_age_s: r.rmis_sync_age_s },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
