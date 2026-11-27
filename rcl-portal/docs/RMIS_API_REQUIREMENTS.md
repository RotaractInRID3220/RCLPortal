# RCL → RMIS 2.0: API Requirements

Status: draft for implementation in the RMIS-2 repo. Date: 2026-11-24.
Audience: whoever builds the endpoints in RMIS-2 (Next.js 16 / Drizzle / Postgres, existing `/api/public/*` pattern).
Consumer: the RCL Portal (Rotaract Champions League sports portal, 90+ clubs, 1500+ players, 2000+ public visitors, 4 continuous event days).

RCL used to talk to RMIS 1.0 through a raw-SQL API (`info.rotaract3220.org/api/query`), which is now down. RMIS 2.0's REST endpoints are the only source RCL will use. This document lists exactly what RCL needs. Please send back the final endpoint documentation so RCL can be checked against it.

---

## 1. Decisions already made (do not need RMIS action)

| Topic | Decision |
|---|---|
| RI number | Typed in RCL when a general member (status 1 *active* or 3 *transferred*) is registered for an event. **RMIS does not need to store or expose it.** |
| Roles | Portal access = RMIS `role_id` 1–6. Admin access = `role_id` 1–4. Unchanged from RMIS-1. |
| Status codes | 1 active, 2 inactive, 3 transferred, 4 terminated, 5 prospective. RCL treats **1, 3, 5** as listable and normalises 3 → 1 for "general". |
| Membership cutoff | Uses `members.created_at` (RCL passes a cutoff timestamp). RMIS migration ran once before the cutoff, so all migrated members pass. No backfill needed. |
| Gender | Only `M` / `F` are registrable. Other values appear only on test accounts, which RMIS should exclude from the lists (or flag). |
| Member key | RCL will key players on `members.table_id` (stable). `membership_id` is only returned for display and for resolving printed QR codes, because it changes on club transfer. |
| Season | Fresh season. No historical RCL data needs RMIS. |

---

## 2. Cross-cutting requirements

1. **Routes** under `app/api/public/rcl/*` (middleware already bypasses auth for `/api/public`). Put logic in `lib/rcl/*`. Follow the existing pattern: `validatePublicApiKey(request)` first, snake_case JSON.
2. **A dedicated API key for RCL** (e.g. env `RCL_API_KEY`, scope `rcl`), not the shared `PUBLIC_API_KEY` that the "Join a Club" site uses. Keep the timing-safe compare. Accept `x-api-key` or `Authorization: Bearer`. Support **two valid keys at once** (current + next) so the key can be rotated without downtime.
3. **One error shape** for all RCL routes: `{ "error": { "code": "snake_case_code", "message": "human text" } }`. HTTP status as appropriate (400, 401, 403, 404, 422, 429, 500).
4. **Rate limits / load.** Expected steady load from RCL is small: one `members/changes` poll every 1–2 minutes, a few hundred logins per day (bursts of up to tens per minute on event mornings), 90 club-member fetches at the start of a sync, daily club sync. Allow **at least 600 requests/minute** for the RCL key in total. The **login endpoint has its own, stricter throttle** (section 3.1).
5. **Never return** `m_password`, OTP data, tokens or internal flags. Return NIC and DOB only on the endpoints that list them (3.2, 3.3, 3.5) and note that in the docs.
6. **Pagination** (`limit`, `cursor`) on any list that can exceed ~1000 rows. RMIS has ~30,000 members. Default `limit` 500, max 1000.
7. **Timestamps** ISO-8601 **with timezone** (`2026-10-28T09:14:02.000Z`). `members.created_at` is a `timestamp` without zone in the DB. State in the docs which zone it is stored in (UTC vs Asia/Colombo) and return it unambiguously.
8. **Exclude test accounts** from every list and lookup response, or include `"is_test": true` so RCL can filter. (Gender `O` accounts and `create-test-accounts` accounts, per the owner.)
9. **Caching headers:** `Cache-Control: private, no-store` on auth. `private, max-age=60` on lists is fine; RCL does its own caching and will also run a background sync.
10. **Audit/observability:** write login attempts (success/failure, username, client IP, timestamp) to `audit_log`, and log request counts per client key.
11. **Version/health:** `GET /api/public/rcl/health` returning `{ "status": "ok", "time": "<ISO>" }` (key required), so RCL's monitor and its login page can tell "RMIS down" from "wrong password".

---

## 3. Endpoints

### 3.1 `POST /api/public/rcl/auth/verify` (login)
Replaces RCL's old SQL lookup plus its local MD5 check. **RCL must never see or compare a password hash.**

Request:
```json
{ "username": "jane.d", "password": "••••••••", "client_ip": "203.0.113.5" }
```
- Lowercase and trim `username`. Usernames are `[a-z0-9._]`, 3–30 chars.
- `client_ip` is the end user's IP as seen by RCL (after its proxy). RCL's own server IP is the same for every login, so throttling must use `client_ip` + `username`, not the caller's IP alone.

