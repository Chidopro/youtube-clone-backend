-- Live Printful STANDARD rate from /shipping/rates at worker submit (for reconciliation vs Stripe shipping_cost).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printful_shipping_quote_usd NUMERIC(10, 2);

COMMENT ON COLUMN orders.printful_shipping_quote_usd IS 'Printful API STANDARD shipping for this cart/address when the worker submitted the order (fulfillment estimate).';
