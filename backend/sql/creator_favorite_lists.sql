-- Named favorite pages per creator (subdomain sidebar) + optional order attribution.
-- Run in Supabase SQL Editor after review.

CREATE TABLE IF NOT EXISTS public.creator_favorite_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, slug)
);

CREATE INDEX IF NOT EXISTS creator_favorite_lists_owner_idx
  ON public.creator_favorite_lists (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS creator_favorite_lists_one_primary_per_owner
  ON public.creator_favorite_lists (owner_user_id)
  WHERE is_primary = true;

ALTER TABLE public.creator_favorites
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.creator_favorite_lists (id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS favorite_list_id uuid REFERENCES public.creator_favorite_lists (id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS favorite_list_id uuid REFERENCES public.creator_favorite_lists (id) ON DELETE SET NULL;

-- Backfill: one primary list per owner who already has favorites, attach rows.
INSERT INTO public.creator_favorite_lists (owner_user_id, slug, display_name, sort_order, is_primary)
SELECT DISTINCT cf.user_id, 'owner', COALESCE(u.display_name, u.username, 'Favorites'), 0, true
FROM public.creator_favorites cf
LEFT JOIN public.users u ON u.id = cf.user_id
WHERE cf.list_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.creator_favorite_lists l
    WHERE l.owner_user_id = cf.user_id AND l.is_primary = true
  );

UPDATE public.creator_favorites cf
SET list_id = l.id
FROM public.creator_favorite_lists l
WHERE l.owner_user_id = cf.user_id
  AND l.slug = 'owner'
  AND l.is_primary = true
  AND cf.list_id IS NULL;

COMMENT ON TABLE public.creator_favorite_lists IS 'Named public favorite pages under a creator (e.g. owner + Jane/Mary for sidebar).';
