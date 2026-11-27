# Production database (sandinu-vps, Dokploy)

How the RCL production Postgres is built, accessed, changed, backed up and restored. This is the working guide for the production environment. Set up 2026-11-26.

**No credentials are in the repo.** They live in `~/.rcl-prod-secrets.env` on the owner's Mac (gitignored home file) and, for the local tunnel setup, in `.env.vps.local` (gitignored). Never paste them into chats, tickets or docs.

---

## 1. Overview

```
 Mac (dev)                         sandinu-vps (OVH, Dokploy / Docker Swarm)
 ─────────                         ───────────────────────────────────────────────
 npm run tunnel:vps ──ssh -L──►  127.0.0.1:55432 ─► socat (temp) ─┐
 npm run dev:vps                                                   ▼
                                  dokploy-network ──────────►  rcl-db-w0lofd:5432   (Postgres 18, project "RCL")
 browser ──https──► Traefik ─► Drizzle Gateway (rcl_studio, read-only) ─┘            ▲
                                                         RCL app + worker (to be deployed) ─┘
                                                         Dokploy backups ─► Cloudflare R2 (rcl-db-back)
```

| Item | Value |
|---|---|
| Dokploy project | `RCL` (production environment) |
| Postgres service | `rcl-db` (swarm service `rcl-db-w0lofd`), image `postgres:18` (same major as dev), database `rcl`, volume `rcl-db-w0lofd-data` |
| Network exposure | internal `dokploy-network` only. **No published port**, nothing listens on the host. The app uses host `rcl-db-w0lofd`, port 5432 |
| Resources | 3 GiB memory limit (1 GiB reserved), 3 CPUs. The VPS is shared with mail, MinIO and other projects |
| Durability | data checksums on; `fsync`, `synchronous_commit`, `full_page_writes` on; `wal_level=replica` |
| Safety timeouts | `idle_in_transaction_session_timeout=60s`, `lock_timeout=10s`, slow-query log at 500 ms, SCRAM-SHA-256 passwords, timezone UTC, UTF8 |
| Tuning | `shared_buffers=768MB`, `effective_cache_size=2GB`, `work_mem=8MB`, `max_connections=100`, SSD-friendly planner settings (set as `args` on the Dokploy service) |

## 2. Roles (least privilege)

| Role | Purpose | Can | Cannot | Limits |
|---|---|---|---|---|
| `rcl_migrator` | owns the database and schema; runs migrations; Gateway edit connection | DDL, everything on its schema | superuser actions | 5 connections |
| `rcl_app` | the portal app and worker (`DATABASE_URL`, `DATABASE_DIRECT_URL`) | SELECT/INSERT/UPDATE/DELETE, sequences, functions | DDL, read `schema_migrations` | 40 connections, 20 s statement timeout |
| `rcl_ro` | public read-only routes (`DATABASE_RO_URL`) | SELECT on public data | write; read `players`, `rmis_members`, `permissions`, `payment_slips`, `audit_log`, `schema_migrations` | 20 connections, 5 s timeout, forced read-only |
| `rcl_studio` | Drizzle Gateway browsing (`DATABASE_STUDIO_URL`) | SELECT on **all** tables and sequences (future tables too) | any write, DDL, `nextval` | 5 connections, 30 s timeout, forced read-only |
| `rcl_admin` | Postgres superuser | everything | – | admin and restore work only; never used by the app |

Access to the `rcl` database is revoked from `PUBLIC`; only the roles above may connect. Role passwords are set in the database, not in config files. `db/setup_roles.sql` creates the first four roles; `rcl_studio` was added afterwards (see section 8).

## 3. Schema and migrations

- Source of truth: `db/migrations/*.sql` (hand-written, forward-only, checksummed in `schema_migrations`). Applied on production: **0001-0013** + `db/seed/reference.sql` (event days, default settings).
- `db/grants.sql` is re-applied after every migration run, so new tables are readable/writable by `rcl_app` automatically. Default privileges also cover `rcl_studio`.
- **Drizzle ORM** is a typed query layer on the same pg pool (`src/server/db/drizzle.mjs`, schema in `src/server/db/schema.mjs`). The SQL files stay authoritative because triggers, partial indexes, advisory locks and grants live there. After each migration run `npm run db:pull`; `tests/drizzle.test.mjs` fails if the schema file drifts. **Never run `drizzle-kit push` or `migrate`.**

