-- Step 1: Create the order_processing_queue table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS order_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'processing', 'completed', 'reviewed', 'failed')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    worker_notes TEXT,
    processing_attempts INTEGER DEFAULT 0,
    processed_image_url TEXT,
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_queue_status ON order_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_order_queue_order_id ON order_processing_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_order_queue_priority ON order_processing_queue(priority DESC, created_at ASC);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE order_processing_queue ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policy to allow admins to manage all orders
-- (Drop existing policy if it exists)
DROP POLICY IF EXISTS "Admins can manage all orders" ON order_processing_queue;

CREATE POLICY "Admins can manage all orders" ON order_processing_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Step 5: Create processing_history table
CREATE TABLE IF NOT EXISTS processing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL,
    queue_id UUID REFERENCES order_processing_queue(id) ON DELETE CASCADE,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed', 'needs_review', 'rejected')),
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
    notes TEXT,
    processed_image_url TEXT,
    processing_time_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create processor_permissions table
CREATE TABLE IF NOT EXISTS processor_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'processor' CHECK (role IN ('processor', 'reviewer', 'admin')),
    is_active BOOLEAN DEFAULT true,
    max_orders_per_day INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Step 7: Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_processing_history_order_id ON processing_history(order_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_processed_by ON processing_history(processed_by);
CREATE INDEX IF NOT EXISTS idx_processor_permissions_user_id ON processor_permissions(user_id);

-- Step 8: Enable RLS for new tables
ALTER TABLE processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE processor_permissions ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for processing_history
DROP POLICY IF EXISTS "Admins can view all history" ON processing_history;
CREATE POLICY "Admins can view all history" ON processing_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Step 10: Create RLS policies for processor_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON processor_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON processor_permissions;

CREATE POLICY "Users can view own permissions" ON processor_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage permissions" ON processor_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Step 11: Grant permissions
GRANT SELECT, INSERT, UPDATE ON order_processing_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON order_processing_queue TO service_role;
GRANT SELECT ON processing_history TO authenticated;
GRANT SELECT ON processing_history TO service_role;
GRANT SELECT, INSERT, UPDATE ON processor_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON processor_permissions TO service_role;

-- Step 12: Update order status to 'paid' if it's still 'pending'
UPDATE orders
SET status = 'paid'
WHERE order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'
  AND status = 'pending';

-- Step 13: Add to processing queue (if it doesn't exist)
INSERT INTO order_processing_queue (order_id, status, priority)
SELECT 
  '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'::VARCHAR,
  'pending',
  0
WHERE NOT EXISTS (
  SELECT 1 
  FROM order_processing_queue 
  WHERE order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad'
);

-- Step 14: Verify the fix
SELECT 
  o.order_id,
  o.status as order_status,
  q.id as queue_id,
  q.status as queue_status,
  q.created_at as queue_created
FROM orders o
LEFT JOIN order_processing_queue q ON o.order_id = q.order_id
WHERE o.order_id = '44be5aba-a922-4ba0-9fca-f85d5f2ebfad';

