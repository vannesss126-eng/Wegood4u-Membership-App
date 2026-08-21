-- 2026-08-11: Batch add Klang Valley partner stores + referral codes.
--
--   4 NEW stores (all Malaysia):
--     Taste Avenue          (Ampang, Selangor)        — TASAVM76
--     Eg's Wok Kitchen      (Ampang, Selangor)        — EGWKM88
--     CRG Chicken Rice Guys (Shah Alam, Selangor)     — CRGCRM45
--     Nippon Syokudo        (Kuala Lumpur / Taman Desa) — NIPPONSM82
--
-- `country` is set on every row (required since 20260730120000 — a NULL country
-- drops the store into the "Other" group in the picker + map country filter).
-- Nippon Syokudo sits in Taman Desa, a KL neighbourhood; per the existing
-- convention (Cheras / Kepong / Bukit Jalil all stored as 'Kuala Lumpur') its
-- city is 'Kuala Lumpur'.
--
-- Price ranges normalized to the existing "N – N MYR" display format. Types
-- stored title-case (Restaurant); detection is case-insensitive.
--
-- Codes are case-sensitive — stored EXACTLY as provided.
--
-- Idempotent: new stores ON CONFLICT (id) DO NOTHING; codes ON CONFLICT
-- (partner_store_id) DO UPDATE.
--
-- VERIFY:
--   SELECT id, name, type, city, country FROM public.partner_stores
--     WHERE id IN ('taste-avenue','egs-wok-kitchen','crg-chicken-rice-guys','nippon-syokudo');
--   SELECT partner_store_id, code FROM public.store_referral_codes
--     WHERE partner_store_id IN ('taste-avenue','egs-wok-kitchen','crg-chicken-rice-guys','nippon-syokudo');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "country", "address", "latitude", "longitude",
   "rating", "image", "phone", "hours", "description", "price_range", "days",
   "menu_images", "active")
VALUES
  ('taste-avenue', 'Taste Avenue', 'Restaurant', 'Ampang', 'Malaysia',
   'Dataran KOLEJAS, Lot19A, Jalan Lembah Jaya Selatan, Taman Seri Intan, 68000 Ampang, Selangor',
   3.1394175, 101.7790189, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Taste%20Avenue.webp',
   '+601164109506', '12:00 – 21:30',
   'It specializes in comforting, slow-cooked meat dishes, Western fast food, and Middle Eastern or Pakistani-inspired',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Taste%20Avenue/WhatsApp%20Image%202026-08-06%20at%205.39.05%20PM%20(3).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Taste%20Avenue/WhatsApp%20Image%202026-08-06%20at%205.39.05%20PM%20(4).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Taste%20Avenue/WhatsApp%20Image%202026-08-06%20at%205.39.05%20PM.webp"]'::jsonb,
   true),

  ('egs-wok-kitchen', 'Eg''s Wok Kitchen', 'Restaurant', 'Ampang', 'Malaysia',
   'The Campus Ampang, Jalan Kerja Air Lama, Ukay Heights, 68000 Ampang, Selangor',
   3.1615587, 101.7562299, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/WhatsApp%20Image%202026-08-10%20at%202.55.12%20PM.webp',
   '+60164193786', '10:00 – 22:00',
   'is a Muslim-owned, fast-casual restaurant offering build-your-own wok-fried dishes, rice bowls, and UK-style sandwiches',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/EG''swok%20Kitchen/MVIMG_20260806_152145_11zon.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/EG''swok%20Kitchen/MVIMG_20260806_152151_11zon.webp"]'::jsonb,
   true),

  ('crg-chicken-rice-guys', 'CRG Chicken Rice Guys', 'Restaurant', 'Shah Alam', 'Malaysia',
   '40, Jalan Zirkon 7f/F, Seksyen 7, 40000 Shah Alam, Selangor',
   3.0753898, 101.4959068, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/CRG%20Chicken%20Rice%20Guys.webp',
   '+60133781950', '08:00 – 19:00',
   'It specializes in authentic, traditional Chinese-style halal chicken rice, roast duck, and local comfort foods at affordable prices',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/CRG%20Chicken%20Rice%20Guys/CRG%20Chicken%20Rice%20menu%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/CRG%20Chicken%20Rice%20Guys/CRG%20menu%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/CRG%20Chicken%20Rice%20Guys/CRG%20menu%203.webp"]'::jsonb,
   true),

  ('nippon-syokudo', 'Nippon Syokudo', 'Restaurant', 'Kuala Lumpur', 'Malaysia',
   'First Floor, 6, Jalan 1/109e, Taman Desa Business Park, 58100 Kuala Lumpur, Federal Territory of Kuala Lumpur',
   3.1022873, 101.6954442, 4.4,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Nippon%20Syukudo.webp',
   '+60103901510', '11:30 – 21:00',
   'It offers a casual, home-style dining experience featuring comfort foods like chahan (fried rice), takoyaki, wagyu beef bowls, curry rice, and sukiyaki hotpots',
   '20 – 40 MYR', 'Mon, Wed – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nippon%20Syokudo/DSC02722_11zon.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nippon%20Syokudo/DSC02726_11zon.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Nippon%20Syokudo/DSC02731_11zon.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes (case-sensitive — stored verbatim).
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('taste-avenue',          'TASAVM76'),
  ('egs-wok-kitchen',       'EGWKM88'),
  ('crg-chicken-rice-guys', 'CRGCRM45'),
  ('nippon-syokudo',        'NIPPONSM82')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
