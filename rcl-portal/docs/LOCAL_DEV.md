# Local development (branch `version-2`)

Requires Node 22+ and a local PostgreSQL 14+ (the dev machine uses PostgreSQL 18).

## One-time database setup
```bash
# as a Postgres superuser; pick your own passwords
psql -d postgres -v migrator_pw=... -v app_pw=... -v ro_pw=... -v dbname=rcl_v2_dev -f db/setup_roles.sql
psql -d rcl_v2_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
```
Add to `.env.local` (gitignored):
```
DATABASE_URL=postgresql://rcl_app:<app_pw>@localhost:5432/rcl_v2_dev
DATABASE_DIRECT_URL=postgresql://rcl_app:<app_pw>@localhost:5432/rcl_v2_dev
DATABASE_MIGRATOR_URL=postgresql://rcl_migrator:<migrator_pw>@localhost:5432/rcl_v2_dev
DATABASE_RO_URL=postgresql://rcl_ro:<ro_pw>@localhost:5432/rcl_v2_dev
RMIS_API_URL=http://localhost:4010/api/public/rcl      # the mock; use the real URL + key against RMIS
RMIS_API_KEY=local-mock-rmis-key
```
Then `npm run db:seed` (applies migrations, grants, and reference data: days D-01..D-04 and default settings).

## Everyday commands
| Command | What it does |
|---|---|
| `npm run db:migrate` / `db:seed` / `db:status` | forward-only migrations, + seed data, list applied/pending |
| `npm run mock:rmis` | local stand-in for the RMIS RCL API on :4010 (logins: `test.president` / `test.disco` with `test1234`, `alice.admin`, `pat.president` with `pass1234`) |
| `npm test` | unit + integration tests (needs the local DB; the RMIS client/login tests use the mock) |
| `psql "$DATABASE_MIGRATOR_URL" -f db/tests/schema_constraints.sql` | schema constraint tests (rolled back, safe on any DB) |
| `npm run dev` | the app. Set `NEXTAUTH_URL=http://localhost:3000` locally. |

## File storage (payment slips)
Slips are private files, read only through an authenticated route. `STORAGE_DRIVER=local` (the default when no S3 variables are set) keeps them under `.data/storage` (gitignored). In production use an S3-compatible store (MinIO on the VPS):
```
STORAGE_DRIVER=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=rcl-slips            # private bucket
S3_ACCESS_KEY=...  S3_SECRET_KEY=...  S3_REGION=us-east-1
```
Only JPEG/PNG/WebP up to 5 MB are accepted; the type is read from the file bytes.

## Settings
Event days, fee, points, penalty tiers and limits live in the `settings` / `event_days` tables, not in code. See `db/SETTINGS.md`. Dates are intentionally unset, which keeps registration closed until an admin sets them.

## Notes
- Server code lives in `src/server/*.mjs` (plain ESM so tests can import it). Never import it from client components.
- RCL does not handle end-user IPs. The RMIS client sends a fixed placeholder `client_ip` because RMIS still requires the field.
