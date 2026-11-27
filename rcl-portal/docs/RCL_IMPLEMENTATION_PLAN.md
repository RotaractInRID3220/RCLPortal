# RCL Portal: Implementation Plan (RCL side)

Date: 2026-11-24. Status: draft for execution.
Audience: whoever builds RCL (owner and any assisting agents). This is the **task-level** plan. Background and reasoning live in:
- `SYSTEM_ANALYSIS.md`: bugs/risks found in the current code (IDs like C-1, F-04 refer to it).
- `RMIS2_INTEGRATION_AND_POSTGRES_PLAN.md`: architecture, schema ideas, caching/workers, hosting.
- RMIS-2 repo `docs/RCL-API-USAGE.md` (branch `rcl-version`): **the authoritative RMIS API contract**. It supersedes §2/§3 of the plan doc above.

## 0. Decisions in force

| Topic | Decision |
|---|---|
| Season | Fresh season. No registration/points/payment data migrates. |
| Host | OVH VPS (Germany) with Dokploy. Firebase is not used. |
| Data layer | Self-hosted Postgres, server-side only. PgBouncer in front. Worker container for snapshots and sync. |
| Auth | Login is **username + password verified by RMIS 2.0** (`POST /auth/verify`). RCL never sees a hash. |
| Access | RMIS `role_id` 1–6 = portal, 1–4 = admin. Fine-grained admin level (`admin`/`super_admin`/`administrator`) stays in RCL's `permissions` table, keyed on `member_id`. |
| Member key | **`member_id` (RMIS `table_id`)** everywhere. `membership_id` is display-only and may be null (test accounts). Never use it as a key or in QR codes. |
| RI number | Typed in RCL for general members (status 1 or 3), enforced server-side. |
| Cutoff | RMIS `created_at` via `createdOnOrBefore`. Date is an RCL setting. |
| Gender | Only `M`/`F` registrable. |
| Attendance rule | Team events count when ≥ 50% of the club's registered players (reserves included) have a day registration. Individual: the registered player. |
| Caching | Versioned snapshots + workers + ETag/`no-cache`. No localStorage caching of live data. |

Corrections to earlier docs (so nothing stale is built):
- Legacy QR resolution by `membership_id` and the `membership_id → table_id` backfill are **not needed** (fresh season).
- RMIS list responses are wrapped (`{members, next_cursor}`, `{clubs}`); `members/{id}` is a bare object; the cutoff parameter is `createdOnOrBefore`; `role_id` is included; `client_ip` is required on login.
- `zone` from `/clubs` is lossy (`"1A"` → `1`). RCL does not use it. Ignore it.

## 1. Work packages (WP)

Sizes: S ≤ 1 day, M ≈ 2–4 days, L ≈ 1–2 weeks (one developer, rough, to be re-estimated).

