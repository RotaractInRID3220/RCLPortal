# RCL ↔ RMIS 2.0 Integration Requirements & Self-Hosted Postgres Migration Plan

Date: 2026-11-24. Companion to `SYSTEM_ANALYSIS.md` (RMIS 1.0-era audit of RCL).

## 0. Decisions confirmed by the owner (2026-11-24)
| # | Decision |
|---|---|
| 1 | **Fresh season.** No registration/points/payment data is migrated. Only reference data is re-created: clubs (synced from RMIS), admin permissions, settings. The old Supabase data is exported once as an archive dump. |
| 2 | **Hosting: VPS with Dokploy** (RCL was never on Firebase). All Firebase / Cloud Run / App Hosting material (`apphosting.yaml`, `firebase.json`, `.firebaserc`, `firebase`/`firebase-tools` deps, `DEPLOYMENT.md`) is to be removed. |
| 3 | **Roles unchanged:** portal access = RMIS roles 1–6, admin access = roles 1–4. |
| 4 | **RI number stays RCL-typed input**, entered when a general member (status 1 *active* or 3 *transferred*) is registered for an event. RMIS needs no RI field. |
| 5 | RMIS-1 API (`info.rotaract3220.org`) is **already down**. RMIS 2.0 endpoints are the only source. The owner will get the endpoints built in RMIS-2 and provide documentation. This plan will then be re-checked against that documentation. |
| 6 | Status codes confirmed: 1 active, 2 inactive, 3 transferred, 4 terminated, 5 prospective. |
| 7 | **`registered-events` must keep working as it used to**, with the eligibility rule below (§2.9). RCL runs 4 days continuously, so the load requirements in §5.6 apply. |
| 8 | **Reserves count** in the "50% of registered players" rule (all registration rows). |
| 9 | **Membership cutoff uses `members.created_at`** (confirmed). The RMIS migration ran once, before the cutoff/deadline, so every migrated member passes and no backfill is needed. |
| 10 | **Gender `O` only appears on test accounts.** Treat any gender other than `M`/`F` as not registrable and exclude test accounts from member lists. |
| 11 | **Hosting: OVH VPS (Germany) as primary**, via Dokploy. The crash/reliability and distance risks are handled in §5.7. |
| 12 | **Caching must never serve stale leaderboards/points/brackets.** Previous TTL/browser caching caused wrong standings and was removed. The replacement is a versioned snapshot design with background workers (§5.8). |

Sources: RCL code (`rcl-portal/src`) and the RMIS-2 repo (`/Users/sandinu/Personal Dev/RMIS-2`, branch `feat/public-club-details`).
Facts about the **live** RMIS-2 database and VPS were not inspected, only code, docs and scripts. Items marked **[VERIFY]** need a check against prod.

---

## 1. What changed between RMIS 1.0 and 2.0 (and what it breaks in RCL)

| Topic | RMIS 1.0 (what RCL assumes) | RMIS 2.0 (facts from the repo) | Impact on RCL |
|---|---|---|---|
| Access method | Raw SQL over HTTP, `info.rotaract3220.org/api/query`, key in a `NEXT_PUBLIC_` var | Drizzle/Postgres; only `/api/public/*` routes with a single `PUBLIC_API_KEY` | Every RMIS call in RCL must be rewritten to REST endpoints |
| Login identifier | `m_username` (RCL form field is mis-named `email`) + **MD5**, compared inside RCL | `members.m_username` only (unique, lowercase `[a-z0-9._]`, 3–30), **Argon2id** (`m=19456,t=2,p=1`) | RCL must **not** verify passwords itself. RMIS verifies. |
| Usernames/passwords after migration | existed | **Migrated members have NULL username and password.** They must re-onboard (NIC + email OTP) and choose a new username | Every RCL user (admins, presidents, secretaries) must onboard in RMIS 2.0 *before* they can log in to RCL. Members with no NIC or email on file can't onboard. |
| Member id | `membership_id` (text) used as `RMIS_ID` everywhere in RCL | `members.table_id` (int, **preserved** from RMIS-1) is the PK. `membership_id` exists but is regenerated on club transfer, and migrated members with none got `GEN-<id>`. | RCL's key (`RMIS_ID` = membership_id) is no longer stable. **Re-key RCL on `table_id`.** (§4.2) |
| Club id | `club_id` | `club_id` **preserved**. `c_name`, `club_type` (`Community`/`Institute`), `status` (1 = active). | Stable. RCL's `clubs.category` can now be derived from `club_type`. |
| Member status | 1 gen, 2 inactive, 3 transferred, 4 terminated, 5 prospective | Same codes (`SRS.md:311`). Login allows 1, 3, 5. | RCL's "3 → 1" normalisation still needed. |
| Cutoff timestamp | `created_datetime` (datetime) | `created_at` (timestamp, NOT NULL, system-set) and `joined_at` (date, nullable, user-entered). `scripts/migrate-pastdata.ts` does **not** copy RMIS-1 `created_datetime`, so for every migrated member `created_at` = migration time. | **Use `created_at` for the cutoff** (§2.8). RMIS should backfill it from the old dump. |
| RI number | `ri_number` | No RI id column in RMIS-2 | **Not a gap.** RI number is typed in RCL at event registration for general members (status 1 or 3), as today. RMIS need not supply it. |
| NIC / DOB | `nic_pp`, `dob` | `nic` (varchar 20), `dob` (date). RCL itself reads both `nic`/`nic_pp` and `dob`/`birthdate` inconsistently. | One canonical name per field in the new API |
| Gender | `M`/`F` | `M`/`F`/`O` | RCL gender filters must handle `O` |
| Roles | role_id 1–6 grant access (admin 1–4, portal 1–6); `role_id===1` = superuser | roles: 1 DRR/RDS, 2 ADRR, 3 RDT, 4 RDSC, 5 President, 6 Secretary, 7 Treasurer, 8 IPDRR/…, 31 General. Permissions are `resource:action` strings resolved from role + permission sets + per-member grants. | Role ids appear to match for 1–6 **[VERIFY mapping against prod `roles`]**. Prefer permission keys over raw role ids. |
| Rate limiting | none | **none**. No login throttling at all. | The new verify endpoint must add it, or RCL becomes a brute-force path. |
| SSO | n/a | none (JWT sessions, host-only cookies, no OIDC) | Use server-to-server verify (§2.1) |
| Reverse link | – | `https://rcl.rotaract3220.org/api/clubs/{clubId}/registered-events` is consumed by the separate **`citation-checklist`** app (`src/app/api/rcl/route.js`, which reads only `data.summary.event_count`; citation met when ≥ 2). RMIS-2 itself currently derives `rclCount` from its own district events, not from RCL. SRS open question #4 asks whether RCL stays external. | That RCL endpoint is a **public contract**. Keep the path and the `data.summary.event_count` field. |

