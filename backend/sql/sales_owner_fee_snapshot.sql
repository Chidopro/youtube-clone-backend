-- Optional: persist the collaborator fee that applied at purchase time.
-- The app still works without these columns (it uses fee history), but
-- snapshots keep each sale locked if fee settings change later.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS owner_fee_type VARCHAR(20);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS owner_fee_value NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS owner_fee_per_item NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS owner_fee_amount NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS pay_collaborator_amount NUMERIC(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS collaborator_share_before_fee NUMERIC(10,2);
