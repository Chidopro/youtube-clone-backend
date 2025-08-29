-- Fix video access for homepage
-- Allow public read access to videos2 table for the homepage

-- Enable RLS on videos2 table (if not already enabled)
ALTER TABLE public.videos2 ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to videos
CREATE POLICY "Allow public read access to videos" ON public.videos2
    FOR SELECT
    USING (true);

-- Create policy to allow authenticated users to insert their own videos
CREATE POLICY "Allow authenticated users to insert videos" ON public.videos2
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Create policy to allow users to update their own videos
CREATE POLICY "Allow users to update own videos" ON public.videos2
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own videos
CREATE POLICY "Allow users to delete own videos" ON public.videos2
    FOR DELETE
    USING (auth.uid() = user_id);

-- Also fix other tables that might need public read access
-- Products table - allow public read access for merchandise
CREATE POLICY "Allow public read access to products" ON public.products
    FOR SELECT
    USING (true);

-- Profiles table - allow public read access to creator profiles
CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT
    USING (true);

-- Sales table - only allow users to see their own sales
CREATE POLICY "Allow users to see own sales" ON public.sales
    FOR SELECT
    USING (auth.uid() = user_id);

-- Videos table - allow public read access
CREATE POLICY "Allow public read access to videos" ON public.videos
    FOR SELECT
    USING (true);
