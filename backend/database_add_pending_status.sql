-- Allow 'pending' status for new creator sign-ups (admin pending approval)
-- Run this in Supabase SQL Editor if your users table rejects status='pending'.
--
-- To find the exact constraint name in Supabase: Table Editor -> users -> RLS/constraints,
-- or run: SELECT conname FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'c';

-- Drop existing check constraint (Postgres often names it users_status_check)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Some setups use a different name; drop that too if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check1;

-- Re-add constraint including 'pending' for creator sign-up flow
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'banned', 'pending'));

-- Ensure role column exists (needed for creator vs customer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'customer';
  END IF;
END $$;
