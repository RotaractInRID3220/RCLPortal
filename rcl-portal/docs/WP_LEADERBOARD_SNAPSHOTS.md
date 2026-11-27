# WP6 (part): leaderboard, snapshots and the worker

## Goal
The public leaderboard must never show stale points (the old browser/TTL caching did). Public reads are cheap
(one row from `snapshots`), always revalidated, and a write is visible on the very next read.

## Freshness design
* `snapshots(key, version, data, data_hash, computed_at, source_version)`. One row per key, **`version` moves only when
  the content changed** (sha256 of the data), so it is the ETag. `computed_at` = last time it was verified.
* Migration `0009_snapshot_versions.sql`: table `data_versions` (counter per snapshot family) + statement-level triggers on
  `club_points`, `clubs`, `events` that bump the `leaderboard` counter **in the same transaction as the change**.
  `snapshots.source_version` = counter value the snapshot was built from.
* A snapshot is stale iff `source_version < counter` (or older than `LEADERBOARD_MAX_AGE_MS`, default 180 s, safety net).
  The counter commits with the data, so a snapshot can be older than the counter only when truly stale, never the reverse.
* `readFresh()` (used by every public endpoint): read snapshot + counter in one query; if stale, **rebuild inline**, then read.
  So even with the worker dead nothing stale is ever returned.
* Builder (`src/server/leaderboard/service.mjs`, `snapshots.mjs`): one SQL aggregate over `club_points` (all kinds incl.
  `penalty`) with `rank()` (ties share a rank, next rank skips) overall and per category; second query for the per-entry breakdown.
  Runs in one REPEATABLE READ transaction under a session advisory lock (single flight: concurrent callers wait, then find
  the work done). Writes a new version only if the hash changed; otherwise just touches `computed_at`/`source_version`.
* Snapshots: `leaderboard:all` (ranked clubs + `points_by_kind`) and `leaderboard:clubs` (map club_id -> breakdown).
* Clubs shown: status 1, or any club that has points.

## Endpoints (all existing paths, access policy unchanged)
| Route | Access | Notes |
|---|---|---|
| `GET /api/leaderboard/aggregated?category&limit&offset` | public | from snapshot; `ETag` + `Cache-Control: no-cache` (never max-age), 304 on `If-None-Match`; body adds `version`, `generated_at`; `rank` = rank inside the category when filtered; `university` accepted as alias of `institute` |
| `GET /api/leaderboard/club-details/[clubId]` | public | same headers; entries carry `kind`, `note`, sport info; old fields (`club`, `summary`, `sports_breakdown`, `raw_entries`) kept |
| `GET /api/club-points?sport_id&club_id&category&limit&offset` | public | live rows (not a snapshot, `no-store`) for the admin per-sport screen; capped at 1000 rows |
| `POST /api/club-points` | admin | **manual** points (`kind='manual'`): `club_id`, optional `sport_id`, non-zero integer `points` (-1000..1000), optional `place`, `note`; actor from session; audit `club_points.manual_add` |
| `DELETE /api/club-points?point_id=` | admin | only `manual` rows (409 otherwise: automatic kinds are fixed by re-running their award/penalty); audit `club_points.manual_delete` |

`club-points/award` (placement award) belongs to another package and is untouched; its writes bump the counter via the trigger.

## Worker (`scripts/worker.mjs`, `npm run worker`)
Own process, **direct** DB connection (`DATABASE_DIRECT_URL`, needed for LISTEN).
* snapshots: `LISTEN rcl_changed` (300 ms debounce) + 10 s fallback poll (cheap counter check) + forced re-verify every 60 s.
* RMIS change feed (`syncChangesOnce`): every `worker.rmis_changes_interval_s` seconds (optional setting, default 90, clamped 30..600, re-read each round; set it with SQL or the settings API, it is not in the admin registry on purpose); clubs sync hourly and once 5 s after start.
* RMIS jobs skip when `RMIS_API_URL/KEY` are unset. Jobs never overlap themselves and never crash the process; LISTEN reconnects with backoff; SIGTERM stops cleanly.
* Exports `runSnapshotsOnce`, `runRmisChangesOnce`, `runClubsSyncOnce`, `rmisIntervalMs`, `startWorker`.
* Deploy: second container with the same image/env, command `node scripts/worker.mjs`.

## Frontend
* `src/hooks/useLivePoll.js`: polls every 20 s while the tab is visible (and on becoming visible); no localStorage; shows "Updated hh:mm:ss".
* `fetch(..., { cache: 'no-cache' })` makes the browser send `If-None-Match` itself; no `_t=` cache busters.
* Ported: `PortalLeaderboard`, `[clubId]/page`, `EArenaPortalLeaderboard` (the public leaderboard), `ClubDetailsDisplay` (uses entry sport info, no `/api/events` call; shows penalty/manual rows), `LeaderboardPreview` (uses server rank), `leaderboardServices.js`, admin `ClubPointsForm`/`LeaderboardDisplay` (manual entries; automatic rows not deletable).
* Removed from `state/store.js`: the persisted `leaderboardDataAtom`/`clubPointsDataAtom` and their loading atoms.

## Decisions
* Counter+trigger rather than hashing alone: staleness check is O(1), exact, and survives a dead worker.
* Penalties are just `kind='penalty'` rows in totals (applied once by the admin before the final announcement).
* Manual points replace the old "10-99 double digit" form rule; negatives allowed for adjustments.
* No new public routes (no `/api/public/*`), so `access-policy.mjs` and its test needed no change.

## Tests
`tests/leaderboard.test.mjs` (12 tests): ranking with ties, every kind + penalty, category filter/alias/pagination, club details,
read-your-write, trigger bumps, version only on change, rebuild only on change, concurrent builds (single flight, one bump; run on an
isolated `lbtest` family so parallel agents can't disturb counts), concurrent readers, ETag/304/no-cache, manual add/delete + audit,
worker runOnce.

## Manual browser QA
* `/e-arena/leaderboard` and `/portal/dashboard/leaderboard` (+ `/[clubId]`): add points as admin in another tab; the board must update within ~20 s, "Updated" time advances, network shows 304s while idle.
* Admin `/admin/dashboard/leaderboard/[sportid]`: add a manual entry (incl. negative), delete it; automatic rows have a disabled delete button.
* Portal and admin dashboard home still use `/api/admin/dashboard/optimized` / `/api/portal/dashboard` (other packages) and their own jotai caches for the preview widget.

## Not done / left to others
* Bracket/tournament data (`/api/brackets`, `/api/games`, bracket pages) still on Supabase: belongs to the tournaments package; when ported they can use `rebuildFamily` with a `bracket:<sport>` snapshot and a `data_versions` family.
* `/api/leaderboard/tournament-standings`, `club-points/award`, track-events award: other agents.
