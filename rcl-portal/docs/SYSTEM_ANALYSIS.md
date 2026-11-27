# RCL Portal – System Analysis, Query Catalog & Risk Audit

Date: 2026-11-24. Scope: `rcl-portal/src` (Next.js 15, NextAuth v4, Supabase JS with the anon key, DBMID external API).
Method: four parallel read-only code audits (auth/players, registrations/payments, replacements/penalties, tournaments/public), with the top claims spot-checked by hand. Line numbers are approximate and relative to `rcl-portal/src`. Re-verify before editing.

Scale: 90+ clubs, 1500+ registered players, 2000+ public visitors. Moving from Supabase to self-hosted Postgres.

---

## 1. Executive summary (read this first)

| # | Issue | Severity |
|---|---|---|
| 1 | **No server-side auth on any API route.** There is no middleware and no `getServerSession`/`getToken` anywhere under `app/api`. `PrivateRoute` is a client-side UI guard only. Anyone with the URL can approve payments, apply penalties, award points, edit matches, delete teams, toggle the portal, or POST `/api/admin/permissions` to make themselves super_admin. | Critical |
| 2 | **Penalties are not idempotent** (`api/admin/apply-membership-rules/route.js` ~L66). Every POST inserts a new -25/-50/-80 `club_points` row. There is no unique key and no "applied" marker. The confirm dialog action isn't disabled while running, and the handler first runs *clean* + *sync*, which take many seconds. A double-click, retry, or two admins stack penalties. This is the most likely cause of the earlier penalty bug. | Critical |
| 3 | **`/api/players/clean` can delete registered players.** The global call selects `players` and `registrations` with no `.range()`, so both are capped at 1000 rows. Players whose registrations fall past the cap look unregistered and get deleted. `.in()` with about 1000 ids also risks a URL length failure. The Apply Rules flow calls this first. | Critical |
| 4 | **Identity and rules come from the browser.** `club_id`, `RMIS_ID`, member data (gender, status, NIC), `approved_by` and `admin_id` come from the request body. Window, max/reserve counts, gender, category and day limits are enforced only in client code. `POST /api/registrations` checks none of it. | Critical/High |
| 5 | **1000-row cap hits many reads** (§5). This includes the leaderboard fallback, the admin registrations list (it requests `limit:5000`, which Supabase caps at 1000), player-numbers export, gender stats, day registrations, `sync-rmis`, and `club_points` sums. Totals and rankings silently go wrong. | High |
| 6 | **Races and non-atomic multi-step writes.** No unique constraints exist on `registrations(RMIS_ID, sport_id)`, `day_registrations(RMIS_ID, sport_day)`, `teams(club_id, sport_id)` or pending requests. Approve/reject/swap/replace/award flows are several separate writes with no transaction and no `status IS NULL` guard. | High |
| 7 | **PII exposure.** The public `/player` pages and `/api/players/search` return NIC (national ID) and allow `ilike` search over it. `/api/council?clubID=` dumps full member rows with no auth. DBMID auth logs the MD5 password hash. The DBMID API key is exposed under a `NEXT_PUBLIC_` name. | High |
| 8 | **Public pages are uncacheable and N+1.** Every public request hits Postgres (`no-store`, `_t=Date.now()`). The schedule hub makes about N+2 calls. 2000 visitors is roughly 88k queries. | High |

---

## 2. Architecture & where logic lives

- **Auth**: `api/auth/[...nextauth]/route.js` is a Credentials provider (admin-credentials and portal-credentials). It posts SQL to DBMID, compares an MD5 password, and stores the whole member row in the JWT, the session, and localStorage (jotai store). The JWT lasts 24 h, so `permission_level` can go stale. Gating is `lib/PrivateRoute.jsx` (client). Roles seen: `admin`, `super_admin`, `administrator` (check this one exists).
- **DB access**: every API route uses one anon-key client (`lib/supabaseClient.js`). Several admin pages and services also create browser-side clients and write directly (`matches` updates from the bracket pages, `adminClubStatsService`, `configService`). RLS must be open to anon, or these would fail.
- **Rules/business logic**:
  - Registration eligibility lives in the browser: `registration/[sportid]/page.jsx` and `services/registrationService.js` (`playerConstraintChecks`).
  - Penalties: `api/admin/apply-membership-rules`, with the tier table duplicated in `membership-management/page.jsx`.
  - Bracket advancement: browser, in `admin/dashboard/bracket/[sportid]/page.jsx`.
  - Standings: server, `api/leaderboard/tournament-standings`.
  - Points: `api/club-points/award`, `api/track-events/award`, `api/admin/participation-points/award`.
