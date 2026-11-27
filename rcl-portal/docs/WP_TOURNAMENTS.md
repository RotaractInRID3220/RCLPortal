# WP Tournaments: brackets, games, placement points

Ported from Supabase to the self-hosted Postgres. Service: `src/server/tournaments/service.mjs`. Tests: `tests/tournaments.test.mjs` (23 tests, dev DB, ids: clubs 9601-9699, event prefix `__tn_`, actor 930001).

## Migration
`0007_matches_unique_slot.sql`: unique index `uq_matches_slot (sport_id, round_id, match_order)` (a slot holds one match; makes double "generate" / duplicate manual adds harmless). `matches` and the placement unique key `uq_points_club_sport_kind` already existed.

## Bracket model
- round_id: 0 R32, 1 R16, 2 QF, 3 SF, 5 Final, 4 Consolation (3rd place, fed by the semi-final LOSERS). Same numbering as before, so the pages/e-arena keep working.
- `parent_match1_id / parent_match2_id`: winner of parent N goes to team N of the child (loser if the child is round 4).
- `completed` + integer scores; NULL = not played, 0 is a real score. Status shown to users comes from `completed`, not from "score > 0".

## Routes
| Route | Access | Notes |
|---|---|---|
| GET /api/brackets?sport_id=&raw=1 | public, `no-store` | rounds for react-brackets (`data`); `raw=1` also returns flat `matches` with `team1.club` (mobile admin). No `sport_id` = all events (e-arena schedule). |
| POST /api/brackets | admin | `{match_id, team1_score, team2_score}` enter/correct (advances winner); `{action:'clear', match_id}`; `{action:'generate', sport_id, replace?, force?}` |
| GET/POST/PUT/DELETE /api/games | admin (also GET, added to the access policy) | raw match CRUD (teams, round, order, parents, start_time). Scores are NOT accepted here. |
| GET /api/leaderboard/tournament-standings?sportId= | admin | computed from matches on every call |
| POST /api/club-points/award `{sport_id}` | super_admin (first award), administrator (re-award) | client no longer sends standings; the server recomputes |

## Rules implemented
- Score entry: one transaction, per-event advisory lock + row locks. Integers only (digit strings accepted from forms). Equal scores refused (`tie_not_allowed`, a knockout needs a winner). Walkover: enter any winning score (e.g. 1-0 or 3-0), there is no separate flag.
- Idempotent: same score again = `changed:false`, no second audit row, no re-advance.
- Correction: winner/slot is re-propagated while the next match has no result (same winner always fine). If the next match already has a result that depends on this one: 409 `next_match_has_result` and nothing changes; clear that result first (new "Clear result" button). Clear (`action:'clear'`) is refused the same way, otherwise empties the advanced slots.
- Manual match edits: teams of a completed match cannot be changed (`match_completed`); deleting a played match clears the slot it advanced into, refused if that next match has a result.
- Generate: from the event's `teams` (create them via Teams page first), ordered by seed_number then team_id, standard seeding, top seeds get byes (a bye creates no match, the team is placed in its round-2 slot). 2-32 teams. Consolation match added when there are two semi-final matches. Existing bracket: 409 `bracket_exists`; `replace` rebuilds; played brackets need `force` (deletes results). Concurrent calls: exactly one wins.
- Standings: 1st/2nd = final, 3rd/4th = consolation, else semi-final losers by their semi score (one loser only when the other semi had a bye; equal scores share 3rd with `tie:true`), everyone else by points scored (`provisional:true`, 0 points). Points only from decided places via `points.placement`.
- Award: needs a played final (409 `final_not_played`), setting must be valid (503 otherwise, fail closed). Writes `club_points kind='placement'` with `ON CONFLICT (club_id, sport_id, kind) DO UPDATE`, deletes placement rows of clubs that no longer place, advisory lock per event. If 3rd is not decided yet only 1st/2nd are written (`incomplete_podium`), award again later. Audit: `placement.award`, `match.*`, `bracket.generate`.

## Decisions
- Award permission mirrors the track award: first award super_admin, re-award administrator (brief said super_admin; re-award is stricter, as in track).
- Realtime (Supabase channel) replaced by polling: admin 10 s, portal 15 s, only while the tab is visible, `no-store`. e-arena pages are one-shot loads.
- Bracket "date" strings are formatted server-side in Asia/Colombo; seeds also carry ISO `start_time`. Admin forms convert local datetime to ISO before sending.
- Participation points are NOT written here (own service); placement rows never touch them.

## Pages needing manual browser QA
- /admin/dashboard/bracket/[sportid] (desktop): create bracket from teams, enter score incl. 3-0, correct score, clear result, tie error toast, add/edit/delete match, polling refresh.
- /admin/dashboard/bracket/mob/[sportid]: same on mobile, edit dialog start time.
- /portal/dashboard/bracket/[sportid]: bracket renders and refreshes without reload.
- /admin/dashboard/leaderboard/[sportid]: standings list and "award points" (messages from the server).
- e-arena schedule pages (public): recent matches and per-sport schedule.
