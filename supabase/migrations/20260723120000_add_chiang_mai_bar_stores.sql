INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('mellowship-jazz-club', 'The Mellowship Jazz Club', 'Bar', 'Chiang Mai',
   '231/12 1004, Tambon Chang Phueak, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
   18.80573, 98.9601257, 4.6,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/The%20Mellowship%20Jazz%20Club/The%20Mellowship%20Jazz%20Club%20-%201.webp',
   '+6653908888', '17:00 – 00:00',
   'The modern jazz bar sits somewhere between cosy neighbourhood spot and proper music venue – great cocktails, a relaxed atmosphere and live performances every night of the week.',
   '200 – 400 THB', 'Tues – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/The%20Mellowship%20Jazz%20Clubolder/The%20Mellowship%20Jazz%20Club%20-%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/The%20Mellowship%20Jazz%20Clubolder/The%20Mellowship%20Jazz%20Club%20-%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/The%20Mellowship%20Jazz%20Clubolder/The%20Mellowship%20Jazz%20Club%20-%204.webp"]'::jsonb,
   true),

  ('bar-foucault', 'Bar Foucault', 'Bar', 'Chiang Mai',
   '19 Chomdoi Rd Nimmanhaemin Suthep, Muang Chiang Mai 50200, Thailand',
   18.8017519, 98.9631746, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Bar%20Foucault/Bar%20Foucalt%20-%201.webp',
   '+6653908888', '07:00 – 00:00',
   'An elusive, hidden cocktail bar in Chiang Mai, Thailand, tucked behind an unmarked slab of cement on Chomdoi Road.',
   '400 – 1000 THB', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Bar%20Foucault/Bar%20Foucalt%20-%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Bar%20Foucault/Bar%20Foucalt%20-%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Bar%20Foucault/Bar%20Foucalt%20-%204.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes for the 2 new bars.
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('mellowship-jazz-club', 'TMJCC18'),
  ('bar-foucault',         'BARFC16')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