- **Config**: dates and constants are hard-coded in `config/app.config.js`, and they're stale (all 2025). `CURRENT_SPORT_DAY` is `D-03` and drives day check-in and participation awards.
- **Realtime**: Supabase Realtime is used for `portal_settings` (`configService.js`) and `matches` (the bracket pages). It won't exist on plain Postgres.
- **Storage**: payment slips go to a public Supabase Storage bucket (`api/payment-slips/upload`).

### Feature → handler map

| Feature | Handlers |
|---|---|
| Player registration | `portal/dashboard/registration/**` → `registrationService.js` → `POST /api/players` + `POST /api/registrations` |
| Day check-in | `admin/dashboard/register/**` → `POST /api/day-registrations` |
| Teams | `api/teams` (bulk create counts main and reserve against `min_count`), `teams/available-clubs`, `teams/non-eligible` |
| Payments | `portal/dashboard/payment` → `api/payment-slips(/upload)`; admin `api/admin/payments/**` (total = players × Rs.800) |
| Replacements | `api/portal/replacements` (create) → `api/admin/replacements/{approve,reject}`; admin direct: `api/admin/player-changes` |
| Swaps/moves | `api/portal/swaps` → `api/admin/swaps/{approve,reject}`; admin direct: `player-changes` |
| Penalties | `membership-management` page → clean → sync-rmis → `apply-membership-rules` |
| Participation points | `api/admin/participation-points` (+ `/award`, `/[clubId]`); 50% attendance, 15 pts per sport |
| Brackets/matches | `api/games` (CRUD, no validation), `api/brackets`, plus browser writes. Matches are hand-entered. There is no generator. |
| Standings and points | `tournament-standings` → admin leaderboard page → `club-points/award` (trusts client numbers); `track-events/*` |
| Leaderboard (public) | `api/leaderboard/aggregated`, `club-details/[clubId]` |
| Player numbers | `api/admin/player-numbers/**` (number = sport_day + padded registrations.id) |

---

## 3. External API catalog (DBMID: `https://info.rotaract3220.org/api/query`)

It is the only external data host. It accepts a **raw SQL string** guarded by one API key (`NEXT_PUBLIC_DBMID_API_KEY`). It has 6 server-side call sites and none has a timeout, retry or cache.

| Call site | Purpose | Data taken | Stored/used where |
|---|---|---|---|
| `api/auth/[...nextauth]/route.js:21` | Login | member row (id, name, club, status, password MD5, etc.) | JWT, session, localStorage |
| `api/auth/validate/route.js:18` | Credential validation (dead code, unused) | same | none |
| `api/council/route.js:26` | `?clubID=` club member list | RMIS id, name, NIC, DOB, gender, status, club, `created_datetime`. Filter `status IN (1,3,5) AND created_datetime <= MEMBERSHIP_CUTOFF_DATE`; status 3 mapped to 1 | portal side nav (every portal page), registration pages, replacements, admin lists. Not persisted until registration copies the row into `players` |
| `api/council/route.js:68` | `?username&password` | login check (MD5, via query string) | logs the user row at L87 |
| `api/players/sync-rmis/route.js:51` | Refresh `players.status` etc. | status for all player ids (one huge `IN` list, status 1/3/5, no cutoff) | per-player UPDATE on `players` |
| `api/admin/search-users/route.js:14` | Admin user search | member fields | permissions UI |

Related internal fan-out: `api/portal/replacements`, `api/admin/replacements` and `[id]` call `/api/council` over HTTP per club, through `NEXT_PUBLIC_BASE_URL`, which isn't set in `apphosting.yaml`. Use a shared function call instead.

**Data copied locally from the external source**: `players` (RMIS_ID, RI_ID, name, club_id, NIC, birthdate, gender, status), populated at first registration or replacement from client-supplied data, and refreshed by sync-rmis. `players.status` (1 general, 5 prospective, 3 normalised to 1) drives the penalty percentage.

---

## 4. Supabase/Postgres query catalog (condensed by table)

"PL" = per page load. "ACT" = per user action. Large tables: players (1.5k+), registrations (several k), club_points (about 90 × events, 3k+), matches, track_events, day_registrations.

