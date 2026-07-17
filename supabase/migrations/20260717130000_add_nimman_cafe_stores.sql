-- 2026-07-17: Add 3 new cafe partner stores (Sirimangkalajarn / Nimman, Chiang Mai):
--   Groon Bread & Brunch Cafe, Cheevit Cheeva Chiang Mai, Rob's Berry.
--
-- NOTE ON TYPE: type is set to the plain ASCII 'Cafe' (NOT 'Café' with an accent).
-- Category detection lowercases `type` and substring-matches 'cafe' — an accented
-- 'café' does NOT contain the ASCII substring 'cafe', so it would fall through to
-- the wrong category/route and mis-badge submissions. Keep it as 'Cafe'.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING, so re-running won't duplicate rows.
--
-- VERIFY:
--   SELECT id, name, type FROM public.partner_stores
--     WHERE id IN ('groon-bread-brunch','cheevit-cheeva','robs-berry');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('groon-bread-brunch', 'Groon Bread & Brunch Cafe', 'Cafe', 'Chiang Mai',
   '6 Siri Mangkalajarn Rd Lane 7, Tambon Su Thep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.7951318, 98.9711357, 4.6,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Groon%20Bread%20&%20Brunch%20Cafe/unnamed%20(12).webp',
   '+66615824490', '08:30 – 17:00',
   'A minimalist, Korean-style bakery and brunch spot in Chiang Mai''s Nimmanhaemin area.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Groom%20bread%20&%20brunch%20cafe/unnamed_1_1_optimized_25.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Groom%20bread%20&%20brunch%20cafe/unnamed_2_1_optimized_25.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Groom%20bread%20&%20brunch%20cafe/unnamed_3_2_optimized_25.webp"]'::jsonb,
   true),

  ('cheevit-cheeva', 'Cheevit Cheeva Chiang Mai', 'Cafe', 'Chiang Mai',
   '6 Siri Mangkalajarn Rd Lane 7, Tambon Su Thep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.7951549, 98.970488, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/cheevit%20cheeva/unnamed%20(4)%20(1).webp',
   '+66991410440', '11:00 – 22:00',
   'A renowned, minimalist-style dessert café in Chiang Mai, Thailand, famous for its Korean-style Bingsu (shaved ice).',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/cheevit%20cheeva/unnamed_6_1_optimized_25.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/cheevit%20cheeva/unnamed_7_1_optimized_25.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/cheevit%20cheeva/unnamed_8_1_optimized_25.webp"]'::jsonb,
   true),

  ('robs-berry', 'Rob''s Berry', 'Cafe', 'Chiang Mai',
   '6 soi 7 Sirimungkalajarn road, Suthep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.7952267, 98.9709473, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Robs%20Berry.webp',
   '+66922468228', '09:00 – 18:00',
   'A charming, minimalist café on Sirimangkalajarn Soi 7 specializing in homemade 100% natural frozen yogurt, Greek yogurt, and acai bowls.',
   '59 – 150 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Robs%20Berry/Screenshot%202026-07-17%20173406.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Robs%20Berry/oEq7rQIMAvAEFo6X8ASbDAJfIftjiLQHajPAfotplv-sdweummd6v-text-logo-v1_QGJvd2NoYW5pZGE4_q75_optimized_25.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;
