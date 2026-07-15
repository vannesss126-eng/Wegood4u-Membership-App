-- 2026-07-15:
--   1. Add 1 new partner store — K-boo CAFE' & Restaurant & Bar (Nimman, Chiang Mai).
--   2. Seed per-outlet referral codes for the 3 Chiang Mai stores. The two earlier
--      stores (mai-heun-60, akathip-chokdee) were already added in
--      20260714120000_add_chiang_mai_stores.sql and are NOT re-inserted here.
--
-- Idempotent: store uses ON CONFLICT (id) DO NOTHING; codes use
-- ON CONFLICT (partner_store_id) DO UPDATE, so re-running won't duplicate rows.
--
-- VERIFY FIRST:
--   SELECT id, name FROM public.partner_stores WHERE name ILIKE 'K-boo%';
--   SELECT partner_store_id, code FROM public.store_referral_codes
--     WHERE partner_store_id IN ('mai-heun-60','akathip-chokdee','k-boo-nimman');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('k-boo-nimman', 'K-boo CAFE’ & Restaurant & Bar', 'Café & Restaurant', 'Chiang Mai',
   'Nimmana Nimmanhaemin Tambon Su Thep, Amphoe Mueang Chiang Mai, Chiang Mai 50200, Thailand',
   18.7983311, 98.9672799, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/K%20boo%20Cafe%20&%20Restaurant%20&%20bar.webp',
   '+66911417121', '08:30 – 23:30',
   'A cozy café, restaurant, and bar in Chiang Mai, serving great coffee, delicious food, and refreshing drinks in a relaxed atmosphere.',
   '1 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/K%20boo%20cafe%20&%20Restaurant%20Bar/Screenshot%202026-07-14%20151532.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/K%20boo%20cafe%20&%20Restaurant%20Bar/Screenshot%202026-07-14%20151609.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/K%20boo%20cafe%20&%20Restaurant%20Bar/unnamed%20(11)%20(1).webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes for the 3 Chiang Mai stores.
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('mai-heun-60',     'MAIHEUNC60'),
  ('akathip-chokdee', 'AKACC10'),
  ('k-boo-nimman',    'KBOOC9')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
