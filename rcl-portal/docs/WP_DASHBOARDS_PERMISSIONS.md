# WP D: dashboards, registered-events, permissions screen

Ported off Supabase to `pg`. No migration was needed (existing indexes cover every aggregate).

## Server modules
- `src/server/dashboards/service.mjs`: all dashboard figures. Each figure is one SQL statement (scalar sub-selects / window `rank()` / `LATERAL`), run in parallel; no per-club loops, no paging. Reuses `payments` (`financeStats`, `clubFinance`), `checkin` (`dayStats`), `penalties` (`previewMembership`, `getPenaltyRules`, `penaltyFor`, `penaltyTarget`).
- `src/server/auth/permissions-admin.mjs`: list / search / set / remove admin levels.

## Routes (all `Cache-Control: no-store`)
| Route | Notes |
|---|---|
| `GET /api/admin/dashboard/optimized` | `stats`, `leaderboard`, `pendingRequests` (replacements + swaps, status 0), plus new `payments`, `checkin` (per day), `membership` (clubs under the penalty target). Query `leaderboard_category`, `leaderboard_limit` (validated). |
| `GET /api/admin/dashboard-stats` | club/player counts and `registeredClubs` (club is "registered" once it has a player; replaces the browser-side club/player download in `adminClubStatsService`). |
| `GET /api/admin/administration/stats` | totals, gender, individual vs team registrations (real join, no longer an estimate), `registrationsBySport`, `registrationsByClub`, payments, check-in, membership. |
| `GET /api/portal/dashboard`, `/api/portal/dashboard-stats` | one club, taken from the session (`resolveClubId`; a different `?club_id` is 403). Adds `membership` (share, target, deduction, applied penalty), `payments` (status counts + fee maths), `checkin` per day. Leaderboard defaults to the club's own category. |
| `GET /api/clubs/[clubId]/registered-events` | PUBLIC, contract kept key for key (see below). |
| `GET/POST/DELETE /api/admin/permissions` | administrator only. |
| `GET /api/admin/search-users` | now reads `rmis_members` (role 1-4) instead of the old external SQL endpoint; administrator only. |

## registered-events contract (citation-checklist app)
`data.club`, `data.summary.{event_count, eligible_events_count, raw_registered_events_count, registered_players_count, day_registered_players_count}`, `data.events[].{sport_id, sport_name, sport_day, sport_type, min_count, registered_player_count, day_registered_player_count, required_day_registered_count, eligible}`. A test pins the key lists and their order.
Decision: `event_count` = events where at least `participation.min_attendance_ratio` of the club's players registered in the event (main + reserve) have a day registration on the event's day, the same rule as participation points (exact decimal compare in SQL, so 0.7 x 10 works). It replaces the old `ceil(min_count/2)` rule. It applies to every sport type, including track events (participation points themselves exclude track). `required_day_registered_count` = `max(1, ceil(ratio x registered))`. If the ratio setting is missing/invalid the endpoint falls back to 0.5 rather than failing, because an external app consumes it. Events with no `sport_day` never count. Unknown club: 404; non-numeric id: 400.

## Permissions rules (enforced in `permissions-admin.mjs`, under one advisory lock, in one transaction)
- Only an administrator changes anything; the actor's level is re-read from the DB (a stale session token cannot act).
- Target must exist in `rmis_members` with role 1-4 (`member_not_found` 404, `not_admin_role` 422).
- Own level cannot go down or be removed (`self_demotion`, `self_removal`, 409); raising it or re-saving the same level is fine.
- The last administrator can never be demoted/removed (`last_administrator`); the lock also stops two administrators demoting each other simultaneously.
- Repeating the same change is a no-op (no audit row). Changes write `permission.set` / `permission.remove` to `audit_log` with from/to.
- List joins `rmis_members` for current names and orders strongest level first. Response also carries `self` so the UI disables "Remove" on your own row.
- The very first administrator must be inserted by SQL (`INSERT INTO permissions (member_id, permission_level) ...`); there is no UI path to bootstrap.

## Pages changed
- `src/app/admin/dashboard/page.jsx`, `src/app/portal/dashboard/page.jsx`: no jotai/cache-validity reuse any more; always fetch, re-poll every 30 s, category switch re-calls the dashboard endpoint (no dependency on the leaderboard route). New `src/components/LiveSummary.jsx` panels: payments, check-in per day, general-member share (with target).
- `src/app/admin/dashboard/administration/page.jsx`: shows the new panels and a registrations-per-sport table. Its "clean players" / "sync RMIS" buttons still call routes owned by other packages.
- `src/app/admin/dashboard/permissions/page.jsx`: `RMIS_ID` -> `member_id`; the per-row level selector now uses state (previously read the first select in the DOM, so it could grant the wrong level); only administrators pass the client check (as the server).
- `src/services/adminClubStatsService.js`, `adminServices.js`, `portalServices.js`: `cache: 'no-store'`; the portal services no longer send `club_id`.

## Tests
`node --test --test-concurrency=1 tests/dashboards.test.mjs tests/permissions-admin.test.mjs` (9 + 7). Ranges: clubs 9901-9904, members 960001+ (965001-965005 for permissions), events `__db_*`. `permissions-admin.test.mjs` temporarily parks real administrator rows (the last-administrator rule is global) and restores them in `after`.

## Manual browser QA
Admin dashboard (leaderboard Com/Institute toggle, panels, 30 s refresh), portal dashboard (rank, panels), administration stats page, permissions page (search, add with each level, remove, own row disabled, error toasts), and the citation-checklist app against `/api/clubs/<id>/registered-events`.
