-- Comprehensive Database Migration Script
-- Run this in Supabase SQL Editor to ensure all required columns exist

-- 1. Add missing columns to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'creator' CHECK (role IN ('customer', 'creator', 'admin')),
ADD COLUMN IF NOT EXISTS channel_url VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS channel_slug VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned'));

-- 3. Update the tier constraint to ensure it allows 'pro'
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier CHECK (tier IN ('free', 'pro', 'basic', 'premium', 'creator_network'));

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_channel_url ON users(channel_url);
CREATE INDEX IF NOT EXISTS idx_users_channel_slug ON users(channel_slug);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 5. Create a function to generate channel slug from display name or email
CREATE OR REPLACE FUNCTION generate_channel_slug(display_name TEXT, email TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Use display_name if available, otherwise use email prefix
    IF display_name IS NOT NULL AND display_name != '' THEN
        base_slug := LOWER(REGEXP_REPLACE(display_name, '[^a-zA-Z0-9]', '', 'g'));
    ELSE
        base_slug := LOWER(SPLIT_PART(email, '@', 1));
    END IF;
    
    -- Remove any remaining special characters and limit length
    base_slug := SUBSTRING(REGEXP_REPLACE(base_slug, '[^a-z0-9]', '', 'g') FROM 1 FOR 30);
    
    -- Ensure it's not empty
    IF base_slug = '' THEN
        base_slug := 'creator';
    END IF;
    
    final_slug := base_slug;
    
    -- Check if slug already exists and append number if needed
    WHILE EXISTS (SELECT 1 FROM users WHERE channel_slug = final_slug) LOOP
        final_slug := base_slug || counter;
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 100 THEN
            final_slug := base_slug || EXTRACT(EPOCH FROM NOW())::INTEGER;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a function to update channel URL when user profile changes
CREATE OR REPLACE FUNCTION update_channel_url()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate channel slug if not exists
    IF NEW.channel_slug IS NULL THEN
        NEW.channel_slug := generate_channel_slug(NEW.display_name, NEW.email);
    END IF;
    
    -- Update channel URL
    NEW.channel_url := 'https://screenmerch.com/channel/' || NEW.channel_slug;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to automatically update channel URL
DROP TRIGGER IF EXISTS trigger_update_channel_url ON users;
CREATE TRIGGER trigger_update_channel_url
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_url();

-- 8. Update existing users to have channel URLs and proper roles
UPDATE users 
SET channel_slug = generate_channel_slug(display_name, email),
    channel_url = 'https://screenmerch.com/channel/' || generate_channel_slug(display_name, email),
    role = 'creator'
WHERE channel_slug IS NULL OR role IS NULL;

-- 9. Add RLS policies for new columns
DROP POLICY IF EXISTS "Public can view channel URLs" ON users;
CREATE POLICY "Public can view channel URLs" ON users
    FOR SELECT USING (true);

-- 10. Verify the changes
SELECT 'user_subscriptions columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
AND column_name IN ('trial_end', 'stripe_subscription_id', 'stripe_customer_id', 'tier')
ORDER BY column_name;

SELECT 'users columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('role', 'channel_url', 'channel_slug', 'is_admin', 'status')
ORDER BY column_name;

-- 11. Show sample data to verify
SELECT 'Sample users:' as info;
SELECT id, email, role, channel_slug, channel_url FROM users LIMIT 3;

SELECT 'Sample subscriptions:' as info;
SELECT id, user_id, tier, status, trial_end FROM user_subscriptions LIMIT 3;
