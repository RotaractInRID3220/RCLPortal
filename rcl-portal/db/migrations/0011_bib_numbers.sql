-- Bib numbers for track events, swimming and the road race.
-- One player has exactly one number and one number belongs to exactly one player (both UNIQUE).
-- A number never changes: bib_number cannot be updated, rows cannot be deleted (a number whose
-- player left stays retired). The only allowed move is HANDING it to the replacement player
-- (member_id changes, recorded in transferred_from / transferred_at), see server/bibs/service.mjs.
ALTER TABLE events ADD COLUMN bib_required boolean NOT NULL DEFAULT false;
UPDATE events SET bib_required = true
 WHERE limit_group <> 'standard'
    OR sport_day = (SELECT day_code FROM event_days ORDER BY sort_order DESC LIMIT 1);

CREATE TABLE bib_numbers (
  bib_number       integer PRIMARY KEY CHECK (bib_number BETWEEN 1 AND 9999),   -- shown as 3 digits (001..999), 4 digits after that
  member_id        integer NOT NULL UNIQUE REFERENCES players (member_id),
  assigned_by      integer,                                                     -- RMIS member_id of the admin
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  transferred_from integer,                                                     -- previous holder when handed to a replacement
  transferred_at   timestamptz
);

CREATE FUNCTION bib_numbers_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'bib numbers cannot be deleted';
  END IF;
  IF NEW.bib_number IS DISTINCT FROM OLD.bib_number THEN
    RAISE EXCEPTION 'a bib number cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bib_numbers_guard BEFORE UPDATE OR DELETE ON bib_numbers
  FOR EACH ROW EXECUTE FUNCTION bib_numbers_guard();
