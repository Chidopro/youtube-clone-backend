-- Order Processing Queue System
-- Secure system for outsourcing order processing while protecting IP

-- Order processing queue table
CREATE TABLE IF NOT EXISTS order_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'processing', 'completed', 'reviewed', 'failed')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- processor user ID
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 2), -- 0=normal, 1=high, 2=urgent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    worker_notes TEXT, -- Notes from the worker
    processing_attempts INTEGER DEFAULT 0,
    processed_image_url TEXT, -- URL to processed image (stored after processing)
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5), -- 1-5 rating
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing history (audit trail)
CREATE TABLE IF NOT EXISTS processing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    queue_id UUID REFERENCES order_processing_queue(id) ON DELETE CASCADE,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed', 'needs_review', 'rejected')),
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
    notes TEXT,
    processed_image_url TEXT, -- URL to processed image
    processing_time_seconds INTEGER, -- How long processing took
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker roles table (extend users table with processor role)
-- Note: This assumes you'll add a 'role' column to users table or use is_admin pattern
-- For now, we'll use a separate table to track processor permissions

CREATE TABLE IF NOT EXISTS processor_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'processor' CHECK (role IN ('processor', 'reviewer', 'admin')),
    is_active BOOLEAN DEFAULT true,
    max_orders_per_day INTEGER DEFAULT 50, -- Limit orders per day
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_queue_status ON order_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_order_queue_assigned_to ON order_processing_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_order_queue_order_id ON order_processing_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_order_queue_priority ON order_processing_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_processing_history_order_id ON processing_history(order_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_processed_by ON processing_history(processed_by);
CREATE INDEX IF NOT EXISTS idx_processor_permissions_user_id ON processor_permissions(user_id);

-- Enable RLS
ALTER TABLE order_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE processor_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_processing_queue
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Processors can view assigned orders" ON order_processing_queue;
DROP POLICY IF EXISTS "Processors can update assigned orders" ON order_processing_queue;
DROP POLICY IF EXISTS "Admins can manage all orders" ON order_processing_queue;
DROP POLICY IF EXISTS "Processors can view pending orders" ON order_processing_queue;

-- Processors can view orders assigned to them
CREATE POLICY "Processors can view assigned orders" ON order_processing_queue
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        (status = 'pending' AND EXISTS (
            SELECT 1 FROM processor_permissions 
            WHERE user_id = auth.uid() 
            AND is_active = true
        ))
    );

-- Processors can update orders assigned to them
CREATE POLICY "Processors can update assigned orders" ON order_processing_queue
    FOR UPDATE USING (
        assigned_to = auth.uid() AND
        EXISTS (
            SELECT 1 FROM processor_permissions 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Processors can view pending orders (to claim them)
CREATE POLICY "Processors can view pending orders" ON order_processing_queue
    FOR SELECT USING (
        status = 'pending' AND
        EXISTS (
            SELECT 1 FROM processor_permissions 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Admins can manage all orders
CREATE POLICY "Admins can manage all orders" ON order_processing_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- RLS Policies for processing_history
DROP POLICY IF EXISTS "Processors can view own history" ON processing_history;
DROP POLICY IF EXISTS "Admins can view all history" ON processing_history;

-- Processors can view their own processing history
CREATE POLICY "Processors can view own history" ON processing_history
    FOR SELECT USING (processed_by = auth.uid());

-- Admins can view all processing history
CREATE POLICY "Admins can view all history" ON processing_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- RLS Policies for processor_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON processor_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON processor_permissions;

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions" ON processor_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Admins can manage all permissions
CREATE POLICY "Admins can manage permissions" ON processor_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Function to automatically create queue entry when order is created
CREATE OR REPLACE FUNCTION auto_create_processing_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create queue entry for paid orders
    IF NEW.status = 'paid' THEN
        INSERT INTO order_processing_queue (order_id, status, priority)
        VALUES (NEW.order_id, 'pending', 0)
        ON CONFLICT DO NOTHING; -- Prevent duplicates
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create queue entry
DROP TRIGGER IF EXISTS trigger_auto_create_processing_queue ON orders;
CREATE TRIGGER trigger_auto_create_processing_queue
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    WHEN (NEW.status = 'paid')
    EXECUTE FUNCTION auto_create_processing_queue();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_order_queue_updated_at ON order_processing_queue;
CREATE TRIGGER trigger_update_order_queue_updated_at
    BEFORE UPDATE ON order_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, UPDATE ON order_processing_queue TO authenticated;
GRANT SELECT ON processing_history TO authenticated;
GRANT SELECT ON processor_permissions TO authenticated;

