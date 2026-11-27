-- Real-time check-in switch: every change to a setting announces its key on channel `rcl_settings`,
-- the web servers LISTEN and push it to open scanner pages (server-sent events), so opening or closing
-- check-in reaches every scanner within a moment instead of at the next poll.
CREATE FUNCTION rcl_notify_setting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('rcl_settings', COALESCE(NEW.key, OLD.key));
  RETURN NULL;
END $$;
CREATE TRIGGER trg_notify_settings AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION rcl_notify_setting();
