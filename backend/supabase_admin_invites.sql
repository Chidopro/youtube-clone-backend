-- Admin invite tokens for invite-only admin signup (ScreenMerch)
-- Run in Supabase SQL Editor. Master admin sends invite; recipient uses link to submit signup request.

CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    invited_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_token ON public.admin_invites(token);
CREATE INDEX IF NOT EXISTS idx_admin_invites_expires ON public.admin_invites(expires_at);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (backend sends invite and validates token)
CREATE POLICY "Service role full access admin_invites" ON public.admin_invites
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.admin_invites IS 'One-time invite tokens for admin signup; link in email points to /admin-signup?invite=TOKEN.';