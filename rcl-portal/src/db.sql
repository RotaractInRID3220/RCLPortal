-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
CREATE TABLE public.club_points (
    point_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    sport_id bigint,
    club_id bigint,
    points integer,
    place integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT club_points_pkey PRIMARY KEY (point_id),
    CONSTRAINT club_points_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id),
    CONSTRAINT club_points_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id)
);
CREATE TABLE public.clubs (
    club_id bigint NOT NULL,
    club_name text NOT NULL,
    category text,
    CONSTRAINT clubs_pkey PRIMARY KEY (club_id)
);
CREATE TABLE public.day_registrations (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    RMIS_ID text,
    sport_day text,
    approved_by text,
    CONSTRAINT day_registrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.events (
    sport_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    sport_name text NOT NULL,
    sport_type text,
    gender_type text,
    min_count smallint,
    max_count smallint,
    reserve_count smallint,
    registration_close timestamp with time zone,
    category text,
    sport_day text,
    CONSTRAINT events_pkey PRIMARY KEY (sport_id)
);
CREATE TABLE public.matches (
    match_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    match_name text,
    start_time timestamp with time zone,
    team1_id bigint,
    team2_id bigint,
    round_id smallint,
    team1_score text,
    team2_score text,
    sport_id bigint,
    match_order smallint,
    parent_match1_id bigint,
    parent_match2_id bigint,
    CONSTRAINT matches_pkey PRIMARY KEY (match_id),
    CONSTRAINT matches_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id),
    CONSTRAINT matches_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(team_id),
    CONSTRAINT matches_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.payment_slips (
    payment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    date timestamp with time zone NOT NULL DEFAULT now(),
    value double precision,
    slip_number text,
    link text,
    club_id bigint,
    approved boolean DEFAULT false,
    approved_by text,
    CONSTRAINT payment_slips_pkey PRIMARY KEY (payment_id),
    CONSTRAINT payment_slips_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id)
);
CREATE TABLE public.permissions (
    RMIS_ID text NOT NULL,
    permission_level text NOT NULL,
    card_name text,
    CONSTRAINT permissions_pkey PRIMARY KEY (RMIS_ID)
);
CREATE TABLE public.players (
    RMIS_ID text NOT NULL,
    RI_ID text,
    name text,
    club_id bigint,
    NIC text,
    birthdate timestamp without time zone,
    gender text,
    registered_at timestamp with time zone NOT NULL DEFAULT now(),
    status smallint,
    converted boolean DEFAULT false,
    converted_by text,
    CONSTRAINT players_pkey PRIMARY KEY (RMIS_ID),
    CONSTRAINT players_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id)
);
CREATE TABLE public.registrations (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    RMIS_ID text,
    sport_id bigint,
    club_id bigint,
    main_player boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT registrations_pkey PRIMARY KEY (id),
    CONSTRAINT registrations_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id),
    CONSTRAINT registrations_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id),
    CONSTRAINT registrations_RMIS_ID_fkey FOREIGN KEY (RMIS_ID) REFERENCES public.players(RMIS_ID)
);
CREATE TABLE public.teams (
    team_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    club_id bigint,
    seed_number integer,
    sport_id bigint,
    CONSTRAINT teams_pkey PRIMARY KEY (team_id),
    CONSTRAINT teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id),
    CONSTRAINT teams_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id)
);
CREATE TABLE public.track_events (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    sport_id bigint,
    rmis_id text,
    score text,
    place integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT track_events_pkey PRIMARY KEY (id),
    CONSTRAINT track_events_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id)
);
CREATE TABLE public.replacement_players (
    replacement_id text NOT NULL,
    name text,
    status smallint,
    ri_number text,
    club_id bigint,
    gender text,
    nic text,
    birthdate timestamp without time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT replacement_players_pkey PRIMARY KEY (replacement_id),
    CONSTRAINT replacement_players_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id)
);
CREATE TABLE public.replacement_requests (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    sport_id bigint NOT NULL,
    registrations_id bigint NOT NULL,
    original_player_rmis_id text NOT NULL,
    replacement_id text NOT NULL,
    club_id bigint NOT NULL,
    reason text NOT NULL,
    supporting_link text,
    ri_number text,
    status boolean,
    requested_by text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by text,
    CONSTRAINT replacement_requests_pkey PRIMARY KEY (id),
    CONSTRAINT replacement_requests_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.events(sport_id),
    CONSTRAINT replacement_requests_registrations_id_fkey FOREIGN KEY (registrations_id) REFERENCES public.registrations(id),
    CONSTRAINT replacement_requests_replacement_id_fkey FOREIGN KEY (replacement_id) REFERENCES public.replacement_players(replacement_id),
    CONSTRAINT replacement_requests_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(club_id)
);