Logic: reuse the existing `auth.ts` credential flow (lookup by `m_username`, Argon2id `verify`, then club/member status checks). Do **not** reveal whether the username exists.

200 response:
```json
{
  "member_id": 1234,
  "membership_id": "RACOL0042",
  "username": "jane.d",
  "card_name": "Jane D",
  "full_name": "Jane Doe",
  "club_id": 3,
  "club_name": "Rotaract Club of Colombo",
  "role_id": 5,
  "role_label": "President",
  "designation": "President",
  "status": 1
}
```
(RCL derives `hasPortalAccess = role_id in 1..6` and `hasAdminAccess = role_id in 1..4` itself, so no permission keys are required. If RMIS prefers permission keys instead, add `"permissions": ["rcl:portal", "rcl:admin"]` and RCL will use those.)

Errors:
| HTTP | `error.code` | When |
|---|---|---|
| 401 | `invalid_credentials` | unknown user, wrong password, or user not yet onboarded (NULL username/password). Keep it generic. |
| 403 | `club_terminated` | correct password, `clubs.status != 1` |
| 403 | `member_inactive` | status 2 |
| 403 | `member_terminated` | status 4 |
| 403 | `account_restricted` | any status outside 1, 3, 5 |
| 429 | `rate_limited` | throttled. Include a `Retry-After` header. |
| 400 | `invalid_request` | missing or malformed fields |

**Throttling requirements** (RMIS has none today):
- Per `username`: progressive delay or temporary lockout after repeated failures (e.g. 5 failures in 10 minutes → 15 minutes).
- Per `client_ip`: e.g. 20 failures in 10 minutes.
- Design it so an attacker cannot lock out a real admin on event day (e.g. lockout keyed on `username` + `client_ip`, with a higher per-username ceiling and an automatic reset).
- Constant-time behaviour: run a dummy Argon2 verify when the user is unknown, to avoid a timing side channel.
- Argon2 verify costs memory and CPU. Cap concurrent verifications (a small semaphore) so a login burst can't starve the rest of RMIS.

### 3.2 `GET /api/public/rcl/clubs/{clubId}/members`
Replaces the old club-members query (`status IN (1,3,5) AND created_datetime <= cutoff`).

Query parameters:
- `statuses` — comma list, default `1,3,5`.
- `createdOnOrBefore` — ISO-8601 timestamp, compared with `members.created_at`. RCL supplies the cutoff.
- `limit`, `cursor` — optional (a club normally has well under 500 members).

Item:
```json
{
  "member_id": 1234,
  "membership_id": "RACOL0042",
  "card_name": "Jane D",
  "full_name": "Jane Doe",
  "gender": "F",
  "status": 1,
  "nic": "200012345678",
  "dob": "2000-04-03",
  "club_id": 3,
  "created_at": "2025-06-12T08:30:00.000Z"
}
```
- `status` is returned raw (RCL maps 3 → 1).
- Only active clubs (404 `club_not_found` otherwise).
- Order by `card_name`.
- No `ri_number` (typed in RCL).
- Needs an index on `(club_id, status)`.

Used by: RCL's background sync (all ~90 clubs at start, then via 3.4) and an on-demand "refresh this club" button.

### 3.3 `POST /api/public/rcl/members/lookup`
Replaces `sync-rmis`'s giant `IN (...)` query.

Request: `{ "member_ids": [1234, 1240, ...] }` (max **500** per call). Also accept `"membership_ids": ["RACOL0042", ...]` (legacy strings, for resolving printed QR codes).

