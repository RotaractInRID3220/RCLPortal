-- Per-event points. The handbook gives each sport its own scale (team sports 100/75/50/15, singles 30/20/15/10,
-- athletics 50/30/20/10, ...), so a single global setting was not enough.
--   points = {"podium": [1st, 2nd, 3rd], "participation": n}
-- NULL means "use the global settings" (points.placement / points.track_* / points.participation_per_sport),
-- so events created without it behave exactly as before.
ALTER TABLE events ADD COLUMN points jsonb;
ALTER TABLE events ADD CONSTRAINT events_points_shape CHECK (
  points IS NULL OR (
    jsonb_typeof(points) = 'object'
    AND jsonb_typeof(points -> 'podium') = 'array' AND jsonb_array_length(points -> 'podium') = 3
    AND jsonb_typeof(points -> 'participation') = 'number'
  )
);
