-- One-off bootstrap, run by a superuser (local dev, or the Postgres container on the VPS).
--   psql -d postgres -v migrator_pw=... -v app_pw=... -v ro_pw=... -v dbname=rcl -f db/setup_roles.sql
-- rcl_migrator owns the schema (DDL), rcl_app does reads/writes, rcl_ro is for public read-only routes.
SELECT format('CREATE ROLE rcl_migrator LOGIN PASSWORD %L', :'migrator_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rcl_migrator') \gexec
SELECT format('CREATE ROLE rcl_app LOGIN PASSWORD %L', :'app_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rcl_app') \gexec
SELECT format('CREATE ROLE rcl_ro LOGIN PASSWORD %L', :'ro_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rcl_ro') \gexec
SELECT format('CREATE DATABASE %I OWNER rcl_migrator', :'dbname')
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname') \gexec
