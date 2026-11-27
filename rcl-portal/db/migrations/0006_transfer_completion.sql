-- A transferred member only counts if the transfer was FINALISED before the membership cutoff.
-- RMIS sends `transfer_completed_at` (the moment the destination club's final approval completed the
-- transfer; null for members with no transfer record, e.g. RMIS-1 legacy data). `transfer_info` records
-- whether RMIS sent the field at all, so an old RMIS that does not know it can be told apart from
-- "no transfer" (status-3 members are refused while their transfer date is unknown).
ALTER TABLE rmis_members
  ADD COLUMN transfer_completed_at timestamptz,
  ADD COLUMN transfer_info boolean NOT NULL DEFAULT false,
  ADD COLUMN has_pending_transfer boolean NOT NULL DEFAULT false;

