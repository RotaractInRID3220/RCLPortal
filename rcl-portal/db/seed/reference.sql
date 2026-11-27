-- Reference data for the season. Idempotent: safe to re-run (it never overwrites values an admin
-- has changed in `settings`). Dates are deliberately NOT seeded: registration stays closed until
-- an admin sets them.
INSERT INTO event_days (day_code, label, sort_order) VALUES
  ('D-01', 'Day 01', 1),
  ('D-02', 'Day 02', 2),
  ('D-03', 'Day 03', 3),
  ('D-04', 'Day 04', 4),
  ('D-05', 'Road Race', 5)
ON CONFLICT (day_code) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('fees.registration_per_player',        '1000'),
  ('points.placement',                    '[100, 75, 50]'),
  ('points.track_individual',             '[85, 50, 30]'),
  ('points.track_team',                   '[100, 75, 50]'),
  ('points.track_participation',          '15'),
  ('points.participation_per_sport',      '15'),
  ('participation.min_attendance_ratio',  '0.5'),
  ('penalty.min_players',                 '5'),
  ('penalty.tiers',                       '[{"lt": 62, "points": -80}, {"lt": 67, "points": -50}, {"lt": 70, "points": -25}]'),
  ('limits.groups',                      '{"standard": {"per": "day", "max": 1}, "track": {"per": "total", "max": 3}, "swimming": {"per": "total", "max": 3}}')
ON CONFLICT (key) DO NOTHING;
