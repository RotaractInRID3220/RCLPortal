# RMIS-2 requirement: transfer completion date for the membership cutoff

Date: 2026-11-25. Audience: whoever implements this in the RMIS-2 repo (`rcl-version` branch).
**[decided]** No new columns and no migration: once a transfer is `status = 1` its `reviewed_at` is fixed (the final approval's time), so `reviewed_at` is the completion date.

## 1. The rule

RCL only accepts members who were part of the club **before the membership cutoff** (`members.created_at <= cutoff`, already implemented).
New: a **transferred member's transfer must also have been finalised on or before the cutoff**. A transfer that is pending, or finalised after the cutoff, does not count.

## 2. Changes in RMIS (payload + one data touch, no schema change)

### 2.1 New fields on every RCL member payload

Add to `lib/rcl/members.ts` (`RclMember`, `toRclMember`) and return on:
`GET /clubs/{clubId}/members` (items), `GET /members/changes` (items), `GET /members/{id}` (and `?membershipId=`), and the `members/lookup` found result.

| Field | Type | Meaning |
|---|---|---|
| `transfer_completed_at` | ISO-8601 UTC string or `null` | `reviewed_at` of the member's **latest** `member_transfers` row with `status = 1`. `null` = no completed transfer (never transferred, or legacy data). **The key must always be present**, even when null. |
| `has_pending_transfer` | boolean | A transfer request for this member is pending (status 0 or 4). Informational only. |

Implementation: `LEFT JOIN LATERAL (SELECT reviewed_at FROM member_transfers t WHERE t.member_id = m.table_id AND t.status = 1 ORDER BY reviewed_at DESC LIMIT 1)` in the member query, plus an `EXISTS` for the pending flag. Output as UTC ISO with `Z` (if `reviewed_at` is a `timestamp` without zone, interpret it in the server zone; confirm `SHOW TimeZone;`, expected UTC).

Example (transferred member):
```json
{ "member_id": 1234, "membership_id": "RACOL0042", "card_name": "Jane D", "full_name": "Jane Doe",
  "gender": "F", "status": 3, "nic": "200012345678", "dob": "2000-04-03",
  "club_id": 3, "role_id": 31, "created_at": "2025-06-12T08:30:00.000Z",
  "transfer_completed_at": "2026-11-02T09:15:00.000Z", "has_pending_transfer": false }
```

Do **not** change the roster `createdOnOrBefore` filter: RCL applies the transfer rule itself (it must show *why* a member is missing). Existing fields and URLs are unchanged (additive).

### 2.2 One-time touch so the change feed re-sends transferred members

RCL mirrors members from `GET /members/changes`. Run once at deploy time so every transferred member is re-sent with the new field:

```sql
UPDATE members SET updated_at = now()
WHERE table_id IN (SELECT member_id FROM member_transfers WHERE status = 1);
```

(New transfers already bump `members.updated_at` at final approval.)

## 3. Edge cases

1. **Legacy transferred members** (status 3 from the RMIS-1 migration, no `member_transfers` row): `transfer_completed_at` is `null`; RCL treats null as "no late transfer", so they stay eligible.
2. **Transferred twice**: the latest `status = 1` row counts.
3. **Any status**: the date is reported whatever the member's current status is; RCL applies the rule to all.

## 4. How RCL behaves (reference)

* Eligible only if `created_at <= cutoff` **and** (`transfer_completed_at` is null **or** `<= cutoff`). Equal to the cutoff counts as in time.
* If RMIS does **not** send the `transfer_completed_at` key at all (old RMIS), RCL refuses **status 3** members with `transfer_info_unavailable`; active/prospective members are unaffected. Shipping 2.1 before registration opens removes that state.
* Registration and replacements refuse late transfers (`transfer_after_cutoff`, 422). The club's member list hides them and returns them under `excluded` with the reason.
* A registered player whose RMIS completion date is later reported after the cutoff gets the flag `transferred_after_cutoff` (player list + admin flags). Nothing is removed automatically.

## 5. Acceptance tests (RMIS)

1. A member with a `status = 1` transfer returns `transfer_completed_at` equal to that row's `reviewed_at`, in roster, changes, single, `?membershipId=` and lookup.
2. A member with no transfer returns `transfer_completed_at: null` (key present).
3. A member with two completed transfers returns the latest.
4. A pending transfer (status 0/4) gives `has_pending_transfer: true` and does not set `transfer_completed_at`.
5. After the touch in 2.2, `members/changes` returns the transferred members.

## 6. Definition of done

- [ ] Payloads carry `transfer_completed_at`, `has_pending_transfer` (all four places)
- [ ] One-time `updated_at` touch run
- [ ] `docs/RCL-API-USAGE.md` field lists updated
