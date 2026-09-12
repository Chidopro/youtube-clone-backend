-- Collaborator receipt confirmation for off-platform storefront payments.
-- Run in Supabase SQL Editor if confirmed_at is missing on umbrella_collaborator_payouts.

ALTER TABLE public.umbrella_collaborator_payouts
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
