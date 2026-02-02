-- Add order-level screenshot column for Print Quality Image Generator
-- Ensures screenshot is available when opening the tools page from the email link
-- even if cart JSONB is truncated or missing per-item screenshots

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS selected_screenshot TEXT,
ADD COLUMN IF NOT EXISTS screenshot_timestamp TEXT;

COMMENT ON COLUMN orders.selected_screenshot IS 'Order-level screenshot (base64 data URL or URL) for print quality tool retrieval';
COMMENT ON COLUMN orders.screenshot_timestamp IS 'Video timestamp (seconds) used for screenshot capture; shown in order email';
