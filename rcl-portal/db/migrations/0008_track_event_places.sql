-- Track events: a finishing position can be given to only one entry per event. Results are saved
-- in one transaction that clears the old places first, so re-ordering never trips this index.
CREATE UNIQUE INDEX uq_track_place ON track_events (sport_id, place) WHERE place IS NOT NULL;
