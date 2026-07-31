-- 2026-07-31: Add 2 new restaurant partner stores in Kuala Lumpur (Iqan Bakar,
-- Nasi Lemak Uncle Bob) + their per-outlet referral codes.
--
-- Type is 'Restaurant' — mapStoreCategory matches 'restaurant' first, so these
-- route to the restaurant category and badge correctly.
--
-- Codes are case-sensitive — stored EXACTLY as provided, never re-cased.
--
-- Idempotent: stores use ON CONFLICT (id) DO NOTHING; codes use
-- ON CONFLICT (partner_store_id) DO UPDATE.
--
-- VERIFY:
--   SELECT id, name, type FROM public.partner_stores
--     WHERE id IN ('iqan-bakar','nasi-lemak-uncle-bob');
--   SELECT partner_store_id, code FROM public.store_referral_codes
--     WHERE partner_store_id IN ('iqan-bakar','nasi-lemak-uncle-bob');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('iqan-bakar', 'Iqan Bakar', 'Restaurant', 'Kuala Lumpur',
   'Off, Jalan Cheras Cheras Batu 2½ Cheras, 55200 Kuala Lumpur, Federal Territory of Kuala Lumpur',
   3.0982341, 101.6962313, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/IMG20260729124143.webp',
   '+60192219411', '11:00 – 00:00',
   'Iqan Bakar Cheras is a popular local seafood restaurant known for its grilled fish, masala squid, buttermilk prawns, and signature sambal.',
   '20 – 40 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/IQAN%20BAKAR/IMG20260729124017.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/IQAN%20BAKAR/IMG20260729124114.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/IQAN%20BAKAR/IMG20260729124121.webp"]'::jsonb,
   true),

  ('nasi-lemak-uncle-bob', 'Nasi Lemak Uncle Bob', 'Restaurant', 'Kuala Lumpur',
   '117, Jalan Raja Abdullah, Kampung Baru, 50300 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',
   3.167615, 101.7032598, 4.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Nasi%20Lemak%20Uncle%20Bob.webp',
   '+60145508979', '11:00 – 00:00',
   'A highly popular and vibrant local eatery in Kuala Lumpur, best known for its authentic Malay-style steamed coconut rice (nasi lemak kukus).',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nasi%20Lemak%20Uncle%20Bob/IMG20260729151628.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nasi%20Lemak%20Uncle%20Bob/IMG20260729151704.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nasi%20Lemak%20Uncle%20Bob/IMG20260729151824.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes for the 2 new restaurants.
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('iqan-bakar',           'IQANBM31'),
  ('nasi-lemak-uncle-bob', 'NLCBM37')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