**registrations**
- `GET /api/registrations`: `select *` with arbitrary client filter keys, no limit (PL, plus twice per register click).
- `POST`: select by (RMIS_ID, sport_id) via `maybeSingle`, then insert with the client's club_id. DELETE by (RMIS_ID, sport_id) with no window or ownership check.
- `PUT` writes non-existent columns (`status`, `converted`, ...) and always errors.
- `with-players`: joins players, clubs and events. The admin list requests `limit:5000`, which is capped at 1000, and search, unique and export all run client-side.
- player-numbers list and export: joins, no limit when not searching (capped).
- `day-stats`: 4 days × 2 paged loops, no `ORDER BY`.
- teams: paged without `ORDER BY`.
- `teams/non-eligible` and `available-clubs`: select all registrations for the sport, then `players.in(RMIS_ID, ids)`.
- portal dashboard and dashboard-stats: 2 to 4 scans per load.

**players**
- Insert and select by id (`api/players`).
- Search `.or(name|NIC|RMIS_ID ilike %x%)` with a count. The input is concatenated into the filter, `limit` is unclamped, and NIC is returned.
- `[rmisId]` returns NIC.
- sync-rmis selects all (capped at 1000) and does `Promise.all` single-row updates.
- clean: selects all, then `registrations.in(ids)`, then `delete.in(...)`.
- membership-data and apply-membership-rules: one `select RMIS_ID, status` per club (about 90 sequential queries).
- stats: `select gender` over all rows (capped), plus count queries.
- `adminClubStatsService` does a browser select of all `club_id`s (capped).

**clubs**
- `select *` is served to the client, which then `.find`s one club (`getClubByClubId`, on every registration page).
- Embeds `club_points(points)` as a left join on the dashboard and leaderboard routes (4 to 6 round trips per portal dashboard load).
- `PUT /api/clubs` filters on `id`, which doesn't exist (`club_id` does).

**events**: `select *` with a default limit of 100 (`getAllEvents` sends none), called on most pages (jotai cached 2 min). Insert is unauthenticated.

**teams**: insert and delete with no auth. The delete fails with a 500 if matches or track_events reference the team.

**matches**
- `api/games` does CRUD with a raw-body insert, no validation, and no parent-reference check on delete.
- `api/brackets` runs one join per sport.
- Browser-direct reads, writes and realtime on the bracket pages. Each score change makes every connected client refetch the full join.
- `tournament-standings` loads all matches for a sport.

**club_points** (row kinds mixed with no discriminator)
- Placement: sport_id set, place 1 to 3.
- Participation: sport_id set, place -1 to -4.
- Track: via track award.
- Penalty: sport_id NULL, place NULL, points -25/-50/-80.
- `award` is an UPDATE keyed on (sport_id, club_id) with client-supplied points and place.
- `track-events/award` does DELETE WHERE sport_id then a bulk INSERT as two separate calls.
- Leaderboard sums via an embedded left join, plus a fallback `select club_id, points` with no range.

**track_events**: sync is delete-all then re-insert, which changes every id. The code uses `RMIS_ID`, but db.sql says `rmis_id` (verify against the live schema).

**payment_slips**
- Admin list with `.ilike('clubs.club_name')`, which doesn't filter (no `!inner`). Search is not debounced.
- `club-details` paid amount is always 0 (wrong destructure).
- `clubs-summary` and `stats` load all slips and players, paged without `ORDER BY`.
- Approve and reject have no `status IS NULL` guard.

**day_registrations**: single-check then insert with no unique key. Admin view `select` with no limit, then `registrations.in(all ids)` (capped, long URL).

**replacement_requests, replacement_players, swap_requests**: see §6. Approve and reject have no status guard. The `replacement_players` upsert overwrites the shared profile. The admin list filters search in memory after pagination, and the swaps `search` param is ignored.

**portal_settings**: select on every day-registration POST, upsert on PATCH (no auth), and a Realtime subscription from the browser.

**app_config**: used by `configService` from the browser. The table isn't in db.sql. Upserts run in a loop.

**permissions**: GET, POST and DELETE all unauthenticated.

---

## 5. 1000-row-limit hit list (fix all of these before or during migration)