### WP0: Repo cleanup and foundations  (S)
- Delete Firebase artifacts: `apphosting.yaml`, `firebase.json`, `.firebaserc`, `DEPLOYMENT.md`, deps `firebase`, `firebase-tools`.
- Remove dead code: `app/api/auth/validate`, `components/MatchesList.jsx`, `MatchCard.jsx`, `LeaderboardPreview.jsx`, `POST /api/brackets`, `services/configService.js` (Realtime/`app_config`), unused `getConfig/updateConfig`.
- Environment contract (server-only, none `NEXT_PUBLIC_`): `DATABASE_URL` (pooled), `DATABASE_DIRECT_URL` (migrations + worker), `RMIS_API_URL`, `RMIS_API_KEY`, `RCL_INBOUND_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `S3_*`, `SENTRY_DSN`. Delete `NEXT_PUBLIC_DBMID_API_KEY`, `NEXT_PUBLIC_SUPABASE_*`.
- Dockerfile (multi-stage, non-root, `output: 'standalone'`), `.dockerignore`, CI to build and push an image (never build on the VPS), `docker-compose` for local dev (Postgres, PgBouncer, MinIO).
- Convert key settings out of `config/app.config.js` into DB settings (see WP1). Keep only true constants (fee default, point values) in code.
- **Done when:** repo builds in CI, image runs locally with compose, no Firebase/Supabase references remain.

### WP1: Database schema v2  (M)
- Tooling: SQL migrations in git (drizzle-kit or plain numbered `.sql`), run with `DATABASE_DIRECT_URL`.
- Tables (snake_case, `timestamptz`, integer scores): `clubs`, `players` (PK `member_id`, `membership_id` nullable text, `ri_id`, `name`, `club_id`, `nic`, `birthdate`, `gender`, `status`, `converted`, `converted_by`), `events`, `registrations`, `day_registrations`, `teams`, `matches` (int scores, `completed`, FKs on parents), `track_events`, `club_points` (+`kind`), `payment_slips`, `replacement_players`, `replacement_requests`, `swap_requests`, `permissions` (`member_id`, `permission_level`), `settings` (key/value/jsonb + `updated_by`), `snapshots`, `rmis_members` (mirror, WP3), `audit_log`.
- Constraints and indexes from plan doc §4.3 (unique `(member_id, sport_id)`, `(member_id, sport_day)`, `(club_id, sport_id)`; one pending request per registration; unique points per `(club_id, sport_id, kind)`; one penalty per club; NOT NULLs; FKs with explicit `ON DELETE`).
- Roles: `rcl_app` (DML), `rcl_ro` (public reads), `rcl_migrator` (DDL), worker uses `rcl_app`.
- SQL functions (transactional, locked, idempotent) as listed in plan doc §4.4. Create the signatures now, implement as each domain is ported (WP5).
- Settings seeded: `registration_open_at`, `registration_close` (per event stays on `events`), `replacement_open_at/close_at`, `membership_cutoff` (timestamptz), `current_sport_day`, `registration_fee`, `portal_open` (day check-in flag).
- Seed script for dev/staging (fake clubs, events, players) and a test-data generator for load tests (90+ clubs, 1500+ players).
- **Done when:** fresh DB created from migrations only; constraint tests prove duplicates are rejected; seed + generator run.

### WP2: Data access layer  (L)
- `src/server/db.js`: one `pg` Pool (`max` 5–10 per replica), helper `query`, `tx(fn)`, typed row mappers; no browser access to the DB.
- Port routes **by domain**, keeping the HTTP response shapes so React pages need minimal change. Each route also gets WP4's auth guard in the same change.

| Order | Domain | Routes/services to port |
|---|---|---|
| 1 | Players/registrations | `api/players/**`, `api/registrations/**`, `services/registrationService.js`, `playerService.js` |
| 2 | Clubs/events/teams | `api/clubs/**`, `api/events`, `api/teams/**`, `services/clubServices.js`, `teamServices.js`, `sportServices.jsx` |
| 3 | Payments | `api/payment-slips/**`, `api/admin/payments/**`, MinIO upload |
| 4 | Changes | `api/portal/replacements`, `api/portal/swaps`, `api/admin/replacements/**`, `swaps/**`, `player-changes` |
| 5 | Points/penalties | `api/admin/apply-membership-rules`, `membership-data`, `participation-points/**`, `club-points/**`, `track-events/**` |
| 6 | Tournaments | `api/games`, `api/brackets`, `api/leaderboard/**`, bracket pages' direct writes |
| 7 | Day check-in / player numbers | `api/day-registrations`, `api/admin/day-registrations`, `api/admin/player-numbers/**`, `config/portal-status` |
| 8 | Dashboards/stats | `api/portal/dashboard*`, `api/admin/dashboard*`, `administration/stats`, `adminClubStatsService.js` |

- Remove: `lib/supabaseClient.js`, every `@supabase/supabase-js` import, Realtime subscriptions (`configService`, bracket pages), browser-side writes.
- Rewrite PostgREST idioms using the table in plan doc §5.3 (explicit JOINs, parameterised `ILIKE`, `count(*)`, `rows[0]`, `= ANY($1)`, keyset pagination).
- **Status (version-2):**
  - **Done (domains 1-2 partly):** players, registrations, events (list/create), clubs (list + sync from RMIS), the RMIS member mirror and sync, the public QR lookup, the club players page, club registrations pages, admin registrations list. Server code: `server/registration/service.mjs`, `server/rmis/mirror.mjs`, `server/events/service.mjs`; routes under `app/api/{registrations,players,events,clubs,portal/members,portal/registration-status}`.
  - **Also ported:** payments (private slip storage with local/S3 drivers, one-request upload, approve-once state machine, money computed in SQL from the fee setting; portal + admin pages) and teams (eligibility counted in SQL, idempotent bulk create, manual override, safe delete; admin-only). Tests: `tests/payments.test.mjs`, `tests/teams.test.mjs`.
- **Penalties ported (the original stacking bug is fixed):** `server/penalties/{rules,service}.mjs`, routes `api/admin/{membership-data,apply-membership-rules}`, page `admin/dashboard/membership-management`. Apply is one atomic, locked, idempotent "set" (one penalty row per club, unique index), steps: RMIS refresh (abort if it fails) -> clean unregistered players -> set penalties from the `penalty.tiers` / `penalty.min_players` settings; revoke per club or all; super_admin only; every run audited. The club players page target share now comes from the tiers. Tests: `tests/penalty-rules.test.mjs`, `tests/penalties.test.mjs` (includes the stacking regression and 8 parallel applies).
- **Participation points ported (same stacking flaw fixed):** `server/participation/service.mjs`, routes `api/admin/participation-points/**`, both pages (with a day selector). Eligible = at least `participation.min_attendance_ratio` of the club's registered players (main + reserve) checked in on the sport's day; team/individual sports only (track events have their own points). Stored as `kind='participation'` rows under a unique key, so repeating an award never duplicates and a tournament placement never overwrites it. Award is super_admin only.
- **Replacements, swaps and moves ported:** `server/changes/service.mjs` (+ `shape.mjs`). Club requests only inside the replacement window (`replacement.open_at/close_at`, unset = closed); admins approve/reject (replacements need super_admin, swaps admin) or change directly (administrator level, no window). One set of checks for all paths: club ownership, eligibility/cutoff, gender, category, the per-player limits, capacity; approval re-checks against current data and refuses stale requests; a request is decided once under a row lock; apply + record happen in one transaction. Routes `api/portal/{replacements,swaps}`, `api/admin/{replacements,swaps,player-changes}`; migration 0005 fixed a schema flaw that made moves impossible to store. Tests: `tests/changes.test.mjs` (races, stale requests, limits, capacity) and live checks. **The five UI pages (portal replacements/swaps, admin replacements list+detail, swaps, player-changes) were converted and compile, but have not been clicked through in a browser: they need a manual QA pass.**
- **Day check-in and player numbers ported (2026-11-25):** `server/checkin/service.mjs`. Check-in is one transaction, idempotent on (player, day) (8 simultaneous scans = 1 record), only for `checkin.current_day`, only while `checkin.open`; optional `checkin.require_registration` (unset = on) refuses a player with no sport that day. Player number = day code + registration id padded to 4 (`D-010032`), derived, parsed using the known day codes. Lookup by player number, member id / membership id, or NIC; day stats, per-event check-in list and number list/export are single SQL statements (no 1000-row paging). `/api/config/portal-status` is now the `checkin.open` switch (GET admin, PATCH administrator level, audit-logged); Supabase Realtime is replaced by 10 s polling. `/api/players/[id]/{verification,sports}` (contain NIC) and `/api/config/*` are admin-only in the access policy. `SPORT_DAYS` / `CURRENT_SPORT_DAY` are gone: pages read days and the current day from the database (`useSportDays`). Tests: `tests/checkin.test.mjs`.
- **Pages needing a manual QA pass (converted, compile-checked, NOT clicked through in a browser):** portal replacements, portal swaps, admin replacements list + detail (RI field), admin swaps, admin player-changes (swap pickers), admin check-in scanner `/admin/dashboard/register` + `/register/player/[id]` (scan QR, manual id/membership id entry, already-checked-in toast, closed/no-day redirects), `/admin/dashboard/player-numbers` (day tabs, search, export, stats) + `/player-numbers/mob` (3 lookups), `/admin/dashboard/day-registrations`, `/admin/dashboard/portal-settings` (open/close toggle, polling toast), `/admin/dashboard/events` (day dropdown), and the portal players page (Transfer-after-cutoff badge). Earlier groups (login, registration, payments, teams, membership, participation points, settings) were checked in the browser or via live API calls during their rounds.
- **Transfer cutoff (done on the RCL side, 2026-11-25):** a transferred member counts only if the transfer was finalised on or before `membership.cutoff`. Migration 0006 adds `rmis_members.transfer_completed_at / transfer_info / has_pending_transfer`; `memberEligibility` refuses `transfer_after_cutoff` and, while RMIS does not send the field at all, `transfer_info_unavailable` for status-3 members; applied in registration, replacements, the eligible-members list (`excluded` reasons) and the `transferred_after_cutoff` player flag. **Waiting on RMIS** to ship the fields: see [RMIS_TRANSFER_REQUIREMENT.md](RMIS_TRANSFER_REQUIREMENT.md). Until then transferred (status 3) members cannot be registered.
- **All remaining domains ported (2026-11-25), Supabase fully removed** (client file and npm dependency deleted; `grep -ri supabase src` is empty). Details and per-page QA checklists: [WP_TOURNAMENTS.md](WP_TOURNAMENTS.md) (brackets, games, placement points, standings), [WP_TRACK_EVENTS.md](WP_TRACK_EVENTS.md), [WP_LEADERBOARD_SNAPSHOTS.md](WP_LEADERBOARD_SNAPSHOTS.md) (versioned snapshots, ETag, `scripts/worker.mjs`), [WP_DASHBOARDS_PERMISSIONS.md](WP_DASHBOARDS_PERMISSIONS.md). Ops/deploy/go-live: [OPERATIONS.md](OPERATIONS.md) (Dockerfile, health endpoint, security headers, backup script, load-test script). Full suite: 276 tests pass; `next build` passes; built app smoke-tested (health, leaderboard ETag/304, admin 401, 100-visitor load test: 0 errors).
- **Still manual / to do outside the code:** browser QA of every converted page (lists in the WP docs and above), staging deployment + load test on the OVH box, OVH crash diagnosis, backup restore drill, production RMIS key and the RMIS transfer fields, first administrator row, confirming seeded settings in the super-admin screen.
- **Also done:** super-admin **Event settings** screen (`/admin/dashboard/settings`) driven by `server/settings/registry.mjs` (dates incl. the generic registration deadline, fee, points, penalty tiers, per-player limits, check-in, event days), `GET /api/public/event-info` for the public dates, and all date constants removed from `config/app.config.js` (pages read the settings through `hooks/useEventInfo`). Still in the config file until their domains are ported: `CURRENT_SPORT_DAY` / `SPORT_DAYS`, fee and points constants.
- **Done when:** `grep -r supabase src` is empty; every route has an integration test against a real Postgres (test container); no unbounded `SELECT *` on large tables.

### WP3: RMIS integration  (M)
- `src/server/rmis/client.js`: `fetch` with 5 s timeout, 1 retry on 5xx/network, structured errors mapped from `{error:{code,message}}`, reads `Retry-After`, never logs the key or passwords.
- Endpoints used: `auth/verify`, `clubs`, `clubs/{id}/members`, `members/changes`, `members/lookup`, `members/{id}`, `members/search`, `health`.
- **Local member mirror** `rmis_members` (member_id PK, club_id, status, role_id, card_name, full_name, gender, nic, dob, created_at, updated_at, synced_at). Portal pages read the mirror, never RMIS per request.
- Worker jobs: `rmis_members_sync` (initial per-club roster load, then `changes` every 1–2 min with 2-min overlap, dedupe on `member_id`+`updated_at`, watermark in `settings`), `rmis_clubs_sync` (daily + manual; category from `club_type`). A "refresh this club now" admin action calls `clubs/{id}/members`.
- Apply RCL rules over the mirror: statuses 1/3/5, 3→1 normalisation, `created_at ≤ cutoff`, gender M/F, and the RI number requirement.
- On `status` 2/4 or `club_id` change of a **registered** player: flag it on the admin dashboard (not silently kept). On `role_id` leaving 1–6/1–4 or status 2/4 for a logged-in user: mark their session invalid (WP4).
- Replace `search-users` with `members/search` (admin-eligible roles only).
- **Done when:** with RMIS mocked, a sync populates the mirror; killing the mock leaves portal pages working from the mirror; contract tests run against the real RMIS (staging) green.

### WP4: Authentication and authorization  (M)
- NextAuth credentials provider calls RMIS `auth/verify` with `{username, password}`.
  - **No end-user IP handling in RCL** (owner decision: not needed). RMIS currently *requires* a valid `client_ip` field, so the client sends a fixed placeholder (`0.0.0.0`); RMIS throttling therefore works per username. Pending RMIS change: make the field optional, then drop the placeholder.
  - Map RMIS errors to login messages: `invalid_credentials`, `club_terminated`, `member_inactive`, `member_terminated`, `account_restricted`, `rate_limited` (show retry time), `service_busy`/network error ("RMIS unavailable, try again").
  - Login form field renamed `username`; trim and lowercase; link to RMIS onboarding.
- Session/JWT shape (small): `{ member_id, username, card_name, club_id, role_id, hasPortalAccess, hasAdminAccess, permission_level }`. **No** NIC/DOB/full row; drop the persisted `userDeetsAtom` row (keep only the small shape in session).
- `permission_level` lookup from `permissions` by `member_id` (not `membership_id`).
- **Middleware + guards:** `middleware.js` for `/api/admin/**` (admin), `/api/portal/**` and registration/payment/change routes (portal session), public GETs open. `requireRole()`/`requireClub()` helpers inside handlers: **club, member and actor always come from the session**, never the body/query. Audit fields (`approved_by`, `requested_by`, etc.) = `session.member_id`.
- Sessions: 24 h, plus invalidation when the mirror shows the user's role/status dropped (check a cached per-member flag in middleware).
- Permissions admin: `role_id === 1` superuser rule → explicit `permission_level`. Seed first administrators by SQL.
- `/api/clubs/{id}/registered-events` (public contract with `citation-checklist`): stays unauthenticated, counts only, cached ≤60 s, rule per WP5.
- **Status (version-2):** done and tested: login via RMIS, small session shape, error codes, both login pages; **default-deny API middleware** (`src/middleware.js` + `server/auth/access-policy.mjs`, with a route-file scan test and a live check using real sessions); handler guards (`server/auth/guards.js`: `requireUser`, `resolveClubId`). Still to do: use the guards inside each ported route (club/member/actor from the session), session invalidation when the member mirror shows a role/status drop, and the `/api/council` + `players/clean` removals.
- **Done when:** unauthenticated and wrong-role calls to every write route return 401/403 (automated route-matrix test); cross-club access attempts rejected; login flows tested with the RMIS test accounts (`test.president` role 5 portal only, `test.disco` role 4 admin + status 3).

### WP5: Business logic into transactional functions  (L)
Each item = a SQL function (or a server function using `tx`) + route + tests. Fix list refers to `SYSTEM_ANALYSIS.md`.

| Item | Rules/fixes |
|---|---|
| `register_player` | Window from settings using DB `now()`; `max_count`/`reserve_count` under `FOR UPDATE` on the event; gender, category (club category vs event), cutoff, RI number for general members, **limits by `events.limit_group`** (`server/rules/limits.mjs`, settings `limits.groups`: standard = 1 per day, track group incl. shot put/discus = 3 total, swimming = its own 3 total; road race sits on its own day D-05, so no exemption rule), duplicate → `ON CONFLICT DO NOTHING`; club and player from RMIS mirror + session. One request instead of ~5. |
| `unregister_player` | Window + ownership checks. |
| Teams | Bulk/manual create with unique `(club_id, sport_id)`; eligibility via one `GROUP BY club_id` query (main + reserve count toward `min_count`). |
| Payments | State machine (`approved IS NULL` guard), `approved_at`, total = registered players × fee, search with `!inner`-equivalent JOIN, summary views. |
| Replacements/swaps | `approve_*`, `reject_*` with `FOR UPDATE` + `status IS NULL`; stale-data checks (registration still holds original player, replacement not already in sport, day/gender checks); partial unique index for one pending request; window enforced server-side; admin direct changes use the same functions. |
| `apply_membership_penalties` | **Idempotent "set" semantics** (one penalty row per club, `kind='penalty'`), computed in SQL with integer math over the mirror; returns the affected rows; revoke function; the UI button disabled while running; clean/sync failures abort the run. Replaces `players/clean` global mode (`DELETE … WHERE NOT EXISTS`). |
| `award_participation_points` | `kind='participation'`, unique per club/sport; 50% rule counts reserves (decision); preview and award use the same query; day chosen from settings with an admin selector. |
| `award_tournament_points` | Standings computed in SQL server-side (no client numbers); placement rows `ON CONFLICT DO UPDATE`; never overwrites participation rows; explicit tie rules. |
| `save_match_score_and_advance` | One call: save score, set parent `team1_id/team2_id`, clear on correction, cascade; "0" is a valid score (use `completed`/NULL); integer scores; edit never wipes parent links. Used by desktop and mobile admin. |
| Track events | Upsert on `(sport_id, member_id|team_id)` instead of delete-all; award atomic; keep participation rows. |
| Day check-in | Single `check_in` call (verify + insert, `ON CONFLICT DO NOTHING`), `approved_by` from session, sport day validated against settings and the player's registration. |
| `club_registered_events` | One SQL aggregate; individual = registered player scanned; team = `attended*2 >= registered`; keeps `data.summary.event_count` and per-event fields; fixture tests (1/1, 2/4, 1/4, 3/5, 2/5). |

- **Done when:** concurrency tests (two parallel approves, double-click penalties, parallel registrations at max) leave consistent data; fixture tests pass; each old finding marked resolved in a checklist.

### WP6: Snapshots, workers and public API  (L)
- `snapshots` table and compute functions: `leaderboard:all|community|university`, `bracket:<sport>`, `schedule`, `club_registered_events:<club>`, admin stats.
- Worker container (`node worker.js`): `pg-boss`/`graphile-worker`, **direct** DB connection, `LISTEN rcl_changed` with ~1 s debounce, 30 s sweep, reconciliation every 5 min (alert on mismatch), `backup_check`.
- Public API: `GET /api/public/leaderboard`, `/bracket/:sport`, `/schedule`, `/versions` (tiny), all `Cache-Control: no-cache` + ETag = version, `304` handling; degraded mode (recompute inline when snapshot > 60 s old, single-flight lock).
- Frontend: a `useSnapshot(key)` hook polls `/versions` every ~10 s and refetches only changed snapshots; "Updated hh:mm:ss" shown; remove all `atomWithStorage` caches and `_t=Date.now()` hacks; `force-dynamic`/`no-store` for live data.
- Cloudflare rules documented (respect origin, immutable static assets, no Rocket Loader).
- **Done when:** acceptance tests from plan doc §5.8 pass (points visible ≤ 12 s without hard refresh, worker kill → inline fallback + alert, no version regressions).

### WP7: Frontend changes  (M)
- Login pages: username field, error messages, RMIS-unavailable state.
- Remove full-row `userDeets` usage; pages read `session.user` small shape and the mirror-backed endpoints.
- Public player pages and QR: see **WP7a** (replaces the earlier idea of removing NIC search; NIC stays a search key, but never shown).
- Registration UI: use server-validated errors (server is the source of truth); show RI number field for general members; show "not eligible" reasons from the API (gender, cutoff, window).
- Check-in scanner: single request, optimistic success, local retry queue; QR encodes `member_id`.
- Bracket pages: poll snapshots, no direct DB, score entry via the new endpoint, fix edit-wipes-parents and 0-score handling.
- Admin: payments search debounce, membership-management button disabled while running, penalty "applied at" display, participation-points day selector, admin dashboard flags for registered players who became inactive/terminated/transferred.
- Schedule page: one summary snapshot instead of N+2 calls.
- Fonts via `next/font`; remove stray dead pages.
- **Done when:** manual QA checklist across roles passes; no console errors; Lighthouse/bundle sanity.

### WP7a: Player QR code page (one QR per registered player)  (S–M)
**Requirement (owner):** each registered player has one QR code, which a player or club rep must be able to **find and generate by name, by NIC, or by membership ID**. What the QR encodes does not matter to the owner, so it is our choice.

Design:
- **Page:** `/player` (search) → `/player/[member_id]` (shows the QR). Public, no login (as today), but abuse-protected.
- **Search inputs (any one of three):**
  | Input | Matching | Notes |
  |---|---|---|
  | Name | case-insensitive substring, min 3 characters | trigram index on `players.name`; returns at most 20 |
  | NIC | **exact match**, normalised (trim, uppercase; old 9-digit+V/X and new 12-digit formats compared as typed) | no partial/prefix search, so NICs can't be enumerated |
  | Membership ID | **exact match**, case-insensitive | players whose `membership_id` is null are still reachable by name or NIC |
- **Results show:** name, club, sports registered, and a "Show QR" link. **NIC is never shown or returned**; if an identifier must be displayed, show a masked tail (e.g. `•••••5678V`) so the person can tell two people with the same name apart.
- **QR content:** the check-in URL `${origin}/admin/dashboard/register/player/<member_id>`. It uses the stable `member_id`, so it still works if the membership ID changes after a transfer, and it exists even when `membership_id` is null. (The existing admin scanner takes the last path segment.) The QR is rendered client-side with the existing `qrcode` library (data URL), so there is no server cost.
- **Scope:** only players **registered in RCL** (rows in `players`), since only they can be checked in. A member who isn't registered yet gets "not registered for any sport" instead of a QR.
- **Extras (cheap, optional):** "Download PNG" and "Print" buttons on the QR page; an admin **bulk QR sheet per club** (PDF of all registered players of a club, for lanyards), reusing the same `member_id` URL.
- **Abuse protection:** per-IP rate limit on search (e.g. 30/min), 3-character minimum for name, constant-shape "no results" responses, no `limit` parameter from the client, `Cache-Control: no-store` on search, and no caching of QR pages beyond the browser session.
- **Scanner/check-in side** (WP5 `check_in`): the scan resolves `member_id` → player, verifies registration for the current sport day, and records the check-in in one request. The admin lookup can also find a player by name, NIC or membership ID for people who forgot their QR (admin-only, may show NIC).
- **Schema:** `players.membership_id` (nullable, stored from the RMIS mirror at registration and refreshed by sync), `players.nic` stored normalised; indexes `upper(nic)`, `upper(membership_id)`, and `gin_trgm_ops` on `name` (needs `pg_trgm`).
- **Done when:** a player can be found by each of the three inputs and gets a working QR; a QR scanned by the admin scanner checks the right person in; NIC is absent from every public response (automated test); partial NIC input returns nothing; the rate limit returns 429 under a burst.

### WP8: Security hardening  (S–M)
- PII: NIC is accepted as an exact-match **search key** on the public QR page (WP7a) but is **never returned or displayed** publicly; NIC visible to admins only where needed (check-in lookup); no PII in logs; no `console.log` of user rows.
- Input validation (zod) on every route; column whitelists (no raw-body inserts into `matches`, `events`, `clubs`).
- Upload: MIME whitelist + magic-byte check, UUID names, club from session, private bucket + signed URLs.
- Security headers, `NEXTAUTH_URL`/trusted host, cookies `secure`/`sameSite`, no secrets in client bundle (grep CI check for `NEXT_PUBLIC_`).
- Rotate every key that was ever in a browser bundle or in chat (including the test RMIS key).
- **Done when:** security checklist signed off; dependency audit clean for high severity.

### WP9: Operations and observability  (M)
- Dokploy: app (2 replicas, health check, memory limits, `restart: unless-stopped`), worker, PgBouncer, Postgres, MinIO, private network; DB port not public.
- Diagnose and fix OVH instability (OOM/disk), enable swap, log rotation, disk/RAM alerts at 80%.
- Backups: WAL archiving + nightly base backup to R2/B2, restore drill with recorded time (target < 30 min, ≤ 5 min data loss).
- Monitoring: Sentry, `pg_stat_statements`, PgBouncer stats, external uptime checks (`/e-arena`, leaderboard API, DB), alerts on 5xx rate and connections.
- Runbook (one page): restart, restore, rotate key, switch registration/day flags, "RMIS is down" behaviour.
- **Done when:** a chaos checklist passes (kill app, kill worker, restart DB, RMIS down) and the restore drill is documented.

### WP10: Load testing, staging, go-live  (M)
- Staging stack (OVH, same compose) pointed at the RMIS staging deployment (owner to provide) with seed data from the generator.
- k6/Artillery scenarios: 2000 concurrent public viewers (leaderboard, schedule, brackets, player search); registration-opening burst (90 clubs, many parallel registrations); check-in burst (multiple scanners); admin score entry during public polling; RMIS slow/down.
- Budgets: public endpoints p95 < 300 ms at 2000 VUs; DB CPU and connections within limits; zero stale reads in the freshness test.
- Go-live: reference data (clubs sync, first administrators, settings, event list), onboarding report from RMIS, test accounts, archive Supabase (dump + slips), freeze 24 h before event day 1, event-day runbook and contact list, post-event retrospective.

## 2. Dependencies and order

```
WP0 ──► WP1 ──► WP2 (domain by domain) ──► WP5 (per domain)
            └──► WP3 ──► WP4 ─────────────────┘
WP2/WP5 ──► WP6 ──► WP7 ──► WP8
WP9 (start early, in parallel)         WP10 (needs staging + RMIS staging)
```
Suggested milestones:
1. **M1 Foundations** (WP0, WP1, WP9 base): clean repo, schema, compose, Dokploy skeleton.
2. **M2 Identity** (WP3, WP4): login against RMIS, mirror, route guards (can be demoed with a mocked RMIS).
3. **M3 Core flows** (WP2+WP5 for registrations, payments, teams, changes, penalties).
4. **M4 Tournament + public** (WP2+WP5 tournaments, WP6, WP7).
5. **M5 Harden and rehearse** (WP8, WP9 rest, WP10).

## 3. Test strategy
- Unit tests: rule functions (eligibility, penalty tiers, 50% attendance, standings).
- Integration tests: every route against a real Postgres container, with a **route-matrix auth test** (role × route → expected 401/403/200).
- Concurrency tests: parallel approve/reject, double-click penalties, registrations at max.
- Contract tests: RMIS client against the documented responses (mock server) and a nightly smoke against RMIS staging.
- Freshness test: write → public read within budget, in a real browser session.
- Load and chaos tests as in WP10/WP9.

## 4. Risks
| Risk | Mitigation |
|---|---|
| OVH crashes during event days | Diagnose first, monitoring, off-site backups, restore drill, optional standby, Spaceship fallback |
| RMIS slow/down | Local mirror, 5 s timeouts, 24 h sessions, "RMIS unavailable" login message |
| Roles 5/6 not assigned in RMIS (dev copy had almost none) | Check production now; if true, clubs can't log in, so assign roles in RMIS before launch |
| Key leakage | Server-only env, rotate test keys, CI grep for `NEXT_PUBLIC_` secrets |
| Big-bang rewrite risk | Port by domain behind unchanged HTTP shapes, keep a checklist, staging rehearsals |
| Stale public data again | Version/ETag design, reconciliation job, freshness test |

## 5. Open items
1. Production checks in RMIS (president/secretary coverage per club, status distribution, onboarding list).
2. Staging deployment of the RMIS branch with a staging key and test accounts in a club with a realistic roster.
3. Fresh RMIS key for production (the test key was shared in chat).
4. OVH crash diagnosis and R2/B2 account for backups.
5. Is Cloudflare in front of the domain today?
6. First administrators (member ids) to seed in `permissions`.

- **Bib numbers (2026-11-25):** for players registered in track events, swimming or the road race (`events.bib_required`, set from the limit group or the last event day; migration 0011). One number per player, one player per number (both UNIQUE), 3 digits (001...999, 4 digits after), handed out in order by ONE admin button ("Assign N missing numbers", super admin) on Admin > Player numbers > Bib numbers; the database refuses to change or delete a number. A number is never reused. When a replacement or swap leaves a player with no bib event, the number is handed to the player who takes over (same transaction); otherwise the new player gets the next number on the next click. The number shows on the scanner result and on the mobile lookup. Code: `server/bibs/service.mjs`, `api/admin/bibs`, `player-numbers/BibNumbersPanel.jsx`, tests `tests/bibs.test.mjs`. **Needs manual QA** (not clicked in a browser): the Bib numbers view (assign, filters, search, export), the number on the scanner player page and `/player-numbers/mob`.

- **Announcements + deadline reminders (2026-11-25):** admins (super admin) send announcements from Admin > Admin Options > Announcements; they appear at once on every portal and admin dashboard (server-sent events + 30 s polling fallback), with a per-user unread marker, a "read by N of M" count for admins, optional expiry and retract. The worker (and the API, throttled, if the worker is down) creates automated reminders: a day before and an hour before the registration close, the replacement/swap close, and each sport's own close (sports sharing a closing time share one reminder); idempotent by a unique key per deadline + reminder; only the reminder that is due now is created (no late "24 hours" after the last hour began); none before a window opens or after it closed. Migration 0012; code `server/announcements/service.mjs`, `api/announcements*`, `api/admin/announcements`, `components/AnnouncementsCard.jsx`, `admin/dashboard/announcements`; tests `tests/announcements.test.mjs`. In-app only (no email/SMS). The admin "Pending Replacement Req" card now splits replacements and swaps and links to where they are decided. **Needs manual QA:** send from the admin page and watch a portal dashboard in another browser; unread dot / Mark all read; reminder wording.
