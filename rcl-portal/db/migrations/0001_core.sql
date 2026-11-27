-- RCL Portal schema v2 (fresh season). Postgres 14+.
-- Conventions: snake_case, timestamptz, integer scores, member key = RMIS table_id (member_id).
-- Nothing event-specific (days, dates, point values, fees) is hard-coded here: it lives in
-- event_days / settings and is edited by admins.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------- reference data
CREATE TABLE clubs (
  club_id    integer PRIMARY KEY,                       -- RMIS club_id (stable)
  club_name  text NOT NULL,
  category   text NOT NULL CHECK (category IN ('community', 'institute')),  -- RMIS 'university' maps to 'institute'
  status     smallint NOT NULL DEFAULT 1,               -- RMIS club status (1 = active)
  synced_at  timestamptz
);

-- Event days are data, not code. Admins define them (code, label, order, date).
CREATE TABLE event_days (
  day_code   text PRIMARY KEY,
  label      text NOT NULL,
  sort_order smallint NOT NULL,
  event_date date,
  UNIQUE (sort_order)
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  sport_id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sport_name         text NOT NULL,
  sport_type         text NOT NULL CHECK (sport_type IN ('team', 'individual', 'trackIndividual', 'trackTeam')),
  gender_type        text NOT NULL CHECK (gender_type IN ('male', 'female', 'mixed')),
  category           text NOT NULL CHECK (category IN ('community', 'institute')),
  min_count          smallint CHECK (min_count >= 0),
  max_count          smallint CHECK (max_count >= 0),
  reserve_count      smallint CHECK (reserve_count >= 0),
  registration_close timestamptz,
  sport_day          text REFERENCES event_days (day_code) ON UPDATE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (min_count IS NULL OR max_count IS NULL OR min_count <= max_count)
);

-- ---------------------------------------------------------------- people
CREATE TABLE players (
  member_id      integer PRIMARY KEY,                   -- RMIS table_id
  membership_id  text,                                  -- display only, may be NULL, may change on transfer
  ri_id          text,                                  -- typed in RCL for general members
  name           text NOT NULL,
  club_id        integer NOT NULL REFERENCES clubs (club_id),
  nic            text,                                  -- stored normalised: trim + upper
  birthdate      date,
  gender         char(1) NOT NULL CHECK (gender IN ('M', 'F')),
  status         smallint NOT NULL CHECK (status IN (1, 5)),   -- normalised: 1 general (RMIS 1 or 3), 5 prospective
  registered_at  timestamptz NOT NULL DEFAULT now(),
  converted      boolean NOT NULL DEFAULT false,
  converted_by   integer,
  -- last values seen from RMIS (sync never moves a registered player; it flags instead)
  rmis_status    smallint,
  rmis_club_id   integer,
  rmis_synced_at timestamptz,
  UNIQUE (member_id, club_id)                           -- target of the composite FK from registrations
);

-- Local mirror of RMIS members, filled by the worker (members/changes + club rosters).
CREATE TABLE rmis_members (
  member_id     integer PRIMARY KEY,
  membership_id text,
  club_id       integer NOT NULL,
  status        smallint NOT NULL,                      -- raw RMIS status 1..5
  role_id       smallint,
  card_name     text NOT NULL,
  full_name     text,
  gender        text,
  nic           text,
  dob           date,
  created_at    timestamptz NOT NULL,                   -- RMIS members.created_at (cutoff field)
  updated_at    timestamptz NOT NULL,                   -- RMIS updated_at (sync watermark)
  synced_at     timestamptz NOT NULL DEFAULT now()
);

-- RCL admin levels (access itself comes from the RMIS role).
CREATE TABLE permissions (
  member_id        integer PRIMARY KEY,
  permission_level text NOT NULL CHECK (permission_level IN ('admin', 'super_admin', 'administrator')),
  card_name        text,
  granted_by       integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- registration
CREATE TABLE registrations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   integer NOT NULL,
  sport_id    integer NOT NULL REFERENCES events (sport_id),
  club_id     integer NOT NULL,
  main_player boolean NOT NULL DEFAULT true,            -- false = reserve
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, sport_id),
  -- a registration always belongs to the player's own club
  FOREIGN KEY (member_id, club_id) REFERENCES players (member_id, club_id)
);

CREATE TABLE day_registrations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   integer NOT NULL REFERENCES players (member_id),
  day_code    text NOT NULL REFERENCES event_days (day_code) ON UPDATE CASCADE,
  approved_by integer,                                  -- RMIS member_id of the admin (from session)
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, day_code)
);

CREATE TABLE teams (
  team_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id     integer NOT NULL REFERENCES clubs (club_id),
  sport_id    integer NOT NULL REFERENCES events (sport_id),
  seed_number integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, sport_id)
);