| Where | Effect |
|---|---|
| `players/clean` (players + registrations) | Deletes registered players (critical) |
| `leaderboard/aggregated` (fallback and embeds), `portal/dashboard*`, `admin/dashboard/optimized` | Wrong totals, rank and penalty sums |
| `registrations/with-players` (`limit:5000`) | Admin list, export and unique view cut to 1000 |
| `admin/player-numbers` list and export | Cut |
| `admin/administration/stats` (players.gender) | Counts capped |
| `adminClubStatsService` (browser) | Registered-clubs undercount |
| `admin/day-registrations` | Cut |
| `players/sync-rmis` | Only the first 1000 players synced |
| `GET /api/registrations` unfiltered, `teams` GET | Latent |
| `events` default limit 100 | Latent |

On self-hosted Postgres there is no PostgREST cap. Raw `pg` removes it, but **don't swap the driver and leave the unbounded `SELECT *`s**. Replace them with SQL aggregates (`GROUP BY`, `SUM`, `RANK()`), keyset pagination for exports, and `ORDER BY` in every paged loop.

---

## 6. The penalty bug and related logic

**Flow** (`membership-management/page.jsx` → `handleApplyRules`): global clean → sync-rmis → `apply-membership-rules`.

Tiers (general % = status-1 players ÷ all `players` rows of the club; `<5` players gives 0): `70+` → 0, `67–<70` → -25, `62–<67` → -50, `<62` → -80. The tier table is duplicated in the route and the page. A brute-force check of float vs integer comparison found no rounding bug.

Problems:
1. **Not idempotent** (above). Fix: a `kind`/`penalty_type` column on `club_points` (or a separate `club_penalties` table) and a partial unique index, e.g. `UNIQUE(club_id) WHERE kind='membership'`. Implement as one SQL function that **sets** the value (`ON CONFLICT ... DO UPDATE`) instead of adding to it. Disable the dialog action while running, show "applied at", and add a revoke.
2. **Failures are swallowed.** A failure in clean or sync is toasted but the penalties are still applied on stale data. A club whose players query fails is skipped, yet the response says `success: true`. The two helpers should throw, or the whole run should be one transaction.
3. **Stale/wrong denominators.**
   - sync-rmis has no cutoff (`/api/council` does).
   - Replaced-out players keep their `players` row until clean runs, so run order changes the percentage.
   - The status of a new replacement player is client-supplied. Replacement approve never updates `club_id`/`status` for an existing player row.
   - The denominator counts all club players, not only registered ones. Confirm that's the intended rule.
4. **Participation points idempotency breaks.** `club-points/award` overwrites participation rows to place 1 to 3, so the `place = -N` dedup check no longer matches. Re-awarding inserts duplicate 15-point rows. `track-events/award`'s `DELETE WHERE sport_id` also wipes participation rows. Fix: a `kind` column, `UNIQUE(club_id, sport_id, kind)`, and `ON CONFLICT`.
5. **Preview and award disagree.** The participation GET doesn't exclude track sports, and award does. The GET fires about 270 queries per page load. `alreadyAwarded` is true if any one sport was awarded.
6. `leaderboard/club-details` groups penalty rows (NULL sport_id) under "null" (NaN) and may select a non-existent `sports` relation.

---

## 7. Other findings by area

### Replacements / swaps (§C of audit)
- Approve and reject have no status guard. A reject can flip an approved request, and two admins approving at once both pass. Fix: `UPDATE ... WHERE id=$1 AND status IS NULL RETURNING *` inside a single Postgres function (`approve_replacement`, `approve_swap`, ...) with `SELECT ... FOR UPDATE`.
- Swap approve uses the stored `sport1_id`/`sport2_id`, not the registrations' current sports, and doesn't re-check day conflicts, gender or capacity. A half-applied swap (reg1 moved, reg2 failed) is possible.
- Admin direct swap/move skips day-conflict and pending-request checks, and a log-insert failure still returns success.
- The replacement window (`REPLACEMENT_OPENING/DEADLINE`, both in 2025) is enforced only by hiding the form. The API accepts requests any time, and `club_id` is trusted from the request.
- Double-submit creates two pending requests, after which `.maybeSingle()` returns a 500 and blocks that registration.
- Partial unique indexes: `replacement_requests(registrations_id) WHERE status IS NULL`, and the same for swap requests.

