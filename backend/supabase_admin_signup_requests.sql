-- Admin signup requests table for ScreenMerch Admin Management
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS public.admin_signup_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_signup_requests_status ON public.admin_signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_signup_requests_requested_at ON public.admin_signup_requests(requested_at DESC);

ALTER TABLE public.admin_signup_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a signup request (anon insert for /admin-signup page)
CREATE POLICY "Allow insert for signup requests" ON public.admin_signup_requests
    FOR INSERT WITH CHECK (true);

-- Service role can do everything (backend uses it to list/approve/reject)
CREATE POLICY "Service role full access" ON public.admin_signup_requests
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.admin_signup_requests IS 'Pending and approved admin signup requests; master admins approve via Admin Management.';
