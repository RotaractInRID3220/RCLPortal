-- Idempotency + performance. These are what make double-clicks and races harmless.

-- points: at most one row per club/sport/kind for the automatic kinds; one penalty per club
CREATE UNIQUE INDEX uq_points_club_sport_kind ON club_points (club_id, sport_id, kind)
  WHERE kind IN ('placement', 'participation', 'track');
CREATE UNIQUE INDEX uq_points_one_penalty ON club_points (club_id) WHERE kind = 'penalty';
CREATE INDEX idx_points_club ON club_points (club_id);
CREATE INDEX idx_points_sport_club ON club_points (sport_id, club_id);

-- one pending request per registration / per swapped registration
CREATE UNIQUE INDEX uq_replacement_one_pending ON replacement_requests (registration_id) WHERE status = 0;
CREATE UNIQUE INDEX uq_swap_one_pending_reg1 ON swap_requests (reg1_id) WHERE status = 0;
CREATE UNIQUE INDEX uq_swap_one_pending_reg2 ON swap_requests (reg2_id) WHERE status = 0 AND reg2_id IS NOT NULL;
CREATE INDEX idx_replacement_status ON replacement_requests (status, created_at DESC);
CREATE INDEX idx_swap_status ON swap_requests (status, created_at DESC);
CREATE INDEX idx_replacement_club ON replacement_requests (club_id);
CREATE INDEX idx_swap_club ON swap_requests (club_id);

-- track events: one entry per player/team per sport
CREATE UNIQUE INDEX uq_track_member ON track_events (sport_id, member_id) WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX uq_track_team ON track_events (sport_id, team_id) WHERE team_id IS NOT NULL;

-- lookups
CREATE INDEX idx_reg_sport_club ON registrations (sport_id, club_id);
CREATE INDEX idx_reg_club ON registrations (club_id);
CREATE INDEX idx_reg_member ON registrations (member_id);
CREATE INDEX idx_dayreg_day ON day_registrations (day_code);
CREATE INDEX idx_players_club ON players (club_id);
CREATE INDEX idx_players_nic ON players (nic) WHERE nic IS NOT NULL;
CREATE INDEX idx_players_membership ON players (upper(membership_id)) WHERE membership_id IS NOT NULL;
CREATE INDEX idx_players_name_trgm ON players USING gin (name gin_trgm_ops);
CREATE INDEX idx_events_day ON events (sport_day);
CREATE INDEX idx_events_cat_type ON events (category, sport_type);
CREATE INDEX idx_clubs_category ON clubs (category);
CREATE INDEX idx_slips_club ON payment_slips (club_id, approved);
CREATE INDEX idx_slips_status ON payment_slips (approved, created_at DESC);
CREATE INDEX idx_teams_sport ON teams (sport_id);
CREATE INDEX idx_matches_sport ON matches (sport_id, round_id, match_order);
CREATE INDEX idx_matches_parent1 ON matches (parent_match1_id);
CREATE INDEX idx_matches_parent2 ON matches (parent_match2_id);
CREATE INDEX idx_rmis_members_club ON rmis_members (club_id, status);
CREATE INDEX idx_rmis_members_updated ON rmis_members (updated_at, member_id);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);

-- Wake the worker when data feeding a snapshot changes (statement-level: one NOTIFY per statement).
CREATE FUNCTION rcl_notify_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('rcl_changed', TG_TABLE_NAME);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_notify_club_points AFTER INSERT OR UPDATE OR DELETE ON club_points
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_matches AFTER INSERT OR UPDATE OR DELETE ON matches
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_teams AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_registrations AFTER INSERT OR UPDATE OR DELETE ON registrations
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_day_registrations AFTER INSERT OR UPDATE OR DELETE ON day_registrations
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_events AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
CREATE TRIGGER trg_notify_track_events AFTER INSERT OR UPDATE OR DELETE ON track_events
  FOR EACH STATEMENT EXECUTE FUNCTION rcl_notify_changed();
