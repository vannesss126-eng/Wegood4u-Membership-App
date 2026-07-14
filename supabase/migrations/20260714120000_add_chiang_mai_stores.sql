-- Add 2 new partner stores in Chiang Mai, Thailand (2026-07-14):
--   Mai Heun 60  — Lanna teak-house café & restaurant, Mae Rim
--   Akathip Chokdee — café & restaurant, Mueang Chiang Mai
--
-- Each is a SEPARATE partner_stores row. type = 'Café & Restaurant' → maps to the
-- Restaurant category. No per-outlet referral codes were supplied, so none are seeded.
--
-- NOTE: the Akathip Chokdee description below is a verbatim copy of the Mai Heun 60
-- description supplied in the source data (it mentions Mae Rim + the 60-year-old Lanna
-- teak house, which is Mai Heun 60, not Akathip Chokdee). Update once the real copy is
-- available: UPDATE public.partner_stores SET description = '…' WHERE id = 'akathip-chokdee';
--
-- VERIFY FIRST: SELECT id, name FROM public.partner_stores
--               WHERE name ILIKE 'Mai Heun%' OR name ILIKE 'Akathip%';
-- Fixed slug ids + ON CONFLICT (id) DO NOTHING → won't overwrite a differently-keyed row.

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('mai-heun-60', 'Mai Heun 60', 'Café & Restaurant', 'Chiang Mai',
   '204 Moo 1, San Pong Subdistrict, Mae Rim District, Chiang Mai 50180',
   18.9386851, 98.940453, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Mai%20Heun%2060.webp',
   '+6653297858', '07:00 – 17:30',
   'is a charming café and restaurant in Mae Rim, Chiang Mai, offering an authentic Northern Thai dining experience surrounded by lush tropical gardens. Set within a beautifully preserved 60-year-old traditional Lanna teak house, the venue combines rich local heritage with a peaceful, nature-inspired atmosphere.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Mai%20Heun%2060/Screenshot%202026-07-13%20162705.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Mai%20Heun%2060/Screenshot%202026-07-13%20162731.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Mai%20Heun%2060/Screenshot%202026-07-13%20162800.webp"]'::jsonb,
   true),

  ('akathip-chokdee', 'Akathip Chokdee', 'Café & Restaurant', 'Chiang Mai',
   '14/22 Moo 2, Telecommunications Road, Mueang Chiang Mai District, Chiang Mai 50300',
   18.8073667, 98.9634261, 4.5,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Akathip%20Chokdee.webp',
   '+66972370903', '10:00 – 21:00',
   'is a charming café and restaurant in Mae Rim, Chiang Mai, offering an authentic Northern Thai dining experience surrounded by lush tropical gardens. Set within a beautifully preserved 60-year-old traditional Lanna teak house, the venue combines rich local heritage with a peaceful, nature-inspired atmosphere.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Akathip%20Chokdee/1mi52224x963zek7c8A2B.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;
