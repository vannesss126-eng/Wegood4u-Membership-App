-- 2026-08-20: Add partner store Sedulang CitaRasa Kampung + referral code.
--
--   1 NEW store (Malaysia, Puchong): Sedulang CitaRasa Kampung — SCRKM157
--
-- Name stored in the brand's own casing (matches the menu-image folder
-- "Sedulang CitaRasa Kampung"); the source header was ALL-CAPS. country='Malaysia',
-- city='Puchong'. Price normalized to "N – N MYR". Code case-sensitive, verbatim.
-- Idempotent (ON CONFLICT).
--
-- VERIFY:
--   SELECT id, name, city, country FROM public.partner_stores WHERE id='sedulang-citarasa-kampung';
--   SELECT partner_store_id, code FROM public.store_referral_codes WHERE partner_store_id='sedulang-citarasa-kampung';

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "country", "address", "latitude", "longitude",
   "rating", "image", "phone", "hours", "description", "price_range", "days",
   "menu_images", "active")
VALUES
  ('sedulang-citarasa-kampung', 'Sedulang CitaRasa Kampung', 'Restaurant', 'Puchong', 'Malaysia',
   'No 5, Medan Selera Bukit Puchong, Jalan BP 3/11, Bandar Bukit Puchong, 47100 Puchong, Selangor',
   2.9892236, 101.6293639, 5.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/IMG_1593.webp',
   '+60147005177', '12:00 – 19:00',
   'It serves affordable, authentic village-style set meals (Nasi Dulang) alongside Thai-style hot dishes, noodles, and fried rice',
   '1 – 20 MYR', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Sedulang%20CitaRasa%20Kampung/WhatsApp%20Image%202026-08-19%20at%2011.53.10%20AM%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Sedulang%20CitaRasa%20Kampung/WhatsApp%20Image%202026-08-19%20at%2011.53.30%20AM%20(1).webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Sedulang%20CitaRasa%20Kampung/WhatsApp%20Image%202026-08-19%20at%2011.53.31%20AM%20(1).webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral code (case-sensitive — stored verbatim).
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('sedulang-citarasa-kampung', 'SCRKM157')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
