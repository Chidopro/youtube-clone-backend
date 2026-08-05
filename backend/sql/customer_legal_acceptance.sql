-- Record the legal versions accepted when a customer account is created.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz;
