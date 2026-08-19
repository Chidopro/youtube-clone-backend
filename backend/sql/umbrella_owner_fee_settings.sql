-- Storefront owner fee on umbrella collaborator sales.
-- Percentage is of the $6 collaborator share per item; flat is dollars per item.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.umbrella_owner_fee_settings (
  storefront_owner_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  fee_type text NOT NULL DEFAULT 'none' CHECK (fee_type IN ('none', 'percent', 'flat')),
  fee_value numeric(10, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.umbrella_owner_fee_settings ENABLE ROW LEVEL SECURITY;