Also: RMIS docs still list `info.rotaract3220.org/api/query` as the "operational data source" for citations, so **find out whether RMIS-1's API stays up**. If it is being switched off, RCL has a hard deadline.

---

## 2. Requirements RMIS must provide (endpoint spec)

Pattern: follow the existing `/api/public/*` convention (`lib/public-api/auth.ts`, `validatePublicApiKey`, snake_case JSON, `updatedSince`), but with these changes, because RCL passes passwords and bulk PII:

**Cross-cutting requirements (RMIS side)**
1. **Per-client API keys with scopes**, not the single shared `PUBLIC_API_KEY` that the "Join a Club" site also uses. Env or table, e.g. `RCL_API_KEY` (scope `rcl`). Keep the timing-safe compare. RCL stores the key server-only (rename away from `NEXT_PUBLIC_*`). Rotate when the old one was ever in a browser bundle.
2. Routes under `app/api/public/rcl/*` (middleware already bypasses auth for `/api/public`). Put logic in `lib/rcl/*`.
3. **Rate limiting** (per IP and per username) and **lockout** on the verify endpoint (e.g. 5 failures → 15 min), plus audit logging to `audit_log`. Request logging for the other routes (client, route, count).
4. One error shape: `{ "error": { "code": "...", "message": "..." } }`. The existing public API mixes two.
5. `Cache-Control: private, no-store` for auth. Members and clubs may use `private, max-age=60`.
6. **Never return** `m_password`, OTP data or tokens. Return NIC and DOB only on the endpoints that need them (members list, lookup), and document that.
7. Pagination (`limit`, `cursor`) on any list that can exceed ~1000 rows (RMIS has about 30,000 members, and 1500+ in RCL).
8. Timestamps in ISO 8601 UTC. Dates as `YYYY-MM-DD`.

### 2.1 `POST /api/public/rcl/auth/verify` (replaces NextAuth `authorize` SQL + local MD5)
- Request: `{ "username": "string", "password": "string" }`. Lowercase and trim the username server-side.
- Logic: reuse `auth.ts` (lookup by `m_username`, Argon2 `verify` first, then club/member status checks, as today).
- 200: 
```json
{ "member_id": 1234, "membership_id": "RACOL0042", "username": "jane.d",
  "card_name": "Jane D", "full_name": "Jane Doe", "club_id": 3, "club_name": "Rotaract Club of Colombo",
  "role_id": 5, "role_label": "President", "designation": "President", "status": 1,
  "permissions": ["rcl:portal"] }
```
  `permissions` is the resolved list (role + sets + grants). RCL derives `hasPortalAccess`/`hasAdminAccess` from `rcl:portal`/`rcl:admin` instead of raw role ids.
- 401 `invalid_credentials` (generic). 403 with a typed code, the same as today's `AccessDeniedError`: `club_terminated`, `member_inactive`, `member_terminated`, `account_restricted`. 403 `not_onboarded` (no username/password yet) is useful for a helpful message, but beware username enumeration. Return it only after a correct password, which for NULL passwords is impossible, so return the generic 401 and let the login page link to RMIS onboarding. 429 `rate_limited`.
- Add permission keys to the RMIS role config: `rcl:portal` (roles 1–6, same as today), `rcl:admin` (roles 1–4). Optionally later `rcl:super_admin` and `rcl:administrator` to replace the Supabase `permissions` table (§4.5).

### 2.2 `GET /api/public/rcl/clubs/{clubId}/members` (replaces `/api/council?clubID=`)
- Query: `statuses=1,3,5` (default), `createdOnOrBefore=<ISO-8601 timestamp>` (the cutoff against `members.created_at`, supplied by RCL as a parameter; RCL keeps owning the date).
- Item: `{ member_id, membership_id, card_name, full_name, gender, status, nic, dob, club_id, created_at }` (no `ri_number`: it is RCL-typed). Exclude test accounts server-side (or flag them with `is_test`).
- `status` is returned raw. RCL maps 3 → 1.
- 404 if the club is unknown or inactive. Ordered by `card_name`.
- Called on every portal page load that needs members (side nav, registration, swaps, replacements), so it needs a cheap query on `(club_id, status)`. RCL will also cache it for 2–10 min.

### 2.3 `POST /api/public/rcl/members/lookup` (replaces `sync-rmis`'s giant `IN (...)`)
- Request: `{ "member_ids": [1,2,...] }`, max 500 per call. Also accept `membership_ids` (legacy strings) during the migration window (§4.2).
- Response per id: `{ member_id, membership_id, status, club_id, nic, created_at, found: true|false }`. **Return rows for non-matching statuses too** (inactive/terminated) rather than silently omitting them, so RCL can flag them instead of keeping them as "general".
- `club_id` is new vs RMIS-1: it detects transferred members, which currently go unnoticed.

### 2.4 `GET /api/public/rcl/members/changes?updatedSince=<ISO>&cursor=` (optional, recommended)
- Incremental feed of members whose `status`, `club_id`, `nic`, or `created_at` changed (uses `members.updated_at`, which exists). Fields as in 2.3.
- Lets RCL run a cheap scheduled sync instead of a global 1500-id request, and catches transfers.

### 2.5 `GET /api/public/rcl/members/{memberId}` (and `?membershipId=`)
- Single-member lookup for QR-scan resolution and player lookup. Same fields as 2.2. Needed so printed QR codes carrying the old `membership_id` still resolve (§4.2).

### 2.6 `GET /api/public/rcl/members/search?name=&permission=rcl:admin` (replaces `search-users`)
- Min 3 characters, parameterised `ILIKE` (not string concatenation). Returns `{ member_id, membership_id, card_name, role_id, role_label, club_id }`. Filter to admin-eligible roles (currently 1–4) server-side.

