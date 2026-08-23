-- 2026-08-14: Batch 2 — the 3 Puchong stores held back from 20260814120000.
--
--   3 NEW stores (all Malaysia, Puchong):
--     Nasi Arab Tambah Kira  — NATKM31   (referral code fixed; was a duplicate of Kekwa's)
--     JMC Jaimascus          — JMCJM105
--     85 X Signature         — 85XSM116
--
-- COORDINATES: latitude/longitude are stored EXACTLY as provided by the store
-- owner / coworker (kept unchanged per request). Note all 3 currently share the
-- same value (3.1022873, 101.6954442); update later if the map pins need moving.
--
-- country='Malaysia', city='Puchong' on every row. Prices normalized to
-- "N – N MYR"; phone digits normalized. Non-contiguous days written faithfully
-- (Nasi Arab closed Fri; 85 X Signature closed Sun). Codes case-sensitive,
-- stored verbatim. Idempotent (ON CONFLICT).
--
-- VERIFY:
--   SELECT id, name, city, country, latitude, longitude FROM public.partner_stores
--     WHERE id IN ('nasi-arab-tambah-kira','jmc-jaimascus','85-x-signature');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "country", "address", "latitude", "longitude",
   "rating", "image", "phone", "hours", "description", "price_range", "days",
   "menu_images", "active")
VALUES
  ('nasi-arab-tambah-kira', 'Nasi Arab Tambah Kira', 'Restaurant', 'Puchong', 'Malaysia',
   'LMS 205, Lorong 2, Batu 13, Jln Klang, Kampung Tengah, 47100 Puchong, Selangor',
   3.1022873, 101.6954442, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Nasi%20Arab%20Tambah%20Kira.webp',
   '+601110626022', '10:30 – 18:00',
   'It serving local comfort foods like Wantan Mee Kicap Ipoh, Nasi Ayam Penyet, and Ayam Goreng Kriuk',
   '1 – 20 MYR', 'Mon – Thu, Sat – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nasi%20Arab%20Tambah%20Kira/IMG-20260812-WA0086(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nasi%20Arab%20Tambah%20Kira/yrv25pyc2sl3qdiyqfo0.webp"]'::jsonb,
   true),

  ('jmc-jaimascus', 'JMC Jaimascus', 'Restaurant', 'Puchong', 'Malaysia',
   'Medan Selera, Jalan Merbuk, Bandar Puchong Jaya, 47100 Puchong, Selangor',
   3.1022873, 101.6954442, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/IMG_1488.webp',
   '+60133920912', '12:00 – 00:00',
   'serving affordable homemade burgers, wraps, and crispy fried chicken',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/JMC%20Jaimascus/WhatsApp%20Image%202026-08-14%20at%2012.53.04%20PM%20(1)%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/JMC%20Jaimascus/WhatsApp%20Image%202026-08-14%20at%2012.53.04%20PM%20(2).webp"]'::jsonb,
   true),

  ('85-x-signature', '85 X Signature', 'Restaurant', 'Puchong', 'Malaysia',
   'Gerai, 15, Jalan Indah 3, Taman Puchong Indah, 47150 Puchong, Selangor',
   3.1022873, 101.6954442, 5.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/85%20X%20SIGNATURE.webp',
   '+601156675468', '12:30 – 00:00',
   'a casual local eatery located at Medan Selera Upen, Taman Puchong Indah, Selangor, Malaysia. It serves hearty Western comfort food, specializing in affordable smash burgers, chicken chops, steaks, and pasta plates',
   '1 – 20 MYR', 'Mon – Sat',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/85%20X%20Signature/WhatsApp%20Image%202026-08-14%20at%2011.04.55%20AM%20(4).webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes (case-sensitive — stored verbatim).
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('nasi-arab-tambah-kira', 'NATKM31'),
  ('jmc-jaimascus',         'JMCJM105'),
  ('85-x-signature',        '85XSM116')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
