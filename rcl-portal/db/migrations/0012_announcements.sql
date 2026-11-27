-- Announcements shown to every portal/admin user. `manual` ones are written by an admin; `auto` ones are
-- deadline reminders (24 h / 1 h before) created by the worker. auto_key makes the reminders idempotent:
-- the same reminder for the same deadline can never be created twice.
CREATE TABLE announcements (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('manual', 'auto')),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  body        text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  author_name text,                                     -- shown as the sender; null for automated reminders
  created_by  integer,                                  -- RMIS member_id of the admin
  auto_key    text UNIQUE,
  expires_at  timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'auto') = (auto_key IS NOT NULL))
);
CREATE INDEX idx_announcements_live ON announcements (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE announcement_reads (
  announcement_id bigint NOT NULL REFERENCES announcements (id) ON DELETE CASCADE,
  member_id       integer NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, member_id)
);

-- push to open browsers the moment one is created, edited or retracted
CREATE FUNCTION rcl_notify_announcement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('rcl_announce', COALESCE(NEW.id, OLD.id)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_notify_announcements AFTER INSERT OR UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION rcl_notify_announcement();
