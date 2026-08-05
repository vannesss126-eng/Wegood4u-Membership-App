-- 2026-08-01: Batch add Chiang Mai partner stores + referral codes.
--
--   7 NEW stores : OB - Out of Bounds, colxlab, Your Father CNX, Claro Nimman,
--                  Lobbyist Bar, Take a Break, ๗โมง | 7Mohng.
--   2 EXISTING   : THE HOUSE by Ginger (eVazVXjqbJdghkhImLT6) — change type to
--                  'Bar'; Gladwell Cocktail Bar (3L3s8zNFm3mqZDjnO1y9) — data
--                  left as-is. Both only get a referral code attached below.
--
-- All rows are Chiang Mai (city column filled). Price ranges normalized to the
-- existing "N – N THB" display format. Types stored title-case (Bar/Cafe/
-- Restaurant); detection is case-insensitive.
--
-- Codes are case-sensitive — stored EXACTLY as provided.
--
-- Idempotent: new stores ON CONFLICT (id) DO NOTHING; type change is a targeted
-- UPDATE; codes ON CONFLICT (partner_store_id) DO UPDATE.
--
-- VERIFY:
--   SELECT id, name, type, city FROM public.partner_stores
--     WHERE id IN ('ob-out-of-bounds','colxlab','your-father-cnx','claro-nimman',
--                  'lobbyist-bar','take-a-break','7mohng',
--                  'eVazVXjqbJdghkhImLT6','3L3s8zNFm3mqZDjnO1y9');

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('ob-out-of-bounds', 'OB - Out of Bounds', 'Restaurant', 'Chiang Mai',
   '20, Si Phum, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.8016649, 98.9813961, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/OB%20-%20Out%20of%20Bounds.webp',
   '+66811822240', '11:00 – 00:00',
   'OB - Out of Bounds is a trendy bar, diner, and social hangout spot in Chiang Mai. It features a cool, converted old building design with cozy indoor and outdoor zones.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/OB%20-%20Out%20of%20Bounds/Screenshot%202026-07-30%20153938.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/OB%20-%20Out%20of%20Bounds/Screenshot%202026-07-30%20154326.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/OB%20-%20Out%20of%20Bounds/Screenshot%202026-07-30%20154453.webp"]'::jsonb,
   true),

  ('colxlab', 'colxlab', 'Bar', 'Chiang Mai',
   '54, 54/1 Sridonchai Rd, Tambon Chang Khlan, Mueang Chiang Mai District, Chiang Mai 50100, Thailand',
   18.7809974, 98.9974814, 4.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/colxlab.webp',
   '+66624654569', '17:00 – 00:00',
   'colxlab is a popular chill craft beer bar and hangout spot in Chiang Mai featuring 12 rotating tap beers, over 50 canned craft beer selections, and live DJ music sessions.',
   '400 – 600 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/colxlab/Screenshot%202026-07-30%20163449.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/colxlab/Screenshot%202026-07-30%20163508.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/colxlab/Screenshot%202026-07-30%20163531.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/colxlab/Screenshot%202026-07-30%20163704.webp"]'::jsonb,
   true),

  ('your-father-cnx', 'Your Father CNX', 'Cafe', 'Chiang Mai',
   '99 6 ถนนเลียบคันคลองชลประทาน หมู่ที่ 5 Suthep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.7765483, 98.9537035, 5.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/colxlab.webp',
   '+66624654569', '17:30 – 00:00',
   'Your Father CNX is a cozy music cafe and chill-out bar in Chiang Mai, Thailand, featuring retro playlists, affordable food, and a relaxed vibe near Chiang Mai University.',
   '400 – 600 THB', 'Mon – Sun',
   '[]'::jsonb,
   true),

  ('claro-nimman', 'Claro Nimman', 'Bar', 'Chiang Mai',
   '13 Nimmana Haeminda Rd Lane 7 Nimmanhaemin Suthep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.8007306, 98.964477, 4.6,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Claro%20Nimman.webp',
   '+66989414619', '19:00 – 00:00',
   'Claro Nimman is a vibrant and popular nightlife spot located on Nimmanhaemin Road (Soi 7) in Chiang Mai, Thailand.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Claro%20Nimman/Screenshot%202026-07-31%20103302.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Claro%20Nimman/Screenshot%202026-07-31%20103341.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Claro%20Nimman/Screenshot%202026-07-31%20103404.webp"]'::jsonb,
   true),

  ('lobbyist-bar', 'Lobbyist Bar', 'Bar', 'Chiang Mai',
   '1st floor, Nimman Mai Design Hotel, Nimmanhaemin Suthep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.7993003, 98.9653115, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Lobbyist%20Bar.webp',
   '+6653400567', '15:00 – 00:00',
   'Lobbyist Bar is a moody, intimate hidden speakeasy tucked inside the Nimman Mai Design Hotel in the Nimman area of Chiang Mai.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Lobbyist%20Bar/Lobbyist%20Bar%20-%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Lobbyist%20Bar/Lobbyist%20Bar%20-%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Lobbyist%20Bar/Lobbyist%20Bar%20-%204.webp"]'::jsonb,
   true),

  ('take-a-break', 'Take a Break', 'Cafe', 'Chiang Mai',
   '124,126 128 ถนน เจริญราษฎร์ Wat Ket, Mueang Chiang Mai District, Chiang Mai 50000, Thailand',
   18.7922621, 99.0023922, 4.6,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Take%20a%20Break%20.webp',
   '+66808019999', '07:00 – 17:00',
   'Take a Break is a cozy, two-story wooden cafe near the Ping River and Wat Ket, offering all-day breakfast, good coffee, and home-style comfort food at low prices.',
   '200 – 400 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Take%20a%20break/Take%20a%20Break%20-%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Take%20a%20break/Take%20a%20Break%20-%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Take%20a%20break/Take%20a%20Break%20-%204.webp"]'::jsonb,
   true),

  ('7mohng', '๗โมง | 7Mohng', 'Restaurant', 'Chiang Mai',
   '142 Ban Phae Rd, Chang Phueak, Mueang Chiang Mai District, Chiang Mai 50300, Thailand',
   18.8149162, 98.9712717, 3.7,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/7Mohng%20.webp',
   '+66986956991', '07:00 – 16:00',
   '๗โมง | 7Mohng is a popular garden-style breakfast cafe and restaurant.',
   '1 – 200 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/7Mohng/7Mohng%20-%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/7Mohng/7Mohng%20-%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/7Mohng/7Mohng%20-%204.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- THE HOUSE by Ginger already exists — change its type Restaurant -> Bar per request.
UPDATE public.partner_stores
SET type = 'Bar'
WHERE id = 'eVazVXjqbJdghkhImLT6';


-- Per-outlet referral codes: 7 new stores + the 2 existing ones.
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('ob-out-of-bounds',     'OOBC20'),
  ('colxlab',              'COLAXLABC26'),
  ('your-father-cnx',      'YRFCNXC28'),
  ('claro-nimman',         'CLARONC30'),
  ('lobbyist-bar',         'LOBBYBARC39'),
  ('take-a-break',         'TABKC40'),
  ('7mohng',               'MOHNGC47'),
  ('eVazVXjqbJdghkhImLT6', 'THBGC56'),
  ('3L3s8zNFm3mqZDjnO1y9', 'GCBC29')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
