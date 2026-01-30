-- Creator Personalization Setup for ScreenMerch
-- This script adds personalization fields to enable white-label creator apps
-- Run this in your Supabase SQL Editor

-- Add personalization fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS custom_logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#667eea', -- Hex color
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#764ba2',
ADD COLUMN IF NOT EXISTS hide_screenmerch_branding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_favicon_url TEXT,
ADD COLUMN IF NOT EXISTS custom_meta_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS custom_meta_description TEXT,
ADD COLUMN IF NOT EXISTS personalization_enabled BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain);
CREATE INDEX IF NOT EXISTS idx_users_custom_domain ON users(custom_domain);
CREATE INDEX IF NOT EXISTS idx_users_personalization_enabled ON users(personalization_enabled);

-- Create a function to validate subdomain format
CREATE OR REPLACE FUNCTION validate_subdomain(subdomain_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Subdomain must be lowercase alphanumeric with hyphens, 3-63 characters
    -- Cannot start or end with hyphen
    -- Reserved subdomains: www, api, admin, app, mail, ftp, localhost, test
    IF subdomain_text IS NULL OR subdomain_text = '' THEN
        RETURN FALSE;
    END IF;
    
    IF LENGTH(subdomain_text) < 3 OR LENGTH(subdomain_text) > 63 THEN
        RETURN FALSE;
    END IF;
    
    IF subdomain_text ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' = FALSE THEN
        RETURN FALSE;
    END IF;
    
    -- Check for reserved subdomains
    IF LOWER(subdomain_text) IN ('www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev', 'prod', 'cdn', 'static', 'assets', 'images', 'media', 'blog', 'shop', 'store', 'help', 'support', 'docs', 'status') THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate subdomain before insert/update
CREATE OR REPLACE FUNCTION check_subdomain_validity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subdomain IS NOT NULL AND validate_subdomain(NEW.subdomain) = FALSE THEN
        RAISE EXCEPTION 'Invalid subdomain format. Must be 3-63 lowercase alphanumeric characters with hyphens, cannot start/end with hyphen, and cannot be a reserved word.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_subdomain ON users;
CREATE TRIGGER trigger_validate_subdomain
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.subdomain IS NOT NULL)
    EXECUTE FUNCTION check_subdomain_validity();

-- Add comment to document the fields
COMMENT ON COLUMN users.subdomain IS 'Subdomain for creator personalization (e.g., "john" for john.screenmerch.com)';
COMMENT ON COLUMN users.custom_domain IS 'Custom domain for creator (e.g., "merch.johnsmith.com")';
COMMENT ON COLUMN users.custom_logo_url IS 'URL to creator''s custom logo image';
COMMENT ON COLUMN users.primary_color IS 'Primary brand color in hex format (e.g., #FF5733)';
COMMENT ON COLUMN users.secondary_color IS 'Secondary brand color in hex format (e.g., #C70039)';
COMMENT ON COLUMN users.hide_screenmerch_branding IS 'If true, hide "Powered by ScreenMerch" branding';
COMMENT ON COLUMN users.custom_favicon_url IS 'URL to creator''s custom favicon';
COMMENT ON COLUMN users.custom_meta_title IS 'Custom page title for SEO';
COMMENT ON COLUMN users.custom_meta_description IS 'Custom meta description for SEO';
COMMENT ON COLUMN users.personalization_enabled IS 'If true, personalization features are active';

-- Update RLS policies to allow public read access to personalization fields
-- (Needed for subdomain detection)
DROP POLICY IF EXISTS "Public can view personalization fields" ON users;
CREATE POLICY "Public can view personalization fields" ON users
    FOR SELECT USING (
        -- Allow viewing personalization fields for users with personalization enabled
        personalization_enabled = true
    );

-- Note: The existing "Public can view users for authentication" policy should already cover this,
-- but we're being explicit about personalization fields
