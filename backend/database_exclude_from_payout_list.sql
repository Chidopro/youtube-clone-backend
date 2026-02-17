-- Allow removing a user from the admin "Creators & payout info" list without changing their role.
-- Run in Supabase SQL Editor. Optional: needed only if you use the "Remove from list" button.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS exclude_from_payout_list boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.exclude_from_payout_list IS 'When true, user is hidden from the admin Payouts "Creators & payout info" table.';
