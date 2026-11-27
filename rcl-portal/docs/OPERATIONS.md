# RCL v2: operations, deployment and go-live

## Services (Dokploy on the OVH VPS)

The production database (Postgres 18 on Dokploy, roles, backups to R2, tunnel workflow, Drizzle Gateway) is documented in [VPS_DATABASE.md](VPS_DATABASE.md).

| Service | Image / command | Notes |
|---|---|---|
| `rcl-web` | `Dockerfile` default (`node server.js`, port 3000) | health check `GET /api/public/health` (200 = DB reachable; returns snapshot and RMIS-sync age in seconds) |
| `rcl-worker` | same image, command `node scripts/worker.mjs` | RMIS change sync (default every 90 s), clubs sync hourly, leaderboard snapshot rebuild (LISTEN/NOTIFY + 10 s fallback). Restart policy: always |
| `rcl-db` | Postgres 16+ | create roles with `db/setup_roles.sql`, then `npm run db:migrate` (uses `DATABASE_MIGRATOR_URL`), first deploy also `npm run db:seed` |
Env vars: see `.env.example`. Generate a NEW `NEXTAUTH_SECRET` and obtain a fresh production `RMIS_API_KEY` (the key used in local testing must not be used in production).
Deploy order: build image -> run `npm run db:migrate` (one-off job) -> start web + worker. Migrations are forward-only; never edit an applied one.

## First-time setup checklist
1. `db:migrate` + `db:seed`, then insert the first administrator (SQL): `INSERT INTO permissions (member_id, permission_level) VALUES (<RMIS member_id>, 'administrator');` (the member must be an RMIS member with role 1-4).
2. Sign in as that administrator, open the super-admin settings screen and **confirm every seeded value** (fee, points, penalty tiers, limits are flagged "unconfirmed" until saved), then set the dates: membership cutoff, registration open/close, replacement window, event start. Set the day check-in day (`checkin.current_day`) and flip check-in on only on event days.
3. Check `GET /api/public/health` shows `rmis_sync_age_s` small (worker is syncing) and `snapshot_age_s` present.
4. Run the RMIS production checks listed in `RMIS_RCL_BRANCH_CHANGES.md` Change 4 (status distribution, roles 1-6, test-account rule, TimeZone) and confirm the transfer fields (`RMIS_TRANSFER_REQUIREMENT.md`) are in the live payload: until they are, transferred members cannot register.
5. Backups: schedule `ops/backup.sh` nightly (R2/B2 bucket), and do ONE restore drill before the event (`pg_restore` into a scratch database, then open the app against it).

## Event days (D-01..D-04, continuous)
* Morning: set `checkin.current_day`, switch check-in ON (Admin > Portal settings).
* Watch: `/api/public/health` (uptime monitor, alert on non-200 or `snapshot_age_s` > 300 or `rmis_sync_age_s` > 600), Dokploy CPU/memory graphs, `docker logs rcl-worker`.
* Public pages never serve stale data: the leaderboard checks a version counter on every read and rebuilds inline if the worker is down. Browsers revalidate with ETag (304 when unchanged); nothing live is cached in localStorage.
* If the worker dies: web keeps working (inline rebuilds); only the RMIS mirror stops updating. Restart the worker; it catches up from its watermark.
* Penalties are applied once, by an administrator, before the final announcement (Admin > Participation/Penalties).

## Load test
`node ops/loadtest.mjs https://<staging-host> 300 60` (300 simulated visitors, ETag revalidation like the real pages). Suggested pass criteria: 0 errors, p95 < 400 ms. Local single-box result (built app, dev DB, 100 visitors, 15 s): 2499 requests, 0 errors, p95 7 ms. Run it against the OVH staging box (not a laptop) before go-live, and again with the worker running. Registration/payment write paths are covered by the concurrency tests, not by this script.

## Security notes (kept light by the owner's decision)
* API is default-deny (middleware + `access-policy.mjs`, route-file scan test). Club identity always comes from the session.
* Security headers + `no-store` on all `/api/*` are set in `next.config.mjs`. Payment slips are private storage with image sniffing; the database role used by the app has no DDL rights.
* No end-user IPs are collected or sent to RMIS. Login throttling lives in RMIS.

## Open items for the owner
* OVH crash diagnosis (the earlier box crashed under load) and the off-site backup target.
* Staging RMIS deployment + staging key for integration/load tests; fresh production RMIS key.
* `worker.rmis_changes_interval_s` is a SQL-only setting (not in the settings screen).
* First administrators' member ids for `permissions`.

## Performance check (measured 2026-11-27)

`ops/perf-bench.mjs` calls the real server functions against a database with production-scale data (1500 players, 125 clubs, 38k RMIS members, ~4300 registrations), one at a time and under concurrency, plus a 200-player registration rush into one event. Run it only on a `*_dev` / `*_test` database, ideally in a container next to Postgres (over a tunnel the latency hides the real numbers):
`DATABASE_URL=... DATABASE_DIRECT_URL=... node ops/perf-bench.mjs 200 5`

Result on the production VPS (Postgres 18, 3 CPUs, pool of 10): every call is under 20 ms alone; at 200 concurrent callers nothing fails and p99 stays under 2.1 s for the heaviest admin pages (admin dashboard 1.3 s, registrations search 2.1 s) and under 0.2 s for all public and portal pages. 200 registrations into one event finish in 0.77 s (about 290 per second) with no lost or duplicate rows. Buffer-cache hit rate 100 %, no sequential scan on `rmis_members` (the 38k-row table). A pool of 20 was not faster than 10, so `DB_POOL_MAX=10`.
