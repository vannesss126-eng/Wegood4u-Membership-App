-- Rename the free-text partner store type "Coffee & Desserts" to "Cafe".
--
-- Context: partner_stores.type is a free-text display string, separate from the
-- normalized store_category enum (cafe|restaurant|bar|hotel|others) used by
-- submissions and badges. Category detection lowercases `type` and substring-
-- matches "coffee"/"dessert"/"cafe", so this rename does NOT change how any
-- store is categorized, routed, or badged — it only cleans up the display label
-- so it matches what the UI already shows, and lets us delete a hard-coded
-- relabel in the store picker (app/(tabs)/tasks.tsx).
--
-- Case-insensitive match for safety against any inconsistently-cased rows.

UPDATE public.partner_stores
SET type = 'Cafe'
WHERE lower(type) = 'coffee & desserts';
