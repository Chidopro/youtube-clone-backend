-- Email invites for umbrella collaborators (invite before account exists).
-- Run in Supabase SQL editor.

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
