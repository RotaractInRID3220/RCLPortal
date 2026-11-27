# Rotaract Champions League (RCL) portal

Next.js 15 (App Router, JS) + self-hosted Postgres + RMIS 2.0 REST API. Members and clubs come from RMIS (mirrored locally by a worker); everything else (registrations, payments, check-in, brackets, points, leaderboard) lives in Postgres.

## Run locally
1. Postgres: create a database and the roles in `db/setup_roles.sql`; copy `.env.example` to `.env.local` and fill it in (see `docs/LOCAL_DEV.md`).
2. `npm ci && npm run db:migrate && npm run db:seed`
3. RMIS: point `RMIS_API_URL` / `RMIS_API_KEY` at RMIS (the RCL key, not the public-API key), or run the offline stand-in with `npm run mock:rmis` (URL `http://localhost:4010/api/public/rcl`, key `local-mock-rmis-key`).
4. `npm run dev` (web) and `npm run worker` (RMIS sync + leaderboard snapshots) in two terminals.
5. `npm test` (needs the dev database; runs serially).

## Where things are
* `src/server/` domain logic (registration, payments, changes, check-in, tournaments, track, leaderboard, dashboards, auth, settings). `src/app/api/` thin routes. `src/middleware.js` + `server/auth/access-policy.mjs` default-deny access policy.
* `db/migrations/` forward-only SQL; settings (dates, fee, points, penalties, limits, check-in) are edited by a super admin in the app, see `db/SETTINGS.md`.
* `docs/`: `OPERATIONS.md` (deploy, go-live, event days), `RCL_IMPLEMENTATION_PLAN.md` (status + manual QA list), `WP_*.md` per domain, `RMIS_*` requirements shared with the RMIS team.
