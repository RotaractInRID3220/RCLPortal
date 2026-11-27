# `settings` keys (editable by admins; nothing here is hard-coded in code)

Values are JSON. A key that is **absent** means "not set yet": the app fails closed (for example
registration stays closed until the dates below exist).

## Seeded defaults (`db/seed/reference.sql`)
| Key | Value | Meaning |
|---|---|---|
| `fees.registration_per_player` | `1000` | Rs. per registered player (club total = players x fee) |
| `points.placement` | `[100,75,50]` | 1st/2nd/3rd in tournaments |
| `points.track_individual` | `[85,50,30]` | 1st/2nd/3rd in individual track events |
| `points.track_team` | `[100,75,50]` | 1st/2nd/3rd in team track events |
| `points.track_participation` | `15` | any other track entry with a score |
| `points.participation_per_sport` | `15` | per sport at the attendance threshold |
| `participation.min_attendance_ratio` | `0.5` | share of registered players that must be checked in on the sport's day |
| `penalty.min_players` | `5` | clubs with fewer players get no penalty |
| `penalty.tiers` | `[{"lt":62,"points":-80},{"lt":67,"points":-50},{"lt":70,"points":-25}]` | general-member share (%) of all the club's players; the first tier (lowest `lt`) the share is **below** applies, none = 0 |
| `limits.groups` | `{"standard":{"per":"day","max":1},"track":{"per":"total","max":3},"swimming":{"per":"total","max":3}}` | registration limits per player, per **limit group** (`events.limit_group`): `standard` = team/individual events, `track` = track events + shot put + discus (individual and team counted together), `swimming` = swimming events. `per` is `day` or `total`. |

Event days seeded: D-01 to D-04 plus **D-05 "Road Race"** (the road race is modelled as its own day, so its participants are never blocked by the one-per-day limit on the other days; whether D-05 also has its own check-in/participation is still to be confirmed, and an admin can edit or delete the day).

## Not seeded (a super admin sets them; absent = closed/unset)
Edited on the screen **Admin > Configurations > Event settings** (super_admin or administrator only). Every change is validated and written to `audit_log`. Times are entered and shown in Sri Lanka time (UTC+05:30) and stored with an explicit offset.

| Key | Type | Meaning |
|---|---|---|
| `registration.open_at` | timestamp | registration opens; unset = closed |
| `registration.close_at` | timestamp | **generic deadline**: used for every sport that has no `registration_close` of its own; unset = no generic deadline. A sport's own deadline always wins. |
| `replacement.open_at`, `replacement.close_at` | timestamps | replacement/swap window (close must be after open) |
| `membership.cutoff` | timestamp | members created in RMIS after this cannot be registered; unset = nobody can be registered |
| `event.start_at` | timestamp | event start, shown as the public countdown |
| `worker.rmis_changes_interval_s` | integer 30-600 | optional: worker RMIS sync interval, default 90 |
| `checkin.open` | boolean | day check-in on/off |
| `checkin.require_registration` | boolean, optional | unset = on: a player with no registered sport on the current day cannot be checked in |
| `checkin.current_day` | day code | the day being checked in (must exist in `event_days`) |

Per-event deadlines stay optional on `events.registration_close` (not required).
Event days are edited on the same screen (code, label, order, date); a day used by sports or check-ins cannot be deleted.
The validation rules for every key live in `src/server/settings/registry.mjs`; the public site reads only dates and day labels through `GET /api/public/event-info`.
