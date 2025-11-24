-- Create creator_favorites table for storing creator's favorite images
-- This table allows creators to upload favorite images that users can use to make merchandise

CREATE TABLE IF NOT EXISTS creator_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channelTitle VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_creator_favorites_user_id ON creator_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_favorites_channelTitle ON creator_favorites(channelTitle);
CREATE INDEX IF NOT EXISTS idx_creator_favorites_created_at ON creator_favorites(created_at);

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_creator_favorites_updated_at 
    BEFORE UPDATE ON creator_favorites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE creator_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for creator_favorites table
-- Public can view all favorites (for users to see on profile pages)
CREATE POLICY "Public can view all favorites" ON creator_favorites
    FOR SELECT USING (true);

-- Creators can insert their own favorites
CREATE POLICY "Creators can insert their own favorites" ON creator_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Creators can update their own favorites
CREATE POLICY "Creators can update their own favorites" ON creator_favorites
    FOR UPDATE USING (auth.uid() = user_id);

-- Creators can delete their own favorites
CREATE POLICY "Creators can delete their own favorites" ON creator_favorites
    FOR DELETE USING (auth.uid() = user_id);

