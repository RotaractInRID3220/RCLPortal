# RMIS-2 `rcl-version` branch: requested changes (round 1)

Date: 2026-11-24. Branch reviewed: `rcl-version` @ `01da05c` (RCL public API).
Audience: whoever implements these in the RMIS-2 repo.
Scope: small follow-ups after reviewing the branch against RCL's needs. The seven endpoints and `health` already match the requirements; nothing below changes an endpoint's URL or its existing fields. Owner decisions are marked **[decided]**.

---

## Change 1: Relax the login throttle and make it configurable  [decided: "keep it open, it doesn't need to be that secure"]

**Why.** `THROTTLE.ip` locks a `client_ip` for 15 min after 20 failures from any usernames. At an RCL event many staff log in from the same venue Wi-Fi, so a few typos could lock everyone out. RCL is a sports portal; availability matters more than strict brute-force protection. Keep the protections that cost nothing (Argon2 concurrency cap, dummy hash, audit log) and loosen the lockouts.

**Where.** `lib/rcl/login.ts` (`THROTTLE`, `throttleRetryAfter`).

**New defaults**

| Scope | Before | After |
|---|---|---|
| `username` + `client_ip` (pair) | 5 failures / 10 min → 15 min lock | **10 failures / 10 min → 5 min lock** |
| `client_ip` (any username) | 20 failures / 10 min → 15 min lock | **disabled by default** |
| `username` (any IP) | 30 failures / 10 min → 5 min lock | **60 failures / 10 min → 5 min lock** |

**Implementation**
- Read limits from environment variables with the defaults above, parsed once at module load (ints, validated, fall back to the default on garbage):

  | Env var | Default | Meaning |
  |---|---|---|
  | `RCL_THROTTLE_PAIR_FAILURES` | `10` | failures per window for username+IP |
  | `RCL_THROTTLE_PAIR_LOCK_SECONDS` | `300` | lock length |
  | `RCL_THROTTLE_IP_FAILURES` | `0` | `0` = IP scope disabled |
  | `RCL_THROTTLE_IP_LOCK_SECONDS` | `300` | lock length when enabled |
  | `RCL_THROTTLE_USERNAME_FAILURES` | `60` | failures per window for username (any IP) |
  | `RCL_THROTTLE_USERNAME_LOCK_SECONDS` | `300` | lock length |
  | `RCL_THROTTLE_WINDOW_SECONDS` | `600` | counting window for all scopes |

- When a scope's `failures` is `0`, skip its query entirely in `throttleRetryAfter` (saves a DB round trip per login and an index scan).
- Keep everything else: failures are still recorded in `rcl_login_attempts`, a success still resets the pair counter, the Argon2 semaphore (max 4) stays, the dummy-hash timing protection stays.
- Add the new variables to `.env.example` and `docker-compose.prod.yml` (commented, with the defaults).
- `THROTTLE` stays an exported constant (it is imported by tests/docs), now built from the env at load time.

**Docs.** Update the throttle table in `docs/RCL-API-USAGE.md` §4.1 and the note about shared Wi-Fi ("the IP scope is off by default; enable it with `RCL_THROTTLE_IP_FAILURES`").

**Acceptance**
- 10 wrong passwords for the same username+IP → the 11th returns `429 rate_limited` with `Retry-After: 300`.
- 50 wrong passwords from one IP across 50 different usernames → **no** `429` (IP scope disabled).
- Setting `RCL_THROTTLE_IP_FAILURES=20` re-enables the IP lock.
- A correct login for that username+IP clears the pair counter.

---

## Change 2: Add `role_id` to the member payloads  [decided: "better to do"]

**Why.** RCL derives portal/admin access from `role_id` at login only. The trigger already bumps `updated_at` when `role_id` changes, but the payload does not contain the role, so the RCL worker sees "something changed" and cannot tell that an admin was demoted. With the role in the feed, RCL can revoke access without waiting for the 24 h session to expire.

**Where.** `lib/rcl/members.ts`.

**Implementation**
- Add `roleId: members.roleId` to `memberColumns`, `role_id` to `MemberRow`, `RclMember` and `toRclMember`.
- Return `role_id` on: `GET /members/changes` (items), `GET /members/{id}` (and `?membershipId=`), `GET /clubs/{clubId}/members` (items). Add `role_id` to the `members/lookup` result too (`LookupRow`/`toFound`), since RCL uses lookup for spot checks.
- Do **not** add `role_label` (RCL maps ids itself); keep payloads small.
- No migration needed (the trigger already covers `role_id`).

**Payload after the change** (club roster / changes / single):
```json
{ "member_id": 1234, "membership_id": "RACOL0042", "card_name": "Jane D", "full_name": "Jane Doe",
  "gender": "F", "status": 1, "nic": "200012345678", "dob": "2000-04-03",
  "club_id": 3, "role_id": 5, "created_at": "2025-06-12T08:30:00.000Z" }
```
(`members/changes` items also keep `updated_at`.)

**Docs.** Update the field lists and examples in `docs/RCL-API-USAGE.md` §4.2–4.5. Mention that `role_id` is included so clients can react to role changes.

**Acceptance**
- Change a member's `role_id` from 5 to 31 → the member appears in `members/changes` with `role_id: 31`.
- The roster, single-member and lookup responses all show the new field.
- Existing consumers still work (additive change only).

---

