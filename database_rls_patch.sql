-- Add public read access policy for user_subscriptions table
-- This allows the sidebar to display all platform subscribers

-- First drop the existing policy if it exists
DROP POLICY IF EXISTS "Public can view user subscriptions" ON user_subscriptions;

-- Create the new policy
CREATE POLICY "Public can view user subscriptions" ON user_subscriptions
    FOR SELECT USING (status = 'active'); 