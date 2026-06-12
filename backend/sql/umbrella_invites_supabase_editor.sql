-- =============================================================================
-- Umbrella invite system — paste entire file into Supabase SQL Editor → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Email invites (pending before account exists; completed via /join?token=...)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.umbrella_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS umbrella_email_invites_owner_idx
  ON public.umbrella_email_invites (channel_owner_id, status);

CREATE INDEX IF NOT EXISTS umbrella_email_invites_email_idx
  ON public.umbrella_email_invites (lower(invited_email));

COMMENT ON TABLE public.umbrella_email_invites IS 'Pending umbrella invites by email; completed via subdomain /join link.';

-- -----------------------------------------------------------------------------
-- 2) Favorite lists linked to storefront owner (umbrella pages under subdomain)
-- -----------------------------------------------------------------------------

ALTER TABLE public.creator_favorite_lists
  ADD COLUMN IF NOT EXISTS storefront_owner_id uuid REFERENCES public.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS creator_favorite_lists_storefront_idx
  ON public.creator_favorite_lists (storefront_owner_id);

-- Backfill: owner primary lists show on their own subdomain.
UPDATE public.creator_favorite_lists
SET storefront_owner_id = owner_user_id
WHERE storefront_owner_id IS NULL;

-- -----------------------------------------------------------------------------
-- 3) Optional: confirm success (should return rows, not errors)
-- -----------------------------------------------------------------------------

SELECT 'umbrella_email_invites' AS check_name, COUNT(*) AS row_count
FROM public.umbrella_email_invites;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creator_favorite_lists'
  AND column_name = 'storefront_owner_id';