### Making a schema change safely
1. Write `db/migrations/00NN_name.sql` (additive when possible; never edit an applied file).
2. Test it locally (`npm run db:migrate`, `npm test` on `rcl_v2_dev`).
3. Check a recent backup exists (hourly R2 job; section 6). For anything risky, trigger a manual backup first (Dokploy -> `rcl-db` -> Backups -> run now).
4. `npm run tunnel:vps` in one terminal; in another `npm run db:status:vps` then `npm run db:migrate:vps`.
5. `npm run db:pull` against the local database and commit the updated `schema.mjs`.

## 4. Working from your Mac

| Command | Effect |
|---|---|
| `npm run tunnel:vps` | starts a loopback-only helper on the VPS and a tunnel to `127.0.0.1:55432`; Ctrl+C closes both |
| `npm run dev:vps` | runs the portal against the production database (add `-- -p 3100` if your normal dev server is up) |
| `npm run worker:vps` | runs the worker (RMIS sync, snapshots, reminders) against production |
| `npm run db:status:vps` / `db:migrate:vps` | list / apply migrations on production |
| `npm run dev`, `db:*`, `npm test` | unchanged: use `.env.local` (local `rcl_v2_dev`) |

- `.env.vps.local` holds the four `DATABASE_*` URLs pointing at `127.0.0.1:55432`. Passwords containing `@` etc. must be percent-encoded in URLs (`@` = `%40`).
- **Tests never run on production.** `npm test` runs `scripts/guard-test-db.mjs` first and refuses any database not ending in `_dev` or `_test`. To verify on the server's Postgres, create a throwaway database (e.g. `rcl_test`, owner `rcl_migrator`), seed it, run the suite, drop it. Run that from a container on `dokploy-network` (over the tunnel it is far too slow).
- Only one tunnel at a time. If `npm run tunnel:vps` says the port is in use, an old one is alive: `pkill -f vps-tunnel.sh; pkill -f "ssh -N .*55432"`.
- Admin shell: `ssh sandinu-vps 'docker exec -it $(docker ps -q --filter name=rcl-db-w0lofd) psql -U rcl_admin -d rcl'` (connections from inside the container are trusted; use roles over the network when testing permissions).

## 5. Drizzle Gateway (Studio)

- Public URL: https://rcl-drizzle-gateway-lh75vl-38fb82-51-178-82-232.sslip.io (Traefik + Let's Encrypt). It is also bound to `127.0.0.1:4983` on the VPS (`ssh -L 4983:127.0.0.1:4983 sandinu-vps`).
- Protected by a **master passcode only** (`GATEWAY_MASTERPASS` in the secrets file); change it by editing `MASTERPASS` in the Dokploy compose environment and redeploying.
- The saved connection "RCL (read-only)" uses `rcl_studio`. Use `rcl_migrator` only deliberately, for edits.
- Connection settings are stored in the `rcl-drizzle-gateway-lh75vl_drizzle-gateway` volume (`store.json`). `Reset Data Studio` only clears browser state; to change a login, edit the connection in the UI (or the store file with the container stopped).
- Why `rcl_studio` exists: the Gateway introspects every table and sequence; `rcl_ro` is blocked from some, which made it crash (`Identity ...audit_log.id columns missing metadata`).

## 6. Backups and restore

| Layer | Schedule | Kept | Where |
|---|---|---|---|
| Dokploy -> Cloudflare R2, hourly | `0 * * * *` | latest 48 | `rcl-db-back` / `rcl-db-w0lofd/rcl/hourly/<timestamp>.sql.gz` |
| Dokploy -> Cloudflare R2, daily | `30 3 * * *` (UTC) | latest 30 | `rcl-db-back` / `rcl-db-w0lofd/rcl/daily/...` |
| Local second copy on the VPS | `30 3 * * *` (UTC) | 14 days | `~/rcl-backups/rcl-<ts>.dump` (`pg_dump -Fc`, verified with `pg_restore --list`) + `globals-<ts>.sql` (roles) |

R2 destination: Dokploy destination `sandinu-cloudflare`. Dokploy dumps contain database `rcl` only (not roles).

