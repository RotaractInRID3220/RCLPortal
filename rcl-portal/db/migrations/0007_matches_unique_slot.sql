-- Tournaments: a bracket slot (event, round, position) holds at most one match, so a double click
-- on "generate bracket" or two admins adding the same match can never leave duplicates behind.
CREATE UNIQUE INDEX uq_matches_slot ON matches (sport_id, round_id, match_order) WHERE match_order IS NOT NULL;
