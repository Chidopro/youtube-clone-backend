-- Add order-level screenshot column for Print Quality Image Generator
-- Ensures screenshot is available when opening the tools page from the email link
-- even if cart JSONB is truncated or missing per-item screenshots

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS selected_screenshot TEXT;

COMMENT ON COLUMN orders.selected_screenshot IS 'Order-level screenshot (base64 data URL or URL) for print quality tool retrieval';
