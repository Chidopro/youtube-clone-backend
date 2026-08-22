-- Storefront owner fee on umbrella collaborator sales, per collaborator page.
-- Percentage is of the $6 collaborator share per item; flat is dollars per item.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.umbrella_owner_fee_settings (
  storefront_owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  favorite_list_id uuid REFERENCES public.creator_favorite_lists (id) ON DELETE CASCADE,
  fee_type text NOT NULL DEFAULT 'none' CHECK (fee_type IN ('none', 'percent', 'flat')),
  fee_value numeric(10, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Existing installs used one row per storefront owner. Add per-collaborator column
-- and drop the owner-only primary key so each umbrella creator can have their own rate.
ALTER TABLE public.umbrella_owner_fee_settings
  ADD COLUMN IF NOT EXISTS favorite_list_id uuid REFERENCES public.creator_favorite_lists (id) ON DELETE CASCADE;

ALTER TABLE public.umbrella_owner_fee_settings
  DROP CONSTRAINT IF EXISTS umbrella_owner_fee_settings_pkey;

-- One fee per collaborator page; NULL favorite_list_id is the legacy storefront-wide fallback.
CREATE UNIQUE INDEX IF NOT EXISTS umbrella_owner_fee_per_list_uidx
  ON public.umbrella_owner_fee_settings (storefront_owner_id, favorite_list_id)
  WHERE favorite_list_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS umbrella_owner_fee_global_fallback_uidx
  ON public.umbrella_owner_fee_settings (storefront_owner_id)
  WHERE favorite_list_id IS NULL;

ALTER TABLE public.umbrella_owner_fee_settings ENABLE ROW LEVEL SECURITY;
