-- DEV ONLY (never run in production): sample events to click around with. Idempotent by (name, category).
-- Apply with: npm run db:mock
INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day, limit_group, bib_required)
SELECT v.name, v.stype, v.gender, c.category, v.minc, v.maxc, v.res, v.day, v.grp,
       v.grp <> 'standard' OR v.day = (SELECT day_code FROM event_days ORDER BY sort_order DESC LIMIT 1)
FROM (VALUES
  ('Cricket',                 'team',            'male',   11, 15, 4, 'D-01', 'standard'),
  ('Netball',                 'team',            'female',  7, 10, 3, 'D-01', 'standard'),
  ('Volleyball',              'team',            'mixed',   6,  9, 3, 'D-01', 'standard'),
  ('Chess',                   'individual',      'mixed',   1,  1, 0, 'D-01', 'standard'),
  ('Basketball',              'team',            'male',    5,  8, 3, 'D-02', 'standard'),
  ('Football',                'team',            'male',    7, 11, 4, 'D-02', 'standard'),
  ('Badminton',               'individual',      'mixed',   1,  1, 0, 'D-02', 'standard'),
  ('Table Tennis',            'individual',      'mixed',   1,  1, 0, 'D-02', 'standard'),
  ('Swimming 50m Freestyle',  'individual',      'mixed',   1,  1, 0, 'D-03', 'swimming'),
  ('Swimming 4x50m Relay',    'team',            'mixed',   4,  4, 1, 'D-03', 'swimming'),
  ('100m Sprint',             'trackIndividual', 'mixed',   1,  1, 0, 'D-04', 'track'),
  ('4x100m Relay',            'trackTeam',       'mixed',   4,  4, 1, 'D-04', 'track'),
  ('Shot Put',                'trackIndividual', 'mixed',   1,  1, 0, 'D-04', 'track'),
  ('Road Race',               'individual',      'mixed',   1,  1, 0, 'D-05', 'standard')
) AS v(name, stype, gender, minc, maxc, res, day, grp)
CROSS JOIN (VALUES ('community'), ('institute')) AS c(category)
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.sport_name = v.name AND e.category = c.category);
