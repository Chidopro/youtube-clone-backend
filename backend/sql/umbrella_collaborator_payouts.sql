-- Off-platform payout ledger: storefront owner records payments to umbrella collaborators.
-- Run in Supabase SQL Editor after creator_favorite_lists storefront columns exist.

CREATE TABLE IF NOT EXISTS public.umbrella_collaborator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  favorite_list_id uuid NOT NULL REFERENCES public.creator_favorite_lists (id) ON DELETE CASCADE,
  collaborator_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS umbrella_collaborator_payouts_owner_idx
  ON public.umbrella_collaborator_payouts (storefront_owner_id);

CREATE INDEX IF NOT EXISTS umbrella_collaborator_payouts_list_idx
  ON public.umbrella_collaborator_payouts (favorite_list_id);

ALTER TABLE public.umbrella_collaborator_payouts ENABLE ROW LEVEL SECURITY;
