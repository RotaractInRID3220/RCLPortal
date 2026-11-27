-- Snapshots (leaderboard etc.) must never be stale. A tiny counter per snapshot family is bumped,
-- in the SAME transaction as the change, by statement-level triggers. A reader compares the
-- snapshot's `source_version` with the counter: smaller means "rebuild now". Because the bump
-- commits together with the data, a snapshot can only be older than the counter when it is stale
-- (never the other way round), and an unchanged counter means nothing needs recomputing.
CREATE TABLE data_versions (
  key       text PRIMARY KEY,
  version   bigint NOT NULL DEFAULT 0,
  bumped_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO data_versions (key) VALUES ('leaderboard');

ALTER TABLE snapshots ADD COLUMN source_version bigint NOT NULL DEFAULT 0;   -- data_versions.version it was built from

CREATE FUNCTION rcl_bump_leaderboard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE data_versions SET version = version + 1, bumped_at = now() WHERE key = 'leaderboard';
  RETURN NULL;
END $$;

-- everything the leaderboard shows: points, club names/categories, sport names
CREATE TRIGGER trg_bump_lb_club_points AFTER INSERT OR UPDATE OR DELETE ON club_points
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_bump_leaderboard();
CREATE TRIGGER trg_bump_lb_clubs AFTER INSERT OR UPDATE OR DELETE ON clubs
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_bump_leaderboard();
CREATE TRIGGER trg_bump_lb_events AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_bump_leaderboard();
