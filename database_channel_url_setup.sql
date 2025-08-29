-- Add channel_url field to users table for personalized ScreenMerch links
-- This allows creators to have their own merch page: https://screenmerch.com/channel/[creator-name]

-- Add channel_url column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS channel_url VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS channel_slug VARCHAR(100) UNIQUE;

-- Create index for channel URL lookups
CREATE INDEX IF NOT EXISTS idx_users_channel_url ON users(channel_url);
CREATE INDEX IF NOT EXISTS idx_users_channel_slug ON users(channel_slug);

-- Create a function to generate channel slug from display name or email
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

-- Create a function to update channel URL when user profile changes
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

-- Create trigger to automatically update channel URL
DROP TRIGGER IF EXISTS trigger_update_channel_url ON users;
CREATE TRIGGER trigger_update_channel_url
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_url();

-- Update existing users to have channel URLs
UPDATE users 
SET channel_slug = generate_channel_slug(display_name, email),
    channel_url = 'https://screenmerch.com/channel/' || generate_channel_slug(display_name, email)
WHERE channel_slug IS NULL;

-- Add RLS policy to allow public access to channel URLs
DROP POLICY IF EXISTS "Public can view channel URLs" ON users;
CREATE POLICY "Public can view channel URLs" ON users
    FOR SELECT USING (true);
