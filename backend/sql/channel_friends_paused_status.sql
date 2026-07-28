-- Allow storefront owners to pause umbrella members (hide public page, keep membership).
-- Run in Supabase SQL Editor.

ALTER TABLE public.channel_friends
  DROP CONSTRAINT IF EXISTS channel_friends_status_check;

ALTER TABLE public.channel_friends
  ADD CONSTRAINT channel_friends_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paused'));

COMMENT ON TABLE public.channel_friends IS
  'Umbrella network: pending/approved/rejected/paused links; subscriptions on approve; paused hides public collaborator page.';
