-- Sales tax collected on the Stripe Checkout session (Stripe Tax / automatic_tax).
-- Run in Supabase SQL Editor before relying on webhook persistence.
-- total_amount (updated on pay) = amount customer paid including tax; tax_amount is the tax portion only.

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2);

COMMENT ON COLUMN orders.tax_amount IS 'Sales tax in USD from Stripe Checkout session total_details.amount_tax; set when order is marked paid';
