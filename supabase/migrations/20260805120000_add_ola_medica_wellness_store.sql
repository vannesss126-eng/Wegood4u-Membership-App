

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "country", "address", "latitude", "longitude",
   "rating", "image", "phone", "hours", "description", "price_range", "days",
   "menu_images", "active")
VALUES
  ('ola-medica', 'Ola Medica', 'Wellness', 'Chiang Mai', 'Thailand',
   '8 หมู่ 6 Nong Pa Khrang, Mueang Chiang Mai District, Chiang Mai 50000, Thailand',
   18.785775, 99.0290047, 5.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Ola%20Medica.webp',
   '+66979241524', '09:00 – 18:00',
   'Ola Medica is a health prevention and rehabilitation center located in Chiang Mai, Thailand, situated along the Chiang Mai-Lampang Superhighway near Makro.',
   NULL, 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Ola%20Medica/743050534_122117639882884632_753856561529721301_n.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Ola%20Medica/760671422_122120426300884632_5239592655596347765_n.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Ola%20Medica/763120056_122120608166884632_4011140123129269835_n.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral code.
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('ola-medica', 'OLAMC78')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";


-- Backfill: the 2026-08-01 Chiang Mai batch (20260801120000) inserted 7 stores
-- without `country`, despite 20260730120000 requiring future seeds to set it.
-- Those rows currently fall into the "Other" group in the submission store
-- picker and the map's country filter. All 7 are Chiang Mai, Thailand.
UPDATE public.partner_stores
SET country = 'Thailand'
WHERE country IS NULL
  AND city = 'Chiang Mai';

-- Safety net matching 20260730120000: anything still unmapped is separated by
-- latitude (Thailand ≈ 18.8°N vs the Klang Valley ≈ 3°N).
UPDATE public.partner_stores
SET country = CASE WHEN latitude >= 8 THEN 'Thailand' ELSE 'Malaysia' END
WHERE country IS NULL
  AND latitude IS NOT NULL;