**Restore procedure (always into a scratch database first):**
1. `CREATE DATABASE rcl_restore_check;` (as `rcl_admin`).
2. R2 dump: Dokploy -> `rcl-db` -> Backups -> Restore, or download the `.sql.gz` and `gunzip -c file.sql.gz | psql -U rcl_admin -d rcl_restore_check`. Local dump: `pg_restore -U rcl_admin -d rcl_restore_check --no-owner --exit-on-error file.dump`.
3. Compare table, trigger and row counts with `rcl`; run a few queries. Drop the scratch DB.
4. To replace production: stop the app and worker, restore, re-run `db/grants.sql` as `rcl_migrator` (and the `rcl_studio` grants if missing), start the app. Roles come from `db/setup_roles.sql` / `globals-*.sql` on a rebuilt server.

Verified: restore drill from the local dump on 2026-11-26 (23 tables, 13 triggers, seed rows identical); R2 hourly upload verified (first object 11.8 KB).
**Still to do:** a restore drill from an R2 object before the event.

## 7. Data currently in production

Loaded 2026-11-26 (no mock or test data):
- reference data from `db/seed/reference.sql` (event days D-01..D-05, default fees/points/penalty settings);
- all 125 clubs and 38,168 members mirrored from live RMIS (`syncClubs`, `syncChangesOnce`); the change-feed watermark is saved, so the worker continues incrementally;
- one permission row: member 21532 (Sandinu Pinnawala) as `administrator` (highest level; the app refuses to demote or remove the last administrator, or yourself).

Deliberately **unset**: `membership.cutoff`, `registration.open_at/close_at`, `checkin.open` (fail closed: registration stays shut until an admin sets them in Portal Settings). No events, players, registrations or announcements yet; create events in the admin portal.

## 8. Operations cookbook

- **Add an administrator:** admin portal -> Permissions (administrator only), or `INSERT INTO permissions (member_id, permission_level, card_name) ...` as `rcl_admin`.
- **Rotate a role password:** `ALTER ROLE <role> PASSWORD '...'` as `rcl_admin`, then update the secrets file, `.env.vps.local`, the Dokploy app env and the Gateway connection (for `rcl_studio`). Restart the app/worker.
- **Recreate `rcl_studio`** (for example after a rebuild), as `rcl_admin` on `rcl`:
  `CREATE ROLE rcl_studio LOGIN PASSWORD '...' CONNECTION LIMIT 5; ALTER ROLE rcl_studio SET default_transaction_read_only = on; ALTER ROLE rcl_studio SET statement_timeout = '30s'; GRANT CONNECT ON DATABASE rcl TO rcl_studio; GRANT USAGE ON SCHEMA public TO rcl_studio; GRANT SELECT ON ALL TABLES IN SCHEMA public TO rcl_studio; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO rcl_studio; ALTER DEFAULT PRIVILEGES FOR ROLE rcl_migrator IN SCHEMA public GRANT SELECT ON TABLES TO rcl_studio; ALTER DEFAULT PRIVILEGES FOR ROLE rcl_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO rcl_studio;`
- **Resize resources:** Dokploy -> `rcl-db` -> Advanced -> Resources (memory is bytes, CPU is nano-CPUs, e.g. 3 CPUs = `3000000000`); redeploy. Postgres settings are `args` on the same page.
- **Watch:** `/api/public/health` (`db_ms`, `snapshot_age_s`, `rmis_sync_age_s`), Dokploy graphs, `docker logs $(docker ps -q --filter name=rcl-db-w0lofd)` (slow queries, lock waits, checkpoints).
- **Never** publish port 5432 on the host, run tests on `rcl`, or use `drizzle-kit push`.

## 9. Open items

- App + worker are not deployed yet (Dokploy app + domain + env from the secrets file; `DATABASE_*` hosts use `rcl-db-w0lofd:5432`).
- Restore drill from an R2 object (section 6).
- The other project's Postgres (`lmsv-db`) is published on `0.0.0.0:5542` (Docker bypasses UFW). The owner decided to leave it.
- The Gateway is public behind a single passcode; consider Cloudflare Access or a custom domain with basic auth in front if it stays public after the event.
- Rotate the Gateway passcode and DB passwords if the setup session transcript is shared (they appeared in tool output).
