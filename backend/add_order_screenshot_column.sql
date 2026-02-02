-- Add order-level screenshot column for Print Quality Image Generator and order emails.
-- Run this on production (Supabase SQL editor) so screenshots show in:
--   - Order confirmation emails (admin + customer)
--   - Print Quality Image Generator page (Load Screenshot)
-- Without this, screenshot is still read from cart JSONB when present; this column makes retrieval reliable.

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS selected_screenshot TEXT,
ADD COLUMN IF NOT EXISTS screenshot_timestamp TEXT;

COMMENT ON COLUMN orders.selected_screenshot IS 'Order-level screenshot (base64 data URL or URL) for print quality tool retrieval';
COMMENT ON COLUMN orders.screenshot_timestamp IS 'Video timestamp (seconds) used for screenshot capture; shown in order email';