-- ---------------------------------------------------------------- payments
CREATE TABLE payment_slips (
  payment_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id      integer NOT NULL REFERENCES clubs (club_id),
  value        numeric(12, 2) NOT NULL CHECK (value > 0),
  slip_number  text,
  object_key   text NOT NULL,                           -- object storage key (private bucket)
  submitted_by integer,
  approved     boolean,                                 -- NULL pending, true approved, false rejected
  decided_by   integer,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((approved IS NULL) = (decided_at IS NULL))
);

-- ---------------------------------------------------------------- changes
-- status: 0 pending, 1 approved, 2 rejected
CREATE TABLE replacement_requests (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sport_id              integer NOT NULL REFERENCES events (sport_id),
  registration_id       bigint NOT NULL REFERENCES registrations (id),
  club_id               integer NOT NULL REFERENCES clubs (club_id),
  original_member_id    integer NOT NULL,
  replacement_member_id integer NOT NULL,
  -- snapshot of the replacement taken at request time (no shared mutable profile table)
  rep_membership_id     text,
  rep_name              text NOT NULL,
  rep_gender            char(1) NOT NULL CHECK (rep_gender IN ('M', 'F')),
  rep_status            smallint NOT NULL CHECK (rep_status IN (1, 5)),
  rep_ri_id             text,
  rep_nic               text,
  rep_birthdate         date,
  reason                text NOT NULL,
  supporting_link       text,
  status                smallint NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2)),
  requested_by          integer,
  decided_by            integer,
  decided_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (original_member_id <> replacement_member_id),
  CHECK ((status = 0) = (decided_at IS NULL))
);

CREATE TABLE swap_requests (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id         integer NOT NULL REFERENCES clubs (club_id),
  reg1_id         bigint NOT NULL REFERENCES registrations (id),
  reg2_id         bigint REFERENCES registrations (id),   -- NULL = move to another sport
  sport1_id       integer NOT NULL REFERENCES events (sport_id),
  sport2_id       integer REFERENCES events (sport_id),
  description     text,
  status          smallint NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2)),
  requested_by    integer,
  decided_by      integer,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (reg2_id IS NULL OR reg2_id <> reg1_id),
  CHECK ((reg2_id IS NULL) = (sport2_id IS NULL)),
  CHECK ((status = 0) = (decided_at IS NULL))
);

-- ---------------------------------------------------------------- tournaments
CREATE TABLE matches (
  match_id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sport_id         integer NOT NULL REFERENCES events (sport_id),
  match_name       text,
  start_time       timestamptz,
  team1_id         integer REFERENCES teams (team_id),
  team2_id         integer REFERENCES teams (team_id),
  round_id         smallint NOT NULL,
  match_order      smallint,
  team1_score      integer CHECK (team1_score >= 0),     -- NULL = not played; 0 is a real score
  team2_score      integer CHECK (team2_score >= 0),
  completed        boolean NOT NULL DEFAULT false,
  parent_match1_id bigint REFERENCES matches (match_id) ON DELETE SET NULL,
  parent_match2_id bigint REFERENCES matches (match_id) ON DELETE SET NULL,
  CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id <> team2_id),
  CHECK (parent_match1_id IS NULL OR parent_match2_id IS NULL OR parent_match1_id <> parent_match2_id),
  CHECK (NOT completed OR (team1_score IS NOT NULL AND team2_score IS NOT NULL))
);

CREATE TABLE track_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sport_id   integer NOT NULL REFERENCES events (sport_id),
  member_id  integer REFERENCES players (member_id),     -- individual entries
  team_id    integer REFERENCES teams (team_id),         -- team entries
  score      text,                                       -- time like 12.34 or 1:02.5, parsed by the app
  place      integer CHECK (place > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((member_id IS NOT NULL)::int + (team_id IS NOT NULL)::int = 1)
);

-- ---------------------------------------------------------------- points
-- One row kind per purpose, so nothing is encoded in negative `place` values any more.
CREATE TABLE club_points (
  point_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id    integer NOT NULL REFERENCES clubs (club_id),
  sport_id   integer REFERENCES events (sport_id),
  kind       text NOT NULL CHECK (kind IN ('placement', 'participation', 'track', 'penalty', 'manual')),
  points     integer NOT NULL,
  place      smallint CHECK (place > 0),
  note       text,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('penalty', 'manual') OR sport_id IS NOT NULL),   -- sport rows need a sport
  CHECK (kind <> 'penalty' OR sport_id IS NULL)                    -- penalties are club-wide
);

-- ---------------------------------------------------------------- derived data + audit
CREATE TABLE snapshots (
  key         text PRIMARY KEY,                           -- 'leaderboard:all', 'bracket:42', ...
  version     bigint NOT NULL,
  data        jsonb NOT NULL,
  data_hash   text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id  integer,
  action    text NOT NULL,
  entity    text,
  entity_id text,
  detail    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
