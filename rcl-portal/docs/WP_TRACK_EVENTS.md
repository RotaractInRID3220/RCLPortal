# WP: Track events (ported to Postgres)

Service: `src/server/track/service.mjs`. Routes: `src/app/api/track-events/route.js` (GET/POST/PUT), `src/app/api/track-events/award/route.js` (POST). Migration `0008_track_event_places.sql` (unique finishing position per event). Tests: `tests/track-events.test.mjs` (12).

## Behaviour
- Entries: individual events list registered main players (reserves shown to admins only); team events list the event's `teams`. Entries appear without any sync; `POST /api/track-events` (sync) only creates missing rows and removes rows whose player/team is gone, and keeps results.
- Save (`PUT`, any admin): `{ sport_id, results: [{ member_id | team_id, score, place }] }`. One transaction under a per-event advisory lock; places are cleared then rewritten so a re-order/swap works. Validated: positions are integers >= 1 and unique, score is a time (`12.34`, `1:02.5`, `1:02:03.4`), every entry belongs to the event, no duplicates. Same payload twice = same state. Audit: `track.save_results`.
- Award (`POST /award`): points come from the admin's saved positions (the old code re-derived places from the score text and ignored them). Place 1-3 -> `points.track_individual` / `points.track_team`; any other ranked place -> `points.track_participation`; entries with no place get nothing. A club's points in one event are summed into ONE `club_points` row (`kind='track'`, unique per club+sport, best place kept). Awarding again replaces that event's track rows (clubs that no longer score are removed); other kinds are never touched (the old code deleted every point row of the sport). Fails closed (503) if a points setting is missing. Audit: `track.award` / `track.reaward`.
- Permissions: saving results = admin; first award = `super_admin`; re-award (rows already exist) = `administrator`. Editing results after an award does not change points until re-awarded (PUT returns `awarded` so the UI can say so).
- Read access: `GET /api/track-events` is open to any signed-in account (portal scorecard) with `Cache-Control: no-store`; member ids and team player lists are admin-only. Access policy changed accordingly (writes admin-only); policy test updated.

## Decisions
- Participation: `src/server/participation/service.mjs` only covers `team`/`individual` sports, so track participation points are not duplicated there; they live in the track rows (`points.track_participation`). The road race (D-05, `individual`) is untouched and not counted in the track limit (limits unchanged).
- Ties are not supported (unique positions); give one entry the place and leave a note in the time if needed.
- Admin UI assigns positions only to entries that have a time; the rest stay unranked (DNF).

## Pages needing manual browser QA
`/admin/dashboard/track-events/[sportid]` and `/mob/[sportid]` (drag order, save, award, error toasts for permission/duplicate), `/admin/dashboard/track-events` (sync), `/portal/dashboard/track-events/[sportid]` (read-only scorecard as a president account). I could not run eslint/next build (no eslint config); JSX edited by careful read.
