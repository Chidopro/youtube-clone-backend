-- Add payment_method to existing payouts tables that were created without it.
-- Safe to run in the Supabase SQL editor. The API also works if this column is missing.

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'paypal';

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS processed_date TIMESTAMPTZ;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS notes TEXT;

NOTIFY pgrst, 'reload schema';
