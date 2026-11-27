-- Applied by hand (psql) to production: it is NOT in db/seed so `npm run db:seed` never adds it to a dev or test database.
-- RCL 2026-27 events and event-day dates, taken from the "RCL 2026-27 Handbook" (Rules and Regulations).
-- Idempotent: events are matched on (name, gender, category), so re-running never duplicates and never
-- overwrites an event an admin has since edited. Every sport exists twice: community and institute.
--
-- Day 05 is a technical day for the Road Race only. The Road Race is played on 9 Jan together with Day 01;
-- it has its own day code so its entrants are not limited by "one sport per day".
-- Counts: min/max = players on the field, reserve = standby / substitutes (squad = max + reserve).
-- Points follow the handbook's "Full list of events and points breakdown" and are stored per event (events.points,
-- migration 0014); they are only filled in where an event has none yet, so admin edits are kept.

BEGIN;

UPDATE event_days SET event_date = v.d::date
FROM (VALUES ('D-01', '2027-01-09'), ('D-02', '2027-01-10'), ('D-03', '2027-01-30'), ('D-04', '2027-01-31'), ('D-05', '2027-01-09')) AS v(code, d)
WHERE event_days.day_code = v.code AND event_days.event_date IS NULL;

CREATE TEMP TABLE _season_events (name text, stype text, gender text, minc smallint, maxc smallint, res smallint, day text, grp text) ON COMMIT DROP;

INSERT INTO _season_events VALUES
  -- ---- Day 05 (Road Race, played with Day 01) -------------------------------------------------------
  ('Road Race', 'individual', 'male',   1, 2, 0, 'D-05', 'standard'),
  ('Road Race', 'individual', 'female', 1, 2, 0, 'D-05', 'standard'),

  -- ---- Day 01: Track and Field, Netball, Pickleball ------------------------------------------------
  ('Netball',                'team',   'mixed', 7, 7, 3, 'D-01', 'standard'),
  ('Pickleball Mixed Doubles', 'team', 'mixed', 2, 2, 0, 'D-01', 'standard'),

  -- ---- Day 02: Badminton, Carrom, Table Tennis, Chess, Futsal ---------------------------------------
  ('Badminton Singles',       'individual', 'male',   1, 1, 0, 'D-02', 'standard'),
  ('Badminton Singles',       'individual', 'female', 1, 1, 0, 'D-02', 'standard'),
  ('Badminton Mixed Doubles', 'team',       'mixed',  2, 2, 0, 'D-02', 'standard'),
  ('Table Tennis Singles',       'individual', 'male',   1, 1, 0, 'D-02', 'standard'),
  ('Table Tennis Singles',       'individual', 'female', 1, 1, 0, 'D-02', 'standard'),
  ('Table Tennis Mixed Doubles', 'team',       'mixed',  2, 2, 0, 'D-02', 'standard'),
  ('Carrom Singles', 'individual', 'male',   1, 1, 0, 'D-02', 'standard'),
  ('Carrom Singles', 'individual', 'female', 1, 1, 0, 'D-02', 'standard'),
  ('Chess', 'individual', 'male',   1, 1, 0, 'D-02', 'standard'),
  ('Chess', 'individual', 'female', 1, 1, 0, 'D-02', 'standard'),
  ('Futsal', 'team', 'male',   5, 5, 2, 'D-02', 'standard'),
  ('Futsal', 'team', 'female', 5, 5, 2, 'D-02', 'standard'),

  -- ---- Day 03: Beach Tag Rugby, Beach Volleyball, Swimming, Beach Handball -------------------------
  ('Beach Tag Rugby', 'team', 'male',   7, 7, 3, 'D-03', 'standard'),
  ('Beach Tag Rugby', 'team', 'female', 7, 7, 3, 'D-03', 'standard'),
  ('Beach Volleyball Mixed Doubles', 'team', 'mixed', 2, 2, 2, 'D-03', 'standard'),   -- reserve = the standby pair
  ('Beach Handball', 'team', 'mixed', 5, 5, 2, 'D-03', 'standard'),

  -- ---- Day 04: Cricket, Tug of War, Basketball -------------------------------------------------------
  ('Cricket',    'team', 'male',   5, 6, 2, 'D-04', 'standard'),
  ('Cricket',    'team', 'female', 5, 6, 2, 'D-04', 'standard'),
  ('Tug of War', 'team', 'male',   5, 5, 2, 'D-04', 'standard'),
  ('Tug of War', 'team', 'female', 5, 5, 2, 'D-04', 'standard'),
  ('Basketball', 'team', 'male',   5, 5, 5, 'D-04', 'standard'),
  ('Basketball', 'team', 'female', 5, 5, 5, 'D-04', 'standard');

