-- Persistent session tokens for Google OAuth (survives backend restart).
-- Run this in Supabase SQL editor if you get "relation user_sessions does not exist".

CREATE TABLE IF NOT EXISTS public.user_sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage user_sessions" ON public.user_sessions;
CREATE POLICY "Service role can manage user_sessions"
    ON public.user_sessions FOR ALL
    USING (true)
    WITH CHECK (true);

-- Optional: delete sessions older than 7 days (run periodically or via cron)
-- DELETE FROM public.user_sessions WHERE created_at < NOW() - INTERVAL '7 days';

COMMENT ON TABLE public.user_sessions IS 'OAuth session tokens for /api/users/me and /api/favorites/upload; backend uses service role.';