## Change 3: Purge old `rcl_login_attempts` rows  [decided: "yes better"]

**Why.** The table has no retention. Every login attempt adds a row and each login runs three indexed queries against it, so it should not grow without bound.

**Where.** `lib/rcl/login.ts` (or a small `lib/rcl/maintenance.ts` called from it).

**Implementation (no new infrastructure)**
- Retention: **90 days** (constant, optionally `RCL_LOGIN_ATTEMPTS_RETENTION_DAYS`).
- Opportunistic purge: in `record()`, with probability ~1% (or at most once per hour per instance, tracked in a module variable), run a fire-and-forget batched delete and swallow errors:
  ```sql
  DELETE FROM rcl_login_attempts
  WHERE id IN (
    SELECT id FROM rcl_login_attempts
    WHERE created_at < now() - interval '90 days'
    ORDER BY id LIMIT 5000
  );
  ```
  Batched so it never holds a long lock. It must never delay or fail a login.
- The throttle only looks back `window + lock` (≤ 20 min by default), so 90 days is far beyond what the throttle needs; the rest is audit history.
- Optional: log the number of rows purged at `console.info` when > 0.

**Acceptance**
- Rows older than the retention are removed after enough logins; newer rows are untouched.
- A failing purge (e.g. simulated DB error) does not affect the login response.

---

## Change 4: Production checks before go-live  [decided: "ok"]

Run against the **production** database and report the results back to RCL:

1. `SHOW TimeZone;` — expected `UTC`. Why it matters: `members.created_at` is interpreted in the server's zone by the API, while the `updated_at` trigger stores UTC. If the zone is not UTC, tell RCL (the API output is still correct for `created_at`, but older `updated_at` values written by the column default would be in local time).
2. Status distribution (prospectives must still be `5`; `scripts/migrate-old-data.ts` remaps `5 → 2`, so confirm it was not used in prod):
   ```sql
   SELECT status, count(*) FROM members GROUP BY 1 ORDER BY 1;
   ```
3. RCL users who cannot log in yet (the SQL is in `docs/RCL-API-USAGE.md` §10): send the resulting list (role, club, reason) to RCL so the organisers can chase onboarding before the first event day.
4. Confirm the production `roles` table has ids 1–6 as `1 DRR/RDS, 2 ADRR, 3 RDT, 4 RDSC, 5 President, 6 Secretary`.
5. Review the test-account rule (`notTestAccount`) against real data: list members matching it and confirm none is a real person:
   ```sql
   SELECT table_id, card_name, membership_id, m_username, email, gender
   FROM members
   WHERE coalesce(gender,'')='O' OR coalesce(membership_id,'') ILIKE 'TEST-%'
      OR coalesce(m_username,'') ILIKE 'test.%' OR coalesce(email,'') ILIKE '%@example.com';
   ```

---

## Change 5: Legacy usernames  [decided: "old usernames and passwords will never work"]

No code change. Old RMIS-1 usernames/passwords are not usable in RMIS 2.0 (members re-onboard and pick a new lowercase username), so the mixed-case-username limitation of `auth/verify` is irrelevant in practice.
- Docs only: in `docs/RCL-API-USAGE.md` §7 "Deviations" item 6, reword to say that legacy usernames are not supported and usernames created through onboarding are always lowercase `[a-z0-9._]`.

---

## Change 6 (round 2): make `client_ip` optional on `POST /auth/verify`  [decided: "if it's only for security, remove it"]

**Why.** RCL does not track end-user IPs and the owner does not want it. RMIS currently returns `400 invalid_request` when `client_ip` is missing or not a valid IP, so RCL sends the fixed placeholder `0.0.0.0` (verified working against production).

**Change.** In `lib/rcl/login.ts` make `client_ip` optional in `inputSchema`; when absent use a constant such as `"unknown"` for the audit row and the throttle key (the column is `varchar(45)`). Keep validating it when it **is** supplied. Update the docs (`RCL-API-USAGE.md` §4.1).

**Effect.** Throttling becomes per username (as it already is with the placeholder). Nothing else changes.

**Acceptance.** A login without `client_ip` succeeds and is throttled per username; a login with an invalid `client_ip` string still returns 400. After this ships RCL removes the placeholder.

---

## Deferred

- **Staging deployment** of the branch with a test key and data copy. The owner will provide this later; RCL's integration and load tests wait for it.

---

## Definition of done for this round

- [ ] Throttle loosened and env-configurable (Change 1), with tests for the four acceptance cases
- [ ] `role_id` in roster, changes, single and lookup payloads (Change 2), docs updated
- [ ] Login-attempt purge (Change 3)
- [ ] Production checks 1–5 run and results sent to RCL (Change 4)
- [ ] `docs/RCL-API-USAGE.md` updated (throttle table, field lists, deviations item 6)
- [ ] `tsc` and ESLint pass; existing manual test matrix from `docs/RCL-API-USAGE.md` §8 re-run for login, roster, changes

## What RCL will do on its side (for context, nothing for RMIS)

- Send the end user's real IP as `client_ip` (taken from the CDN/proxy header it controls).
- Poll `members/changes` every 1–2 min with a 2-minute overlap, dedupe on `member_id` + `updated_at`, and mirror members locally.
- Use `role_id` from the feed to revoke portal/admin access when someone's role drops outside 1–6 / 1–4, and `status` to revoke access for inactive/terminated members.