-- Athletics (Day 01): 5 individual events and 3 relays, men and women. One athlete competes, one is on standby.
INSERT INTO _season_events
SELECT n, 'trackIndividual', g, 1, 1, 1, 'D-01', 'track'
FROM unnest(ARRAY['100m', '200m', '400m', '800m', 'Shot Put']) AS n CROSS JOIN unnest(ARRAY['male', 'female']) AS g;
INSERT INTO _season_events
SELECT n, 'trackTeam', g, 4, 4, 1, 'D-01', 'track'
FROM unnest(ARRAY['4×100m Relay', '4×400m Relay', 'Medley Relay']) AS n CROSS JOIN unnest(ARRAY['male', 'female']) AS g;

-- Swimming (Day 03): 8 individual events and one 4×50m relay, men and women.
INSERT INTO _season_events
SELECT n, 'trackIndividual', g, 1, 1, 1, 'D-03', 'swimming'
FROM unnest(ARRAY['50m Freestyle', '50m Backstroke', '50m Breaststroke', '50m Dolphin',
                  '100m Freestyle', '100m Backstroke', '100m Breaststroke', '100m Dolphin']) AS n
CROSS JOIN unnest(ARRAY['male', 'female']) AS g;
INSERT INTO _season_events
SELECT '4×50m Relay', 'trackTeam', g, 4, 4, 0, 'D-03', 'swimming' FROM unnest(ARRAY['male', 'female']) AS g;

-- bib_required follows the same rule as the admin "create event" form: track/swimming events and the last day.
INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day, limit_group, bib_required)
SELECT s.name, s.stype, s.gender, c.category, s.minc, s.maxc, s.res, s.day, s.grp,
       s.grp <> 'standard' OR s.day = (SELECT day_code FROM event_days ORDER BY sort_order DESC LIMIT 1)
FROM _season_events s
CROSS JOIN (VALUES ('community'), ('institute')) AS c(category)
WHERE NOT EXISTS (
  SELECT 1 FROM events e WHERE e.sport_name = s.name AND e.gender_type = s.gender AND e.category = c.category
);

-- Points per event: podium (1st, 2nd, 3rd) and participation, from the handbook tables.
UPDATE events e SET points = jsonb_build_object('podium', to_jsonb(p.podium), 'participation', p.part)
FROM (
  SELECT unnest(ARRAY['Road Race', 'Cricket', 'Basketball', 'Beach Tag Rugby', 'Netball', 'Tug of War', 'Futsal',
                      'Pickleball Mixed Doubles', 'Beach Handball']) AS name, ARRAY[100, 75, 50] AS podium, 15 AS part          -- team sports
  UNION ALL SELECT unnest(ARRAY['Badminton Singles', 'Table Tennis Singles']), ARRAY[30, 20, 15], 10                               -- racquet singles
  UNION ALL SELECT unnest(ARRAY['Badminton Mixed Doubles', 'Table Tennis Mixed Doubles', 'Beach Volleyball Mixed Doubles']), ARRAY[40, 20, 15], 10
  UNION ALL SELECT unnest(ARRAY['Carrom Singles', 'Chess']), ARRAY[50, 30, 20], 10
  UNION ALL SELECT unnest(ARRAY['100m', '200m', '400m', '800m', 'Shot Put', '4×100m Relay', '4×400m Relay', 'Medley Relay',   -- athletics
                                '50m Freestyle', '50m Backstroke', '50m Breaststroke', '50m Dolphin',                       -- swimming
                                '100m Freestyle', '100m Backstroke', '100m Breaststroke', '100m Dolphin']), ARRAY[50, 30, 20], 10
  UNION ALL SELECT '4×50m Relay', ARRAY[75, 50, 25], 15
) p
WHERE e.sport_name = p.name AND e.points IS NULL;

COMMIT;
