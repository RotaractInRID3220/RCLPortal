-- Admin marks which events count as "athletics" (track events and the road race). The rule that
-- athletics participants may also enter other events on the athletics day reads this flag.
ALTER TABLE events ADD COLUMN is_athletics boolean NOT NULL DEFAULT false;
