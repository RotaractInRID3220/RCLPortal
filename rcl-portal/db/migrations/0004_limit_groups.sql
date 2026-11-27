-- Registration limits are per "limit group", not hard-coded per sport type.
--   standard : team / individual events  -> default 1 per day
--   track    : track events, shot put, discus (individual and team together) -> default 3 in total
--   swimming : swimming events -> its own 3 in total
-- The numbers and whether a limit is "per day" or "total" live in settings key `limits.groups`.
-- The earlier is_athletics flag is dropped: the road race simply sits on its own day (D-05), so no
-- exemption rule is needed.
ALTER TABLE events DROP COLUMN is_athletics;
ALTER TABLE events ADD COLUMN limit_group text NOT NULL DEFAULT 'standard'
  CHECK (limit_group IN ('standard', 'track', 'swimming'));
CREATE INDEX idx_events_limit_group ON events (limit_group);

DELETE FROM settings WHERE key IN ('limits.team_or_individual_per_day', 'limits.track_events');
