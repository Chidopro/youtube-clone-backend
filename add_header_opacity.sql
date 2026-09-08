-- Header color opacity for storefront navbar gradient (0–100%)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS header_opacity INTEGER DEFAULT 100;

COMMENT ON COLUMN users.header_opacity IS 'Opacity of storefront header brand colors, 0–100 (percent)';

-- Clamp invalid values if any appear later
UPDATE users SET header_opacity = 100 WHERE header_opacity IS NULL;
UPDATE users SET header_opacity = 0 WHERE header_opacity < 0;
UPDATE users SET header_opacity = 100 WHERE header_opacity > 100;