### 2.7 `GET /api/public/rcl/clubs` (replaces manual club entry)
- Returns active clubs: `{ club_id, club_name, club_name_short, category: "community"|"university", zone, status }`. Map `Community→community`, `Institute→university` (the same mapping the existing public API uses). RCL can then stop hand-typing `clubs.category`.

### 2.8 Data gaps RMIS must close (or RCL must accept as manual)
| Gap | Needed by | Recommendation |
|---|---|---|
| ~~RI member number~~ | General members (status 1 or 3) must have one to register (`registration/[sportid]/page.jsx:344`), stored as `players.RI_ID` | **Decided: RCL-typed.** Note the current check is `status === 1` after 3→1 normalisation, which already covers transferred members. Keep the rule keyed on the normalised status. Make it required on the **server**, not just in the form. |
| Cutoff timestamp | Membership cutoff (`MEMBERSHIP_CUTOFF_DATE`) | **Checked in the RMIS-2 repo.** Every member has `members.created_at` (NOT NULL, `timestamp`, system-set). RMIS-1's `created_datetime` is **not copied** by `scripts/migrate-pastdata.ts` (its column list has `joined_at` from RMIS-1 `joined_date`, but no `created_at`), so for every migrated member `created_at` = the **migration time** (the dump is dated 2026-06-23), and for members created in RMIS-2 afterwards it is the real creation time. `joined_at` is the user-entered, backdatable `joined_date` and can be NULL. **Use `created_at` for the cutoff** (it is what RMIS-1 `created_datetime` meant: when the record entered the system, not backdatable). It works for the fresh season as long as the cutoff date is after the migration date. For correctness, RMIS should also **backfill `created_at` from the old dump** (`past-data/membership-data.sql` still contains `created_datetime` for every row): load it to a staging table and `UPDATE members SET created_at = old.created_datetime FROM staging old WHERE members.table_id = old.table_id`. State the timezone explicitly (`timestamp` has no zone; RMIS should return ISO-8601 with `Z`/offset, and RCL should compare in `Asia/Colombo`). |
| Gender `O` | Gender-restricted sports | RCL needs a rule (probably ineligible for M/F-only events, eligible for mixed). |
| Username-less members | Login | Members must onboard first. Offer a list of "RCL users not yet onboarded" before launch. |
| Prod status mapping | Penalty percentage | Two migration scripts disagree (`migrate-pastdata.ts` keeps 1–5; `migrate-old-data.ts` remaps `5→2`). Run `SELECT status, count(*) FROM members GROUP BY 1` in prod and confirm prospectives are still 5. |

### 2.9 Reverse direction: `GET /api/clubs/{clubId}/registered-events` (must keep working)
Consumer: `citation-checklist` (`/api/rcl`), reading `data.summary.event_count`. Not called by RMIS-2 today. It has no UI caller inside RCL, so it is easy to delete by mistake. **Keep the path, the `{success, data:{club, summary, events[]}}` shape, and `summary.event_count`.**

**Required rule change.** Today (`api/clubs/[clubId]/registered-events/route.js`) a team event counts when `day-registered players >= ceil(min_count/2)`. The owner's rule is different:
- `event_count` = number of **events the club registered for** that count as *attended*, where
  - **individual / trackIndividual:** the registered player has a day registration (QR scan) for that event's `sport_day`;
  - **team / trackTeam:** at least **50% of the club's registered players for that event** have a day registration for that `sport_day`: `attended * 2 >= registered` (integer math; both counts taken from the same distinct-player set).
- Decide and document one thing: whether "registered players" includes **reserves** (`main_player = false`). The participation-points logic counts all registration rows, so the default here is **all rows** for consistency. Confirm.
- Keep `raw_registered_events_count`, `eligible_events_count`, and the per-event `registered_player_count`, `day_registered_player_count`, `required_day_registered_count` (now `ceil(registered/2)`) so existing consumers don't break.
- Implementation in the new data layer: one SQL query (registrations → events → LEFT JOIN day_registrations on `member_id` + `sport_day`, `GROUP BY sport_id`) instead of the current unbounded select plus a long `IN (...)` list (both hit the 1000-row cap). Add a unit test with fixtures: 1 individual attended, 1 not; team 2/4 attended (eligible), 1/4 (not), 3/5 (eligible), 2/5 (not).
- Caching: it is counts only (no PII), so serve it with `Cache-Control: public, s-maxage=60`. Add the per-client API key only when `citation-checklist` is updated to send it, since that app calls it unauthenticated today.
- Open item for RMIS: SRS question #4 (does RCL stay external, or move into RMIS `district_events`?). This plan assumes RCL stays separate and RMIS reads this endpoint.

---

## 3. Changes needed inside RCL for the RMIS 2.0 integration

### 3.1 Auth
- Replace `authorize()` with a call to `POST /auth/verify`. Remove `md5`, the SQL, and `app/api/auth/validate` (dead code).
- Rename the form field `email` → `username` on `/admin/login` and `/portal/login`. Lowercase and trim.
- Session/JWT shape: `{ member_id, membership_id, username, card_name, club_id, role_id, permissions[] }`. Stop storing the full member row in the JWT and in the persisted jotai atom `userDeetsAtom` (it is persisted to localStorage and includes NIC/DOB).
- Make the login errors map to the typed 403 codes (`club_terminated`, `member_inactive`, ...) with clear messages, and show a link to RMIS onboarding when the credentials fail.
- Re-check the session on sensitive writes. The JWT lasts 24 h, so a demoted admin keeps access. Either shorten the session or have middleware re-resolve permissions from a short-TTL cache.
- Add the server-side auth layer from `SYSTEM_ANALYSIS.md` §10 (middleware + `requireRole`). **Do this in the same change**, otherwise the new login protects nothing.

### 3.2 Member data
- Replace `/api/council` with a thin server module `lib/rmis/client.js` (timeout 5 s, 1 retry, circuit-breaker or cached last-good, TTL cache, structured errors). The three internal self-HTTP calls (`portal/replacements`, `admin/replacements`, `admin/replacements/[id]`) should call the module directly.
- Map RMIS fields to one canonical RCL naming (`nic`, `dob`, `full_name`, `ri_number`) and fix the replacement flow that reads `nic`/`birthdate` while registration reads `nic_pp`/`dob` (replacement players probably have null NIC/DOB today).
- `sync-rmis`: use `members/lookup` or `members/changes`, update `status`, `nic`, **and `club_id`**, and flag players missing/inactive in RMIS instead of leaving them. Chunk requests. Report real failures.
- Stop the registration flow from trusting a client-sent `member` object. Re-fetch the member from RMIS server-side by `member_id` and the session's `club_id`.
- Replace `/admin/search-users` with `members/search`.

