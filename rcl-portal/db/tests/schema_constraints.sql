-- Proves the constraints reject what the old schema allowed. Runs inside a transaction that is
-- rolled back; its fixtures don't clash with seed data. It needs event ids 1 and 2 to be free (see below).
-- Each block must raise the named error; a missing error makes the test fail loudly.
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(label text, sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  %  (%)', label, SQLSTATE;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL  %  (statement was accepted)', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_ok(label text, sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE NOTICE 'PASS  %', label;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL  %  (unexpected error: %)', label, SQLERRM;
END $$;

-- fixtures
INSERT INTO event_days VALUES ('TA', 'Test A', 901, NULL), ('TB', 'Test B', 902, NULL);
INSERT INTO clubs VALUES (1, 'Club One', 'community', 1, now()), (2, 'Club Two', 'institute', 1, now());
-- The statements below refer to sport ids 1 and 2, so the fixture events get exactly those ids
-- (inside this rolled-back transaction). If real events already use them, stop with a clear message.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE sport_id IN (1, 2)) THEN
    RAISE EXCEPTION 'schema_constraints.sql needs sport ids 1 and 2 to be free: run it on a scratch database';
  END IF;
END $$;
INSERT INTO events (sport_id, sport_name, sport_type, gender_type, category, min_count, max_count, reserve_count, sport_day)
  OVERRIDING SYSTEM VALUE VALUES
         (1, 'Netball', 'team', 'female', 'community', 7, 10, 2, 'TA'),
         (2, '100m', 'trackIndividual', 'male', 'community', 1, 1, 0, 'TB');
INSERT INTO players (member_id, name, club_id, gender, status) VALUES
  (101, 'P One', 1, 'F', 1), (102, 'P Two', 1, 'F', 5), (201, 'P Three', 2, 'M', 1);
INSERT INTO teams (club_id, sport_id) VALUES (1, 1);

SELECT pg_temp.expect_ok('registration inserts', $$INSERT INTO registrations (member_id, sport_id, club_id) VALUES (101, 1, 1)$$);
SELECT pg_temp.expect_fail('duplicate registration (member, sport)', $$INSERT INTO registrations (member_id, sport_id, club_id) VALUES (101, 1, 1)$$);
SELECT pg_temp.expect_fail('registration club must equal player club', $$INSERT INTO registrations (member_id, sport_id, club_id) VALUES (102, 1, 2)$$);
SELECT pg_temp.expect_fail('unknown player', $$INSERT INTO registrations (member_id, sport_id, club_id) VALUES (999, 1, 1)$$);
SELECT pg_temp.expect_fail('player club cannot change while registered', $$UPDATE players SET club_id = 2 WHERE member_id = 101$$);

SELECT pg_temp.expect_ok('day registration inserts', $$INSERT INTO day_registrations (member_id, day_code) VALUES (101, 'TA')$$);
SELECT pg_temp.expect_fail('duplicate day registration', $$INSERT INTO day_registrations (member_id, day_code) VALUES (101, 'TA')$$);
SELECT pg_temp.expect_fail('unknown day code', $$INSERT INTO day_registrations (member_id, day_code) VALUES (101, 'Z')$$);

SELECT pg_temp.expect_fail('duplicate team (club, sport)', $$INSERT INTO teams (club_id, sport_id) VALUES (1, 1)$$);

-- penalties: one per club, club-wide only
SELECT pg_temp.expect_ok('penalty inserts', $$INSERT INTO club_points (club_id, kind, points) VALUES (1, 'penalty', -25)$$);
SELECT pg_temp.expect_fail('second penalty for same club', $$INSERT INTO club_points (club_id, kind, points) VALUES (1, 'penalty', -25)$$);
SELECT pg_temp.expect_fail('penalty with a sport', $$INSERT INTO club_points (club_id, sport_id, kind, points) VALUES (2, 1, 'penalty', -25)$$);
SELECT pg_temp.expect_ok('participation row', $$INSERT INTO club_points (club_id, sport_id, kind, points) VALUES (1, 1, 'participation', 15)$$);
SELECT pg_temp.expect_fail('duplicate participation (club, sport, kind)', $$INSERT INTO club_points (club_id, sport_id, kind, points) VALUES (1, 1, 'participation', 15)$$);
SELECT pg_temp.expect_ok('placement coexists with participation', $$INSERT INTO club_points (club_id, sport_id, kind, points, place) VALUES (1, 1, 'placement', 100, 1)$$);
SELECT pg_temp.expect_fail('placement without a sport', $$INSERT INTO club_points (club_id, kind, points, place) VALUES (1, 'placement', 100, 1)$$);
SELECT pg_temp.expect_ok('several manual rows allowed', $$INSERT INTO club_points (club_id, kind, points) VALUES (1, 'manual', 5), (1, 'manual', 5)$$);
SELECT pg_temp.expect_fail('bad kind', $$INSERT INTO club_points (club_id, sport_id, kind, points) VALUES (1, 1, 'whatever', 1)$$);

-- replacement / swap requests: one pending per registration
SELECT pg_temp.expect_ok('replacement request', $$INSERT INTO replacement_requests
  (sport_id, registration_id, club_id, original_member_id, replacement_member_id, rep_name, rep_gender, rep_status, reason)
  SELECT 1, id, 1, 101, 102, 'P Two', 'F', 5, 'injury' FROM registrations WHERE member_id = 101$$);
SELECT pg_temp.expect_fail('second pending replacement for same registration', $$INSERT INTO replacement_requests
  (sport_id, registration_id, club_id, original_member_id, replacement_member_id, rep_name, rep_gender, rep_status, reason)
  SELECT 1, id, 1, 101, 102, 'P Two', 'F', 5, 'again' FROM registrations WHERE member_id = 101$$);
SELECT pg_temp.expect_fail('approved request needs decided_at', $$UPDATE replacement_requests SET status = 1$$);
SELECT pg_temp.expect_ok('decide request', $$UPDATE replacement_requests SET status = 1, decided_at = now(), decided_by = 1$$);
SELECT pg_temp.expect_ok('new pending allowed after decision', $$INSERT INTO replacement_requests
  (sport_id, registration_id, club_id, original_member_id, replacement_member_id, rep_name, rep_gender, rep_status, reason)
  SELECT 1, id, 1, 101, 102, 'P Two', 'F', 5, 'later' FROM registrations WHERE member_id = 101$$);
SELECT pg_temp.expect_fail('swap must not reference itself', $$INSERT INTO swap_requests (club_id, reg1_id, reg2_id, sport1_id, sport2_id)
  SELECT 1, id, id, 1, 1 FROM registrations LIMIT 1$$);
SELECT pg_temp.expect_fail('swap/move always needs a destination sport', $$INSERT INTO swap_requests (club_id, reg1_id, reg2_id, sport1_id)
  SELECT 1, 1, 2, 1$$);
SELECT pg_temp.expect_ok('a MOVE (no second registration) stores its destination sport', $$INSERT INTO swap_requests (club_id, reg1_id, sport1_id, sport2_id)
  SELECT 1, id, 1, 2 FROM registrations WHERE member_id = 101$$);
SELECT pg_temp.expect_fail('destination must differ from the current sport', $$INSERT INTO swap_requests (club_id, reg1_id, sport1_id, sport2_id)
  SELECT 1, id, 1, 1 FROM registrations WHERE member_id = 101$$);

-- matches: 0 is a real score, completed needs both scores, no self-parent/self-play
SELECT pg_temp.expect_ok('match with 0 score', $$INSERT INTO matches (sport_id, round_id, team1_score, team2_score, completed) VALUES (1, 0, 0, 3, true)$$);
SELECT pg_temp.expect_fail('completed without scores', $$INSERT INTO matches (sport_id, round_id, completed) VALUES (1, 0, true)$$);
SELECT pg_temp.expect_fail('negative score', $$INSERT INTO matches (sport_id, round_id, team1_score) VALUES (1, 0, -1)$$);
SELECT pg_temp.expect_fail('team plays itself', $$INSERT INTO matches (sport_id, round_id, team1_id, team2_id) VALUES (1, 0, 1, 1)$$);
SELECT pg_temp.expect_fail('parent match must exist', $$INSERT INTO matches (sport_id, round_id, parent_match1_id) VALUES (1, 1, 999999)$$);

-- track events: exactly one of player/team, unique per sport
SELECT pg_temp.expect_ok('track entry (player)', $$INSERT INTO track_events (sport_id, member_id, score) VALUES (2, 201, '12.34')$$);
SELECT pg_temp.expect_fail('duplicate track entry', $$INSERT INTO track_events (sport_id, member_id) VALUES (2, 201)$$);
SELECT pg_temp.expect_fail('track entry with neither', $$INSERT INTO track_events (sport_id) VALUES (2)$$);
SELECT pg_temp.expect_fail('track entry with both', $$INSERT INTO track_events (sport_id, member_id, team_id) VALUES (2, 102, 1)$$);

-- reference-data checks
SELECT pg_temp.expect_fail('club category must be community/institute', $$INSERT INTO clubs VALUES (3, 'X', 'university', 1, now())$$);
SELECT pg_temp.expect_fail('gender must be M/F', $$INSERT INTO players (member_id, name, club_id, gender, status) VALUES (301, 'X', 1, 'O', 1)$$);
SELECT pg_temp.expect_fail('player status must be normalised 1/5', $$INSERT INTO players (member_id, name, club_id, gender, status) VALUES (302, 'X', 1, 'M', 3)$$);
SELECT pg_temp.expect_fail('event min > max', $$INSERT INTO events (sport_name, sport_type, gender_type, category, min_count, max_count) VALUES ('X','team','mixed','community',5,2)$$);
SELECT pg_temp.expect_fail('event gender_type vocabulary', $$INSERT INTO events (sport_name, sport_type, gender_type, category) VALUES ('X','team','boys','community')$$);
SELECT pg_temp.expect_fail('payment value must be positive', $$INSERT INTO payment_slips (club_id, value, object_key) VALUES (1, 0, 'k')$$);
SELECT pg_temp.expect_fail('permission level vocabulary', $$INSERT INTO permissions VALUES (1, 'root', 'x', NULL, now())$$);

-- NOTIFY trigger exists on the data that feeds snapshots
SELECT pg_temp.expect_ok('notify triggers installed', $$SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_club_points' AND NOT tgisinternal$$);

ROLLBACK;
\echo ALL SCHEMA TESTS PASSED
