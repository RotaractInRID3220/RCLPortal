-- Re-run after every migration (idempotent). Connect as rcl_migrator to the RCL database.
GRANT USAGE ON SCHEMA public TO rcl_app, rcl_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rcl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rcl_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rcl_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rcl_ro;
-- the app never touches the migration bookkeeping table
REVOKE ALL ON schema_migrations FROM rcl_app, rcl_ro;
-- public read role must never see personal data tables
REVOKE ALL ON players, rmis_members, permissions, payment_slips, audit_log FROM rcl_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE rcl_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rcl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rcl_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rcl_app;
