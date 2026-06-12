-- Link favorite pages to a storefront subdomain owner (umbrella member pages appear under owner subdomain).
-- Run in Supabase SQL editor.

ALTER TABLE public.creator_favorite_lists
  ADD COLUMN IF NOT EXISTS storefront_owner_id uuid REFERENCES public.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS creator_favorite_lists_storefront_idx
  ON public.creator_favorite_lists (storefront_owner_id);

-- Backfill: owner primary lists show on their own subdomain.
UPDATE public.creator_favorite_lists
SET storefront_owner_id = owner_user_id
WHERE storefront_owner_id IS NULL;
