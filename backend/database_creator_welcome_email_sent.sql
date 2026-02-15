-- Track when creator welcome email was sent (so we only send once on activate/approve).
-- Run in Supabase SQL Editor.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS creator_welcome_email_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN users.creator_welcome_email_sent_at IS 'Set when the creator welcome email is sent (on first activate/approve by master admin).';
