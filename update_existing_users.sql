-- Update existing users to have 'creator' role
-- Run this in your Supabase SQL editor

-- Update all users who don't have a role set
UPDATE users 
SET role = 'creator' 
WHERE role IS NULL OR role = '';

-- Verify the update
SELECT id, email, role, created_at 
FROM users 
ORDER BY created_at DESC;

-- Optional: Add a default value constraint for future users
-- ALTER TABLE users ALTER COLUMN role SET DEFAULT 'creator'; 