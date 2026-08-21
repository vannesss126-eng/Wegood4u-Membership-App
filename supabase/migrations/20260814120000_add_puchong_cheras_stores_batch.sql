-- 2026-08-14: Batch add Puchong + Cheras partner stores + referral codes.
--
--   5 NEW stores (all Malaysia):
--     Kekwa Cafe by Kekwa Delicacy   (Puchong, Selangor)  — KCBKDM65
--     Warung Cikgu Bukit Puchong     (Puchong, Selangor)  — WCBPM90
--     Wanis Shieldout Enterprise     (Puchong, Selangor)  — WSPIM102
--     Restoran Chef Gemok            (Puchong, Selangor)  — RCGM113
--     Kapitian Tandoori House Cheras (Cheras)             — KTHCM92
--
-- NOTE — city 'Cheras': the only existing Cheras store (Thai Geng Cheras Jln
-- Lanchang) is stored under city 'Kuala Lumpur'. This batch uses 'Cheras' as
-- explicitly requested; if you want them grouped together, change this to
-- 'Kuala Lumpur' (or re-home the Thai Geng row).
--
-- HELD — 3 more Puchong stores from this batch are NOT included pending data
-- fixes (see handoff): Nasi Arab Tambah Kira (referral code KCBKDM65 duplicates
-- Kekwa's; also needs correct Puchong coordinates), JMC Jaimascus and
-- 85 X Signature (both carry the placeholder KL coordinate 3.1022873,101.6954442
-- instead of a Puchong location).
--
-- `country` set on every row (required since 20260730120000). Price ranges
-- normalized to "N – N MYR". Non-contiguous opening days written faithfully
-- (e.g. Wanis is closed Wed; Chef Gemok is closed Mon). Codes are case-sensitive
-- — stored EXACTLY as provided.
--
-- Idempotent: new stores ON CONFLICT (id) DO NOTHING; codes ON CONFLICT
-- (partner_store_id) DO UPDATE.
--
-- VERIFY:
--   SELECT id, name, type, city, country FROM public.partner_stores
--     WHERE id IN ('kekwa-cafe-by-kekwa-delicacy','warung-cikgu-bukit-puchong',
--                  'wanis-shieldout-enterprise','restoran-chef-gemok',
--                  'kapitian-tandoori-house-cheras');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "country", "address", "latitude", "longitude",
   "rating", "image", "phone", "hours", "description", "price_range", "days",
   "menu_images", "active")
VALUES
  ('kekwa-cafe-by-kekwa-delicacy', 'Kekwa Cafe by Kekwa Delicacy', 'Restaurant', 'Puchong', 'Malaysia',
   '35, Jln BP 7/2, Bandar Bukit Puchong, 47120 Puchong, Selangor',
   2.9840927, 101.6209871, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Kekwa%20Cafe%20by%20Kekwa%20Delicacy.webp',
   '+60126639660', '07:30 – 10:00',
   'It serving local comfort foods like Wantan Mee Kicap Ipoh, Nasi Ayam Penyet, and Ayam Goreng Kriuk',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kekwa%20Cafe%20by%20Kekwa%20Delicacy/Screenshot%202026-08-13%20144645%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kekwa%20Cafe%20by%20Kekwa%20Delicacy/Screenshot%202026-08-13%20144709%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kekwa%20Cafe%20by%20Kekwa%20Delicacy/Screenshot%202026-08-13%20144730%20(1).webp"]'::jsonb,
   true),

  ('warung-cikgu-bukit-puchong', 'Warung Cikgu Bukit Puchong', 'Restaurant', 'Puchong', 'Malaysia',
   '1, Jalan BP 6/7, Bandar Bukit Puchong, 47100 Puchong, Selangor',
   2.9840611, 101.6236567, 4.1,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/IMG-20260814-WA0014.webp',
   '+60169736579', '07:00 – 22:00',
   'the stall serves hot steamed rice, aromatic gulai curry gravy, crispy fried turmeric chicken pieces, and fiery sambal belacan',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Warung%20Cikgu%20Bukit%20Puchong/IMG_1541.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Warung%20Cikgu%20Bukit%20Puchong/IMG_1542.webp"]'::jsonb,
   true),

  ('wanis-shieldout-enterprise', 'Wanis Shieldout Enterprise', 'Restaurant', 'Puchong', 'Malaysia',
   '16, Jalan Indah 3/13, Taman Puchong Indah, 47100 Puchong, Selangor',
   3.0129349, 101.6036526, 4.6,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Wanis%20Shieldout%20Enterprise.webp',
   '+60193653465', '11:00 – 23:00',
   'the stall serves hot steamed rice, aromatic gulai curry gravy, crispy fried turmeric chicken pieces, and fiery sambal belacan',
   '1 – 100 MYR', 'Mon – Tue, Thu – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Wanis%20Shieldout%20Enterprise/Screenshot%202026-08-13%20151814.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Wanis%20Shieldout%20Enterprise/Screenshot%202026-08-13%20151756.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Wanis%20Shieldout%20Enterprise/Screenshot%202026-08-13%20151832.webp"]'::jsonb,
   true),

  ('restoran-chef-gemok', 'Restoran Chef Gemok', 'Restaurant', 'Puchong', 'Malaysia',
   '48, Jalan BP 6/9, Bandar Bukit Puchong, 47100 Puchong, Selangor',
   2.9849745, 101.6218674, 4.2,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Chef%20Gemok.webp',
   '+60136868583', '11:00 – 22:00',
   'is a popular casual dining Malay restaurant known for authentic masakan kampung (village-style cooking), fresh seafood, and special oversized seafood platters',
   '1 – 20 MYR', 'Tue – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Chef%20Gemok/IMG-20260812-WA0093.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Chef%20Gemok/IMG-20260812-WA0106.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Chef%20Gemok/IMG-20260812-WA0108.webp"]'::jsonb,
   true),

  ('kapitian-tandoori-house-cheras', 'Kapitian Tandoori House Cheras', 'Restaurant', 'Cheras', 'Malaysia',
   'Jalan Tasik Permaisuri 2, Taman Tasik Permaisuri, 56000 Cheras, Wilayah Persekutuan Kuala Lumpur',
   3.1024869, 101.7167354, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Kapitan%20Tandoori%20House.webp',
   '+60103804211', '07:00 – 00:00',
   'it features a cozy multi-level dining environment, unique mural artwork, and seating for up to 170 guests',
   '20 – 40 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kapitian%20Tandoori%20House/Screenshot%202026-08-11%20114431%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kapitian%20Tandoori%20House/Screenshot%202026-08-11%20114447%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Kapitian%20Tandoori%20House/Screenshot%202026-08-11%20114510%20(1).webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes (case-sensitive — stored verbatim).
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('kekwa-cafe-by-kekwa-delicacy',   'KCBKDM65'),
  ('warung-cikgu-bukit-puchong',     'WCBPM90'),
  ('wanis-shieldout-enterprise',     'WSPIM102'),
  ('restoran-chef-gemok',            'RCGM113'),
  ('kapitian-tandoori-house-cheras', 'KTHCM92')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