### 3.3 Clubs
- Seed/sync the local `clubs` table from `GET /clubs` (category from `club_type`) instead of hand-entering ids. Keep `club_id` identical to RMIS. A nightly or manual "sync clubs" button is enough.

---

## 4. Data model changes for the move (schema v2)

### 4.1 Principles
- Postgres-native, no PostgREST features, snake_case lowercase columns (drop the quoted `"RMIS_ID"` / `"NIC"` identifiers), `timestamptz` everywhere, integer scores, constraints instead of check-then-insert.
- The app code is being rewritten at the data layer anyway (§5), so rename now rather than carry quoted identifiers into the new system.

### 4.2 Re-key members on `member_id` (RMIS `table_id`)
- `players.RMIS_ID (text)` → `players.member_id (integer, PK)`, plus a `membership_id text` column kept **only for display and legacy QR resolution**.
- Same for `registrations`, `day_registrations`, `track_events`, `permissions`, `replacement_players` (`replacement_id`), `replacement_requests.original_player_rmis_id`, and `approved_by/requested_by/converted_by` (store `member_id` instead of names or membership ids).
- Backfill: build a map `membership_id → table_id` from RMIS. Ask RMIS for a one-off export (or use `members/lookup` with `membership_ids`). Players whose `membership_id` is not found in RMIS are listed for manual resolution **before** the cutover (the migration script must fail loudly on unmapped rows).
- QR codes: existing printed lanyards encode `.../register/player/<membership_id>`. Keep the route accepting both `member_id` and legacy `membership_id` (resolve via the stored column or `members/{id}?membershipId=`). New QRs should encode `member_id`.
- `[VERIFY]` For each migrated RCL player, check that `membership_id` still equals the RMIS-2 `membership_id` (it can change on transfer, and `GEN-` ids exist).

### 4.3 Constraints, indexes and new columns
(Consolidated from the earlier audit; they must be in place *before* load.)
```sql
-- identity / uniqueness
ALTER TABLE registrations     ADD CONSTRAINT uq_reg    UNIQUE (member_id, sport_id);
ALTER TABLE day_registrations ADD CONSTRAINT uq_dayreg UNIQUE (member_id, sport_day);
ALTER TABLE teams             ADD CONSTRAINT uq_team   UNIQUE (club_id, sport_id);
-- points: discriminate row kinds, stop encoding type in negative `place`
ALTER TABLE club_points ADD COLUMN kind text NOT NULL;   -- placement|participation|track|penalty
CREATE UNIQUE INDEX uq_points ON club_points (club_id, sport_id, kind) WHERE sport_id IS NOT NULL;
CREATE UNIQUE INDEX uq_penalty ON club_points (club_id) WHERE kind = 'penalty';
-- requests: one pending per registration
CREATE UNIQUE INDEX one_pending_replacement ON replacement_requests (registrations_id) WHERE status IS NULL;
-- matches: integer scores, completed flag, FKs
ALTER TABLE matches ALTER team1_score TYPE int USING nullif(team1_score,'')::int,
                    ALTER team2_score TYPE int USING nullif(team2_score,'')::int,
                    ADD COLUMN completed boolean NOT NULL DEFAULT false;
ALTER TABLE matches ADD FOREIGN KEY (parent_match1_id) REFERENCES matches(match_id),
                    ADD FOREIGN KEY (parent_match2_id) REFERENCES matches(match_id);
-- NOT NULL on registrations.member_id/sport_id/club_id; FK day_registrations.member_id -> players
```
Indexes: see the list in `SYSTEM_ANALYSIS.md` §9 (registrations by `(sport_id, club_id)` and `club_id`; players by `club_id`; day_registrations by `sport_day`; events by `(category, sport_type)`; club_points by `club_id` and `(sport_id, club_id)`; payment_slips; matches `(sport_id, round_id, match_order)`; teams; track_events).

Settings table: move `CURRENT_SPORT_DAY`, registration/replacement windows, and the membership cutoff date out of `app.config.js` into `portal_settings`/`season_settings` (DB-driven, evaluated with server `now()` in `Asia/Colombo`).

Add a `season`/`edition` column (or a separate DB/schema per season) if the data from previous seasons must coexist. See open question 2.

