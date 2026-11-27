import { fail, ok } from '@/server/http.mjs'
import { clubRegisteredEvents } from '@/server/dashboards/service.mjs'

// PUBLIC. Consumed by the separate citation-checklist app: keep the response keys exactly
// (data.club, data.summary.event_count / eligible_events_count / raw_registered_events_count /
// registered_players_count / day_registered_players_count, data.events[]). Never cached.
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Expires: '0' }

export async function GET(_request, { params }) {
  const { clubId } = await params
  if (!/^\d{1,9}$/.test(String(clubId))) return fail(400, 'invalid_request', 'Valid club ID is required')
  const data = await clubRegisteredEvents(Number(clubId))
  const res = data ? ok(data) : fail(404, 'club_not_found', 'Club not found')
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v)
  return res
}
