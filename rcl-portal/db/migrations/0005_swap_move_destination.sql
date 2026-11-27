-- A MOVE (one player to another sport) has no second registration but still needs a destination.
-- The original check tied sport2_id to reg2_id being present, which made moves impossible to store.
-- Now: sport2_id is always required (swap: the other player's sport; move: the destination) and
-- must differ from sport1_id.
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'swap_requests'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%reg2_id IS NULL%sport2_id IS NULL%'
  LOOP
    EXECUTE format('ALTER TABLE swap_requests DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE swap_requests ALTER COLUMN sport2_id SET NOT NULL;
ALTER TABLE swap_requests ADD CONSTRAINT swap_requests_sports_differ CHECK (sport2_id <> sport1_id);
