-- Fix Order Queue - Run this in Supabase SQL Editor
-- This will mark the order as 'paid' and add it to the processing queue

-- Step 1: Update order status to 'paid' if it's still 'pending'
UPDATE orders
SET status = 'paid'
WHERE order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'
  AND status = 'pending';

-- Step 2: Check if processing queue entry exists
-- (This is just a check - the INSERT below will handle creation)
SELECT id, order_id, status 
FROM order_processing_queue 
WHERE order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad';

-- Step 3: Insert into processing queue if it doesn't exist
INSERT INTO order_processing_queue (order_id, status, priority)
SELECT 
  '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'::uuid,
  'pending',
  0
WHERE NOT EXISTS (
  SELECT 1 
  FROM order_processing_queue 
  WHERE order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'
);

-- Step 4: Verify the fix
SELECT 
  o.order_id,
  o.status as order_status,
  q.id as queue_id,
  q.status as queue_status,
  q.created_at as queue_created
FROM orders o
LEFT JOIN order_processing_queue q ON o.order_id = q.order_id
WHERE o.order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad';

