-- Portal users see WHO the announcement is from as a role label ("Admin" or "RDSC"); only the admin
-- portal shows the sender's name (author_name).
ALTER TABLE announcements ADD COLUMN sent_as text CHECK (sent_as IN ('Admin', 'RDSC'));
UPDATE announcements SET sent_as = 'Admin' WHERE kind = 'manual';
ALTER TABLE announcements ADD CONSTRAINT announcements_sent_as_chk CHECK ((kind = 'manual') = (sent_as IS NOT NULL));