### 4.4 SQL functions (transactions) to replace multi-step route logic
`register_player`, `approve_replacement`, `reject_replacement`, `approve_swap`, `admin_replace_player`, `admin_swap_players`, `save_match_score_and_advance` (clears the parent on correction), `award_participation_points`, `award_tournament_points` (recompute standings in SQL, don't trust client numbers), `apply_membership_penalties` (idempotent "set" semantics), `clean_unregistered_players` (single `DELETE ... WHERE NOT EXISTS`). Views: `club_leaderboard` (SUM + `RANK() OVER (PARTITION BY category)`), `membership_stats` (`count(*) FILTER (WHERE status=1)`, integer math `k*100 >= 70*n`), per-club payment summary, day stats.

### 4.5 Permissions
Two-step: (1) keep RCL's local `permissions` (now keyed on `member_id`) so admins keep their `admin/super_admin/administrator` levels. (2) Later, move these to RMIS permission keys (`rcl:admin`, `rcl:super_admin`, `rcl:administrator`) so RCL has no user table of its own. The hard-coded `role_id === 1` superuser rule in `permissions/page.jsx:34` should become a permission key.

---

## 5. Supabase → self-hosted Postgres plan

### 5.1 Facts and constraints
- RMIS-2 prod already runs **external Postgres on a BlueHost VPS** (not in compose), with **PgBouncer in transaction mode (port 6432)** and migrations through the direct port 5432. Version, extensions, `max_connections` and backups are not recorded in the repo **[VERIFY]**. Docs describe daily `pg_dump` at 02:00 LKT, 14 days retained, weekly off-site rsync, with no script in the repo.
- RMIS-2 stack to copy: Postgres + Drizzle ORM + drizzle-kit + `pg` Pool, MinIO for files, Docker, Sentry, GitHub Actions → GHCR. RMIS-2 deploys via Dokploy/Coolify-style Docker hosting.
- RCL is deployed to a **separate VPS via Dokploy** (not Firebase). The leftover Firebase config in the repo (`apphosting.yaml`, `firebase.json`, `.firebaserc`, `DEPLOYMENT.md`, `firebase`/`firebase-tools` deps) is stale and should be deleted; its `minInstances/maxInstances` numbers do not describe the real deployment.
- RCL currently depends on PostgREST features, Supabase Realtime, Supabase Storage, and browser-side Supabase clients with RLS effectively open to anon.

### 5.2 Target architecture
```
Public/Admin browsers ──► RCL Next.js (server only touches DB)
                              │  pooled, short-lived connections
                              ▼
                         PgBouncer (transaction mode)
                              ▼
                  Postgres (separate database `rcl`)
         roles: rcl_app (DML) · rcl_ro (public read routes) · rcl_migrator (DDL)
                  + MinIO bucket `rcl-payment-slips` (private, signed URLs)
RCL ──server-to-server, API key──► RMIS 2.0 /api/public/rcl/*
RMIS ──API key──► RCL /api/clubs/{id}/registered-events
```
- **Separate database** (not a schema in the RMIS db), with its own roles, on the same Postgres server if the VPS has capacity **[VERIFY]**. Never give RCL credentials to the RMIS database.
- **Hosting (decided):** Dokploy on a VPS. Run the RCL app container(s), PgBouncer, Postgres and MinIO on the Dokploy host (or the DB on a second host over a private network/WireGuard), so Postgres is **never exposed publicly**. Prefer 2+ app replicas behind Dokploy's Traefik for zero-downtime deploys, with per-replica pool `max` 5–10 behind PgBouncer. Before the season confirm VPS RAM/CPU: Postgres + PgBouncer + app replicas + MinIO (and RMIS if it shares the box) must fit with headroom. Put a CDN (e.g. Cloudflare) in front for the public pages.
- **Data layer:** Drizzle + `pg` (matches RMIS-2, gives migrations, typed queries, and raw SQL for the functions above). All DB access happens in server code (`src/lib/db`). **Delete** `lib/supabaseClient.js`, the `NEXT_PUBLIC_SUPABASE_*` envs, and every browser-side query. The bracket pages' direct writes become API calls to authenticated endpoints.
- **Public reads:** a read-only role (`rcl_ro`), CDN/`s-maxage` caching and the views from §4.4. See `SYSTEM_ANALYSIS.md` §8. This is what protects the DB at 2000+ visitors.
- **Realtime replacement:** `portal_settings` (a flag): poll every 10 s from the check-in page. `matches`/leaderboard: poll the version endpoint (§5.8), fetching data only when the version changes (no per-client change streams). If true push is wanted later, a small SSE endpoint fed by `LISTEN/NOTIFY` on `matches` changes.
- **Storage:** new MinIO bucket `rcl-payment-slips` (the RMIS-2 compose already runs MinIO with presigner code). Private bucket, UUID object names, MIME whitelist + magic-byte check, club taken from the session, signed URL for admins. Copy the existing slips and rewrite `payment_slips.link`.
- **Config/secrets:** `DATABASE_URL` (pooled) and `DATABASE_DIRECT_URL` (migrations), `RMIS_API_URL`, `RMIS_API_KEY`, `RCL_INBOUND_API_KEY` (for the RMIS → RCL call), `NEXTAUTH_SECRET`, `S3_*`. None of these are `NEXT_PUBLIC_*`.
- **Backups and recovery:** daily `pg_dump` (custom format) plus continuous WAL archiving (pgBackRest or wal-g) for point-in-time recovery during the event days, off-site copy, **a tested restore** before cutover, and `pg_stat_statements` + slow-query log + Sentry on. Define RPO/RTO for event days (suggest RPO ≤ 5 min).

### 5.3 PostgREST → SQL rewrite inventory
| Supabase construct | Where | Replace with |
|---|---|---|
| FK-hinted embeds (`players!inner(clubs!inner)`, `clubs:club_id(...)`, `sports:sport_id`) | registrations/with-players, player-numbers, payments, replacements, swaps, brackets | explicit JOINs |
| `.or('a.ilike.%x%,b...')` string filters | players/search, with-players, player-numbers, swaps | parameterised `WHERE ... ILIKE $1` (with `pg_trgm` index if kept) |
| `count:'exact'`, `head:true` | many | `count(*)` / `count(*) OVER()` |
| `.single()/.maybeSingle()` + PGRST116 handling | registered-events, day-registrations, portal-status | `rows[0]`, explicit not-found |
| `.range()` pagination | many | `LIMIT/OFFSET` or keyset (`WHERE id > $last ORDER BY id`) for exports |
| `fetchAllRecords` helpers without ORDER BY | teams, payments stats | single aggregate queries |
| `.in('RMIS_ID', [1000 ids])` | clean, teams, day-registrations | JOIN / `= ANY($1)` / aggregate |
| Realtime channels | configService, bracket pages | polling (§5.2) |
| Storage upload | payment-slips/upload | MinIO |
| Browser clients (anon key) | bracket pages, adminClubStatsService, configService | server API |

About 60 route handlers plus ~12 service modules use Supabase. Port **by domain** behind the same HTTP response shapes so the React pages don't change in the first pass.

### 5.4 Data migration procedure
**Because this is a fresh season, the heavy migration below is reduced to:** (a) create schema v2 empty, (b) sync `clubs` from RMIS (`GET /clubs`), (c) re-add admin `permissions` keyed on `member_id` (look each up via `members/search`), (d) seed settings (sport days, windows, cutoff, fee), (e) take a full archive dump of the old Supabase database and slips for the record. The `membership_id → table_id` re-keying (§4.2) then only matters for **QR codes and any manual carry-over**, not for historical rows. Keep the full procedure below only if some prior-season data is later required.
1. **Inventory live data on Supabase**: row counts, max ids, duplicates for each planned unique constraint, orphaned FKs, NULLs in columns going NOT NULL, and the 4 kinds of `club_points` rows.
2. **Clean** (scripted, reviewed): dedupe `registrations`/`day_registrations`/`teams`, resolve duplicate pending requests, classify `club_points` rows into `kind` (penalty: `sport_id IS NULL`; participation: `place < 0`; placement: `place 1–3`; track by track events), detect and fix duplicate participation rows from the idempotency bug and **double penalties** (these may already be in the data, so verify against intended totals with the user).
3. **Create schema v2** on the target with migrations in git (drizzle-kit). No Supabase `auth/storage/realtime` schemas, no RLS policies.
4. **Export** the public schema data from Supabase (`pg_dump --data-only --column-inserts` or `COPY`), then transform: lowercase/renamed columns, `RMIS_ID → member_id` via the RMIS map (§4.2), text scores → int, identity sequences reset (`setval` to max+1).
5. **Load** into a staging database. Run **validation**: row counts per table, per-club registration counts, per-club points totals before/after, payment totals, number of players per club, unmapped member ids = 0.
6. **Rehearse twice** on staging with a production snapshot, time each step, and run the full app against staging, including a load test (§6, Phase 3).
7. **Cutover** (during a quiet window, not on an event day): enable maintenance mode (RMIS-2 already has a `maintenance` service pattern), final export, load, validate, point the app at the new DB, smoke tests (login via RMIS, register, payment upload, bracket view), then lift maintenance. Keep Supabase **read-only and untouched** for 2+ weeks as rollback, with a documented rollback (re-point env, re-open writes, replay any new rows by hand).
8. **Slips**: copy storage objects to MinIO, rewrite `payment_slips.link`, verify a sample of each club opens.
9. **Decommission** Supabase only after a sign-off and a restore test of the new backups.

### 5.7 Hosting choice: Spaceship (India, RMIS box) vs OVH (Germany, personal VPS)
From the Dokploy monitoring screenshots (left = OVH, right = RMIS/Spaceship):

| | OVH VPS (Germany) | Spaceship VPS (India, hosts RMIS) |
|---|---|---|
| RAM | 11.4 GiB total, **8.99 GiB used now** | **3.82 GiB total**, 2.09 GiB used (during RMIS deadline spike) |
| Disk | 95.85 GB, **87.69 GB used (91%)**, Docker 47 GB | 57.08 GB, 25 GB used, Docker 8 GB |
| CPU | idle (1.7%) | spiking to 100% bursts now (deadline), about 5% average |
| Reliability | crashes sometimes, **manual restarts** | reliable and fast (owner's experience) |
| Distance to users (Sri Lanka) | far (Europe, roughly 150–250 ms) | near (India, roughly 30–80 ms) |

Observations:
- The OVH box is **not actually empty**: 9 GB RAM and 88 GB disk are in use (old containers/volumes), and the disk is 91% full. Clean it up (`docker system prune`, inspect volumes) before deploying anything there.
- **RMIS's box is too small to also host RCL.** 3.82 GiB total with about 2 GiB already used. RCL needs roughly Postgres (0.8–1 GB), PgBouncer, 2 app replicas (0.4–0.6 GB each) and headroom, so about 2.5–3 GB more (estimate, to be load-tested). Never run `next build` on that box; build the image in CI and pull it.
- Sharing one machine couples failures: an RCL burst starves RMIS (login, citations) and the reverse. RMIS being quiet during RCL helps, but a 3.8 GB box leaves no margin.
- A 4-day continuous event on a host that "sometimes crashes and needs manual restarts" is the main risk, so OVH is the wrong **primary**.

**Decision: OVH VPS is the primary.** What that requires:
1. **Find out why it crashes before relying on it.** With 79% RAM and 91% disk used, the likely causes are the OOM killer or a full disk. Check `journalctl -k | grep -i -E "oom|out of memory"`, `last -x reboot`, `df -h`, `docker system df`, and OVH's own console for host events. Clean up leftovers (`docker system prune`, old volumes), enable swap (2–4 GB), and keep disk below 70%.
2. **Crash-proof the stack:** `restart: unless-stopped` on every container, Dokploy health checks, per-container memory limits so one process can't take the box down, log rotation, an external uptime monitor that alerts your phone (UptimeRobot/Better Stack) on `/e-arena`, the leaderboard API and the DB, and disk/RAM alerts at 80%. Write a one-page restart/restore runbook so anyone can recover it.
3. **Backups are the real insurance** (a single box with a history of crashes): continuous WAL archiving + nightly base backup (pgBackRest or wal-g) to **off-site object storage** (Cloudflare R2 / Backblaze B2, cheap), plus MinIO slips synced there. Do **not** use RMIS's small busy Spaceship box as the backup target. Run a **restore drill** on a scratch container before the event, and record the time it takes (target: back up in under 30 min, with at most 5 min of data lost).
4. **Optional warm standby:** a small second VPS on a different provider with a streaming replica for fast failover. Worth it only if the crash history continues. Not required if points 1–3 are done.
5. **Latency (Sri Lanka ↔ Germany, roughly 150–250 ms round trip):**
   - Public pages go through Cloudflare, with snapshot data (§5.8), so visitors rarely wait on the origin.
   - **Admin check-in and scoring are latency-sensitive.** Today check-in does a verification GET and then a POST, and score entry does 3+ round trips. Collapse each to **one request** (one SQL function). Make the scanner UI optimistic (show success immediately, retry in the background) with a local retry queue for dropped connections.
   - RCL ↔ RMIS calls (Germany ↔ India, about 150 ms) are fine for login, but member lists must not be fetched live per page. The worker mirrors them locally (§5.8).
6. **Capacity:** 11.4 GiB RAM is plenty. Suggested budget: Postgres 2 GB (shared_buffers 1 GB), PgBouncer 0.1 GB, 2 app replicas × 0.7 GB, worker 0.5 GB, MinIO 0.5 GB, Dokploy/Traefik about 1 GB, so about 6 GB with headroom. Never run `next build` on the box; build in CI and pull the image.

(Alternative considered: Spaceship India as primary. It is closer and more reliable, but the RMIS box has only 3.82 GiB, so it would need a second instance or an upsize. Kept as the fallback if OVH keeps crashing.)

### 5.8 Caching without stale data: versioned snapshots + background workers
**Why it went wrong last time.** There were several independent caches, none of which knew when points changed: the browser HTTP cache, a 2-minute localStorage cache (jotai atoms with a TTL, `state/store.js`), and TTL guesses on the server. The `_t=Date.now()` and `no-store` request headers in `leaderboardServices.js` were workarounds on top. A TTL cache can only be wrong for up to its TTL; users noticed because points announced at an event must be right the moment they are announced.

**Principles**
1. **Correctness first: one source of truth, explicit invalidation, no TTL guessing.** Cache by *version*, not by time.
2. **Never cache live data in the browser.** Remove the localStorage TTL caches for leaderboard, points, brackets, matches and registration state. Keep client-side storage only for the session and UI preferences.
3. **Tiny, always-validated responses.** Live endpoints send `Cache-Control: no-cache` (the browser must revalidate every time) plus a strong `ETag` equal to the snapshot version. Unchanged data costs a ~200-byte `304`, and changed data is never stale.
4. **Three classes of data**

| Class | Examples | Rule |
|---|---|---|
| A. Live / authoritative | admin pages, a club's own registrations, payments, replacement/swap requests, check-in | Read straight from the DB. Never cached anywhere. |
| B. Derived snapshots | public leaderboard (overall + per category), club details, bracket + standings per sport, schedule summary, club `registered-events` summary, membership/day stats | Computed by a worker into a snapshot table with a `version`. Served with `no-cache` + ETag. |
| C. Reference | events list, clubs list, settings | Fetched once per session with a version query (`?v=<settings_version>`). A change bumps the version, so new URLs are fetched. Safe to cache because the key changes. |

**Snapshot design**
```sql
CREATE TABLE snapshots (
  key         text PRIMARY KEY,            -- 'leaderboard:all', 'leaderboard:community', 'bracket:42', 'schedule', ...
  version     bigint NOT NULL,             -- monotonic, bumped on every recompute that changed data
  data        jsonb  NOT NULL,
  data_hash   text   NOT NULL,             -- skip the version bump if nothing changed
  computed_at timestamptz NOT NULL DEFAULT now()
);
```
- A snapshot is computed by **one SQL function in one statement/transaction** (REPEATABLE READ), so readers never see a half-updated leaderboard, and written with a single upsert (atomic swap).
- `GET /api/public/leaderboard` reads one row (a primary-key lookup, microseconds), returns `ETag: "<version>"`, `Cache-Control: no-cache`. No visitor ever triggers a recompute.
- **Version endpoint** `GET /api/public/versions` returns `{ "leaderboard": 128, "bracket": {"42": 17, ...}, "schedule": 9 }`. Public pages poll it every ~10 s (about 150 bytes) and fetch a snapshot **only when its version changed**. That gives near-real-time updates with no per-visitor DB work.
- **Show freshness in the UI:** "Updated 14:32:07" from `computed_at`, so a wrong-looking number is immediately diagnosable and users trust it.

**Background workers** (one extra container, same image, `node worker.js`; Dokploy runs it as a separate app with its own memory limit)
- Job queue **in Postgres** (`pg-boss` or `graphile-worker`), so no Redis is needed. The worker uses a **direct** Postgres connection (not PgBouncer transaction mode) because it uses `LISTEN/NOTIFY` and advisory locks.
- **Event-driven recompute:** a DB trigger (or the SQL function that wrote the data) does `NOTIFY rcl_changed, 'leaderboard'` / `'bracket:42'` when `club_points`, `matches`, `teams`, etc. change. The worker debounces about 1 s, recomputes just that snapshot, bumps the version if the hash changed, and (optionally) purges the Cloudflare cache tag. Typical lag from a score save to the public page: 1–11 s (1 s recompute + up to 10 s poll).
- **Safety sweep:** every 30 s, recompute all live snapshots regardless of notifications, so a missed NOTIFY can't leave a stale snapshot.
- **Reconciliation job** (every 5 min): recompute the leaderboard from raw `club_points` and compare with the snapshot. A mismatch raises an alert. This catches both worker bugs and bad data (e.g. duplicate penalty rows).
- **Degraded mode:** if a snapshot is older than 60 s, the API recomputes it inline (guarded by a single-flight advisory lock so 2000 visitors don't trigger 2000 recomputes) and logs/alerts. A dead worker slows things slightly but never serves stale points.

| Job | Trigger | Output |
|---|---|---|
| `leaderboard` | NOTIFY on `club_points` + 30 s sweep | `leaderboard:all`, `:community`, `:university` (ranks with ties) |
| `bracket(sport_id)` | NOTIFY on `matches` | `bracket:<id>` (rounds, standings) |
| `schedule` | NOTIFY on `matches`/`events` | one summary snapshot (replaces the N+2 calls) |
| `club_registered_events` | NOTIFY on `registrations` / `day_registrations` | per-club summary for the RMIS-called endpoint (§2.9) |
| `rmis_members_sync` | every 1–2 min (`members/changes?updatedSince`) + manual "refresh club" | local mirror of members: status, `club_id`, NIC, `created_at`. Portal pages read the mirror, not RMIS, so RMIS slowness or an outage doesn't slow registration. |
| `rmis_clubs_sync` | daily + manual | `clubs` (category from `club_type`) |
| `membership_stats` / `payment_summary` / `day_stats` | NOTIFY + sweep | admin dashboard snapshots (class B, admin-only) |
| `reconcile` | every 5 min | alert on mismatch |
| `backup_check` | hourly | alert if the last WAL archive/base backup is older than a threshold |

**Cloudflare (CDN) rules**
- Respect origin headers. Never "Cache Everything" on HTML or `/api/*`.
- Static assets (`/_next/static/*`): `immutable, max-age=1y` (content-hashed, safe).
- Public snapshot endpoints: either bypass, or cache for **at most 5 s** with the same ETag, and let the worker purge by cache tag on change. With the 10 s client poll and 304 revalidation the CDN is optional; the origin cost is already one PK read per request.
- Make sure Cloudflare doesn't enable features that rewrite or cache dynamic responses (Rocket Loader, "Always Online", aggressive browser-cache TTL override).

**Next.js specifics:** `export const dynamic = 'force-dynamic'` on live routes; `fetch(url, { cache: 'no-store' })` for class A; remove the `_t=Date.now()` hack (ETag makes it unnecessary); delete the `atomWithStorage` caches for live data; no service worker for data.

**Tests to add (acceptance criteria)**
1. Award points → `GET /leaderboard` shows them within 12 s with no hard refresh, in a browser that loaded the page before.
2. Save a match score → the bracket page updates within 12 s; the winner advances.
3. Kill the worker → the next request detects the stale snapshot and recomputes it inline; an alert fires.
4. Duplicate `NOTIFY`s and concurrent recomputes produce one consistent snapshot (no version regressions).
5. `ETag` / `304` behaviour verified with curl and with two browsers.
6. Load: 2000 concurrent pollers sustain with the DB at under a handful of queries/second.

### 5.6 Four-day continuous operation (RCL event days)
RCL runs 4 days back to back, with check-in scanning, score entry and 2000+ public viewers at once. Requirements for the new stack:
- **No maintenance window on event days.** Freeze the schema and deploys from the day before; deploys only via zero-downtime rolling replicas.
- **Writes stay cheap and atomic:** check-in (`day_registrations` insert with `ON CONFLICT DO NOTHING`), score save + advance (one SQL function), points awards (idempotent). No per-request full-table reads.
- **Public reads never recompute per visitor, and never serve stale data:** pre-computed, versioned snapshots maintained by background workers, validated by ETag, with no browser or localStorage caching of live data (§5.8). Live updates by polling a tiny version endpoint every 10 s.
- **RMIS dependency isolation:** login needs RMIS, nothing else does. Cache member lists (2–10 min, serve stale on error), 5 s timeout, and keep already-issued sessions valid (24 h) so an RMIS outage doesn't stop check-in staff who are already logged in. Pre-warm member caches for all 90+ clubs before each day.
- **Observability:** Sentry, `pg_stat_statements`, PgBouncer stats, a simple uptime check on `/e-arena` and the leaderboard API, alerts on 5xx rate and DB connections.
- **Backups:** WAL archiving + a snapshot at each day's end, and a rehearsed restore.
- **Load test before the event:** public burst (2000 concurrent), registration opening burst (90 clubs), and a check-in burst (scanners on multiple devices).

### 5.5 Capacity guidance (to be validated)
- Expected load is small for writes (1500 players, 90 clubs) and read-heavy for public pages. With cache headers, a CDN, and the views, Postgres sees tens of queries per second even at 2000 concurrent visitors. Without caching it sees the roughly 88k-queries-per-burst behaviour described earlier.
- Pool math: Postgres `max_connections` is shared with RMIS (its pool is 10 per app instance). Give RCL its own PgBouncer pool (e.g. 20 server connections), per-instance `max` 3–5, and keep `max_connections` headroom for migrations/admin. **[VERIFY VPS RAM/CPU]**. RMIS-2 compose caps (1 GB app, 512 MB MinIO) suggest a small VPS, and co-hosting Postgres + RMIS + RCL + MinIO may need an upgrade before the season.

---

## 6. Phased plan

**Phase 0: Decisions and prerequisites (RMIS team + you)**
- Answer the open questions (§7). Check prod RMIS: status distribution, `created_at` backfill, how many RCL users have onboarded, `roles` ids, Postgres version/capacity.
- RMIS builds the endpoints in §2 (and per-client keys, rate limiting). RCL builds against a mock until then.

**Phase 1: New data layer on Postgres (staging)**
- Schema v2 + migrations + SQL functions + views. Port API routes domain by domain (registrations/players → payments → teams → replacements/swaps/penalties → brackets/points/leaderboard → admin/stats). Remove browser DB clients and Realtime. MinIO for slips.
- Fix while porting (don't carry bugs over): the findings in `SYSTEM_ANALYSIS.md` (penalty idempotency, `clean`, 1000-row reads, approve/reject guards, advancement, `club-details` paid, payments search, etc.).

**Phase 2: Auth + RMIS integration**
- `lib/rmis/client`, verify-based login, session shape, middleware authorization, member lists/sync/search/clubs on the new endpoints, `member_id` re-keying, QR compatibility, secured `registered-events` endpoint for RMIS.
- Onboard all admins/presidents/secretaries in RMIS 2.0 and test logins for every club. Produce a "not yet onboarded" report.

**Phase 3: Hardening and load test**
- Cache headers/CDN and the schedule summary endpoint. k6/Artillery scenarios: 2000 concurrent public visitors (leaderboard, schedule, player lookup), 90 clubs registering at once at opening time, admin check-in bursts on event day. Verify no query exceeds budgets (`pg_stat_statements`), PgBouncer isn't saturated, and the app replicas and VPS resources hold up.
- Restore test from backup. Chaos checks: RMIS down (cached members, clear errors, login unavailable but public pages fine), DB failover/restart.

**Phase 4: Go-live and decommission.** Fresh season, so there is no data cutover. Deploy to Dokploy, re-create reference data (clubs sync, admin permissions, settings), archive the Supabase data (dump + slips) and then shut Supabase down after sign-off. Remove the Firebase config and dependencies.

---

## 7. Status of earlier questions, and what remains

| Question | Answer |
|---|---|
| Which season's data moves? | **Fresh season** (§0) |
| Where does RCL run? | **VPS + Dokploy** (§0, §5.2) |
| Role mapping | **Keep roles 1–6 portal, 1–4 admin** (§0). Still confirm the RMIS-2 `roles` ids 1–6 are the same roles as RMIS-1 (President=5, Secretary=6). |
| RI number | **RCL-typed** (§0) |
| RMIS-1 API | **Already down**. RMIS 2.0 is the only source |
| Status codes | **Confirmed**: 1 active, 2 inactive, 3 transferred, 4 terminated, 5 prospective |

**Resolved:** reserves count (all rows); cutoff = `created_at` (no backfill needed); gender `O` = test accounts only; hosting = OVH primary with off-site backups; caching = versioned snapshots + workers (§5.8).

**Still open (small):**
1. Diagnose the OVH crashes (OOM/disk, §5.7 step 1) and clean the box. Pick the off-site backup target (R2 or B2).
2. Confirm where the RMIS-2 Postgres runs (repo docs say an external VPS, so they may be outdated). Only matters for latency, not design.
3. When the RMIS endpoint documentation arrives, re-check §2 (field names, error codes, pagination, rate limits, `created_at` timezone). The worker's `members/changes` feed (§2.4) becomes **required**, not optional, under §5.8.
4. Is Cloudflare (or another CDN) in front of the domain today?