### Registrations / payments / teams (§B)
- Bugs: `club-details` paid is always 0, admin payments search doesn't filter, `PUT /api/registrations` and `PUT /api/clubs` hit non-existent columns, pending-requests count is a hard-coded 10 or always 0 (boolean compared with `'pending'`).
- Team eligibility counts main and reserve players toward `min_count`, and `available-clubs`/`non-eligible` re-implement the same counting. Replace with one `GROUP BY club_id` query.
- Player numbers use the global `registrations.id`, so a deleted-and-re-added registration gets a new number. Lookup uses `ilike` with user text, and `.single()` errors on duplicate NICs.
- Slip upload takes its extension and MIME type from the client, uses a public bucket and predictable names, and takes `club_id` from the form (IDOR on slips).
- Registering a player is about 8 queries over 5 requests, and `registrationService` re-downloads all events.
- `getClubByClubId` downloads all clubs on every registration page.

### Tournaments / public (§D)
- Winners advance only if **both scores > 0** (a 1–0 or 3–0 win never advances) and the toast still says success. There is no un-advance when a score is corrected, and the mobile admin has no advancement at all.
- Editing a match from the desktop dialog **wipes its parent links** (the transformed seed lacks `parent_match*_id`, then `PUT` sends nulls).
- `matches.team*_score` is `text`, so comparisons are lexicographic (`"10" > "9"` is false) in the winner highlight.
- Standings: a tie goes to team2, only the first finals is used, and ranks 5 and below come from points scored.
- Dates are formatted in the server's timezone (UTC on Cloud Run), then re-parsed by the client.
- `club-points` category filter doesn't filter (needs `clubs!inner`).
- `award` silently no-ops with zero participation rows and clobbers multiple rows.
- Dead code: `components/MatchesList.jsx` (imports modules that don't exist), `MatchCard`, `LeaderboardPreview`, `POST /api/brackets`, `/api/auth/validate`, `getConfig/updateConfig`.

### Auth / players (§A)
- `/api/admin/permissions` (POST/DELETE) is open, so anyone can grant themselves super_admin. `players` PUT, `portal-status` PATCH and `apply-membership-rules` are also open.
- Passwords are unsalted MD5, with no rate limit or timing-safe compare. `?username&password` goes through the URL. The row (with the hash) is logged at `council/route.js:87`.
- The full member row sits in the JWT and localStorage.
- `POST /api/players` trusts client `club_id` and `status`.
- sync-rmis reports success even when updates fail, and the UI shows "undefined → undefined" (`players/page.jsx:120`).

---

## 8. Public-page load (2000+ visitors)

All public pages are client components calling uncached APIs.

| Page | Calls per view | Cacheable today? |
|---|---|---|
| `/e-arena/leaderboard` | 1 (`clubs` + all `club_points` summed in JS) | No (`no-store` and `_t=Date.now()`) |
| `/e-arena/schedule` | `/api/events` + `/api/brackets` (result unused) + one `/api/brackets?sport_id=X` per sport card, about N+2 | No |
| `/e-arena/schedule/[id]` | 2 | No, and not refreshed despite the "real-time" copy |
| `/player`, `/player/[id]` | 1 per search/view (`ilike '%x%'`, NIC returned) | No |

Recommended order (the biggest wins first):
1. Cache headers plus a CDN in front: brackets and events `public, s-maxage=15, stale-while-revalidate=60`; leaderboard `s-maxage=60, swr=300`. Remove the `_t` param and the `no-store` request headers.
2. Add a single `/api/schedule/summary` (sports with their latest matches via a lateral join). This removes the N+1.
3. A server-side TTL cache with single-flight (or `unstable_cache` + `revalidateTag` from score writes).
4. A `club_leaderboard` view or materialized view (`SUM` + `RANK() OVER (PARTITION BY category)`).
5. Indexes plus PgBouncer. Cloud Run can fan out to 100 instances × 100 concurrency, and Postgres will be the bottleneck.
6. For live updates, poll the cached endpoint every 15 to 30 s instead of per-client realtime plus refetch.

---

## 9. Migration checklist (Supabase → self-hosted Postgres)

**Replace Supabase-specific features**
- PostgREST embeds (`!inner`, `!left`, FK-hinted aliases) become JOINs. `count:'exact'` becomes `count(*)`. PGRST116 handling becomes `rows[0]`.
- Realtime (`portal_settings`, `matches`): use polling, SSE, or `LISTEN/NOTIFY`.
- Storage (payment slips): MinIO/S3 or disk with signed URLs. Use a private bucket, UUID names, and a MIME whitelist.
- Remove browser-side DB clients and the `NEXT_PUBLIC_SUPABASE_*` usage. The web tier gets a least-privilege role (and a SELECT-only role for public reads). Writer credentials stay server-only.
- Rename `NEXT_PUBLIC_DBMID_API_KEY` to a server-only name.
- Verify the live schema: `track_events.rmis_id` vs `RMIS_ID`, and whether `app_config` exists. Check the case of `RMIS_ID` columns.

**Constraints to add (dedupe first)**
```sql
ALTER TABLE registrations     ADD CONSTRAINT uq_reg     UNIQUE ("RMIS_ID", sport_id);
ALTER TABLE day_registrations ADD CONSTRAINT uq_dayreg  UNIQUE ("RMIS_ID", sport_day);
ALTER TABLE teams             ADD CONSTRAINT uq_team    UNIQUE (club_id, sport_id);
-- club_points: add kind ('placement'|'participation'|'track'|'penalty'), then
-- UNIQUE (club_id, sport_id, kind) WHERE sport_id IS NOT NULL, and UNIQUE (club_id) WHERE kind='membership'
CREATE UNIQUE INDEX one_pending_replacement ON replacement_requests(registrations_id) WHERE status IS NULL;
-- same idea for swap_requests player1/player2_registrations_id
-- NOT NULL on registrations.RMIS_ID/sport_id/club_id; FKs: day_registrations.RMIS_ID, matches.parent_match*_id
-- matches.team1_score/team2_score -> integer (NULL = not played) + completed flag
```

**Indexes**
```sql
CREATE INDEX ON registrations (sport_id, club_id);
CREATE INDEX ON registrations (club_id);
CREATE INDEX ON players (club_id);
CREATE INDEX ON players (upper("NIC"));        -- and pg_trgm if ilike '%x%' search stays
CREATE INDEX ON day_registrations (sport_day);
CREATE INDEX ON events (sport_day);
CREATE INDEX ON events (category, sport_type);
CREATE INDEX ON clubs (category);
CREATE INDEX ON payment_slips (club_id, approved);
CREATE INDEX ON payment_slips (approved, date DESC);
CREATE INDEX ON club_points (club_id);
CREATE INDEX ON club_points (sport_id, club_id);
CREATE INDEX ON teams (sport_id);
CREATE INDEX ON track_events (sport_id);
CREATE INDEX ON matches (sport_id, round_id, match_order);
```
Define `ON DELETE` rules (`replacement_requests` and `swap_requests` currently block registration deletes with a 500).

**Move multi-step logic into Postgres functions (one transaction each)**: `register_player` (lock the event row, count, check the window with DB `now()`, insert), `approve_replacement`, `reject_replacement`, `approve_swap`, `admin_replace_player`, `admin_swap_players`, `save_match_score_and_advance`, `award_participation_points`, `award_tournament_points`, `apply_membership_penalties`, `clean_unregistered_players` (a single `DELETE ... WHERE NOT EXISTS`).

**Aggregate in SQL**: payments summary, day stats, gender and club stats, membership stats (`count(*) FILTER (WHERE status=1)`; integer math `k*100 >= 70*n`), team eligibility counts, and the leaderboard.

---

## 10. Recommended work order

**P0 (before the event / before any data migration)**
1. Server-side auth: `middleware.js` with NextAuth `getToken` (`/api/admin/**` needs an admin role, portal routes need a session). Derive club, RMIS_ID and actor from the session, never from the body. Lock `permissions`, `portal-status`, `apply-membership-rules`, `clean`, `council`.
2. Make penalties idempotent (§6) and disable the dialog button while it runs.
3. Fix or disable `players/clean` global mode (SQL `NOT EXISTS`), and paginate or aggregate every item in §5.
4. Add the unique constraints and indexes (§9).
5. Remove NIC from the public player pages and search, clamp `limit`, and drop the password logging.

**P1**
6. Transactional approve/reject/swap/replace/award functions with status guards.
7. Server-side enforcement of registration rules and windows, with dates moved from `app.config.js` into the DB (explicit timezone, `Asia/Colombo`). Make `CURRENT_SPORT_DAY` an admin setting.
8. Cache headers, the schedule summary endpoint, and the leaderboard view.
9. Fix the bracket logic: score 0 means "not played", the edit wipes parent links, no un-advance, and integer scores.

**P2**
10. Fix the dashboard and payment bugs (`club-details`, search, pending count, `clubs` PUT, `registrations` PUT).
11. Remove dead code, dedupe the round map and penalty tier table, move fonts to `next/font`, and replace the self-HTTP calls with function calls.
12. Replace Realtime and Storage dependencies.