Response: one entry per requested id, **including ids that no longer qualify**:
```json
{ "results": [
  { "member_id": 1234, "membership_id": "RACOL0042", "found": true,
    "status": 3, "club_id": 7, "nic": "200012345678", "created_at": "2025-06-12T08:30:00.000Z" },
  { "member_id": 999, "found": false }
] }
```
- Return rows for inactive/terminated/transferred members too (status shows it). RCL needs to flag "registered player is no longer active" instead of silently keeping them.
- `club_id` is required: it reveals members who transferred clubs (RMIS-1's sync never could).

### 3.4 `GET /api/public/rcl/members/changes`  *(required)*
Incremental feed. RCL's background worker polls this every 1–2 minutes and keeps a local mirror of members, so portal pages never wait on a live RMIS call and an RMIS slowdown cannot affect registration.

Query: `updatedSince` (ISO-8601, required), `limit` (default 500), `cursor`.

Item: same fields as 3.2 plus `updated_at`. Include a member when any of `status`, `club_id`, `nic`, `card_name`, `full_name`, `gender`, `dob`, or `created_at` changed, **including newly created members and members whose status moved to inactive/terminated/transferred**.

Response:
```json
{ "members": [ ... ], "next_cursor": "opaque-or-null", "server_time": "2026-11-24T10:00:00.000Z" }
```
- `server_time` lets RCL set the next `updatedSince` safely (RCL will subtract a small overlap and dedupe on `member_id` + `updated_at`).
- Stable ordering by `(updated_at, table_id)` so the cursor never skips rows.
- Needs an index on `members.updated_at`. **Confirm that `updated_at` is actually updated on every change to these columns** (including status changes made by transfers, and bulk scripts), otherwise changes will be missed. A DB trigger is the safe way.

### 3.5 `GET /api/public/rcl/members/{memberId}`  (and `?membershipId=`)
Single-member lookup, used when a player QR code is scanned at check-in and for player lookups. Same fields as 3.2. 404 `member_not_found`. Must be fast (primary-key lookup; also an index on `membership_id`, which already has a unique constraint).

### 3.6 `GET /api/public/rcl/members/search?name=...`
Replaces RCL's `search-users` (used to add an RCL admin).
- `name` min 3 characters, **parameterised** `ILIKE` (no string concatenation).
- Returns only admin-eligible members: `role_id` in 1–4 (server-side filter).
- Item: `{ member_id, membership_id, card_name, role_id, role_label, club_id }`. Max 20 results.

### 3.7 `GET /api/public/rcl/clubs`
Replaces hand-entering clubs in RCL.
- Item: `{ club_id, club_name, club_name_short, category, zone, status }`.
- `category`: `Community` → `community`, `Institute` → `university` (same mapping the existing public API uses).
- Active clubs by default. `?includeInactive=true` to include others.
- `club_id` must stay the same stable numeric id (RCL and the RMIS-calling citation checklist both depend on it).

---

## 4. Reverse direction (nothing for RMIS to build, but note)

The `citation-checklist` app calls RCL at `GET https://rcl.rotaract3220.org/api/clubs/{clubId}/registered-events` and reads `data.summary.event_count` (citation met when ≥ 2). RCL keeps that URL and field stable. RMIS-2 itself currently computes its `rclCount` from RMIS events (`events.scope = 1`) and does **not** call RCL. SRS open question #4 ("does RCL stay external?") assumes RCL stays separate. If RMIS-2 later calls RCL directly, tell RCL so a key can be added (the endpoint is unauthenticated, counts only, today).

---

## 5. Data/ops things RMIS should check before go-live

1. **`members.updated_at` is reliably maintained** (3.4 depends on it). Add a trigger if it is only set by application code.
2. **`members.created_at` timezone** is documented and returned with an offset (cutoff comparison).
3. **Test accounts** are identifiable (`is_test` or a rule) and excluded.
4. **Onboarding status of RCL users:** every president, secretary and admin who will use RCL must have onboarded (NIC + email OTP) and chosen a username. Please provide a report of club presidents/secretaries (roles 5, 6) and admins (roles 1–4) with `m_username IS NULL` and the reason they can't onboard (no NIC or email on file), well before the first event day.
5. **Role ids 1–6** in RMIS-2 are the same roles RMIS-1 used (1 DRR/RDS, 2 ADRR, 3 RDT, 4 RDSC, 5 President, 6 Secretary). Confirm no id was renumbered in migration.
6. **Prod status distribution:** `SELECT status, count(*) FROM members GROUP BY 1;` should show prospectives as `5` (one of the two migration scripts, `migrate-old-data.ts`, remaps `5 → 2`; make sure that one was not used in prod).
7. **Capacity and latency:** RCL's server is in Germany (OVH) and RMIS is in India, so round trips are roughly 150 ms. That is fine for login and the background sync. It is why RCL mirrors members locally rather than calling RMIS per page.
8. **Availability:** RCL needs login only. If RMIS is down, RCL keeps working for sessions already issued (24 h), and public pages and check-in are unaffected. Keep RMIS maintenance away from the 4 event days, and give RCL notice of planned downtime.

---

## 6. Acceptance checklist for RMIS

- [ ] Dedicated `RCL_API_KEY` (two-key rotation), `health` endpoint
- [ ] `auth/verify` with typed errors, throttling and audit logging, tested with wrong password, terminated club, inactive member, not-onboarded user, and a 100-login burst
- [ ] `clubs/{id}/members` with `createdOnOrBefore`, test accounts excluded
- [ ] `members/lookup` (500 ids, returns non-qualifying rows with `club_id`)
- [ ] `members/changes` with a stable cursor and `server_time`, verified against a status change, a club transfer and a new member
- [ ] `members/{id}` and `?membershipId=`
- [ ] `members/search` (parameterised, role-filtered)
- [ ] `clubs` list with `category`
- [ ] Documentation (OpenAPI or markdown) with the request/response shapes above, sent back to RCL
- [ ] Items 1–6 in section 5 confirmed


---

## Addendum (2026-11-25): transfer completion date

The membership cutoff also applies to transfers (a transfer must be finalised before the cutoff). RMIS needs two new member payload fields, no schema change (the completion date is `member_transfers.reviewed_at` where status = 1) (`transfer_completed_at`, `has_pending_transfer`). Full requirement: [RMIS_TRANSFER_REQUIREMENT.md](RMIS_TRANSFER_REQUIREMENT.md).
