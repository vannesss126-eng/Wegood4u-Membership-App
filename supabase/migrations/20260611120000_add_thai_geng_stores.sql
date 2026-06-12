-- Add the 8 Thai Geng Mookata buffet outlets + seed their per-outlet referral codes.
--
-- Data supplied by Shi En/coworker (2026-06-11). Each is a SEPARATE partner_stores row
-- (per-outlet performance tracking). type = 'Buffet' → maps to the Restaurant category
-- (mapStoreCategory + the restaurant browse filter both treat "buffet" as restaurant).
-- The buffet behaviour (diner cap + 100-star bonus) is switched on by is_buffet, set in
-- the companion reward migration that runs right after this one.
--
-- Bayu Tinggi postal code: using 42000 (per the receipts), not the 41200 in the doc.
--
-- VERIFY FIRST: SELECT id, name FROM public.partner_stores WHERE name ILIKE 'Thai Geng%';
-- If rows already exist under different ids, reconcile before running (this uses fixed
-- slug ids and ON CONFLICT (id) DO NOTHING, so it won't overwrite a differently-keyed row).

INSERT INTO "public"."partner_stores"
  ("id", "name", "type", "city", "address", "latitude", "longitude", "rating",
   "image", "phone", "hours", "description", "price_range", "days", "menu_images", "active")
VALUES
  ('tg-bukit-raja-klang', 'Thai Geng Mookata Bukit Raja Klang', 'Buffet', 'Klang',
   '6G, Jalan Rodat 2/KU5, Bandar Bukit Raja, 41050 Klang, Selangor',
   3.0864444, 101.4423578, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Bukit%20Raja.webp',
   '+6010-4269749', '12:00 – 03:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-bayu-tinggi-klang', 'Thai Geng Mookata Bayu Tinggi Klang', 'Buffet', 'Klang',
   '58, Lorong Sentosa 4, Taman Bayu Perdana, 42000 Klang, Selangor',
   3.0119797, 101.4306702, 5.0,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20Bayu%20Tinggi%20Klang.webp',
   '+60 17-582 5330', '12:00 – 03:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-puchong-kinrara', 'Thai Geng Mookata Puchong Kinrara', 'Buffet', 'Puchong',
   '8-G, Jalan BK 5A/2A, Bandar Kinrara, 47180 Puchong, Selangor',
   3.0475537, 101.6432096, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20Puchong%20Kinrara.webp',
   '+60 17-605 7874', '12:00 – 00:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-semenyih-ecohill', 'Thai Geng Mookata Semenyih Ecohill', 'Buffet', 'Semenyih',
   'No.2A-1 (Ground floor), Jalan Ecohill 1/5A, Setia Ecohill, 43500 Semenyih, Selangor',
   2.9260166, 101.8537086, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20Semenyih%20Ecohill.webp',
   '+60 11-6503 2808', '12:00 – 00:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-cheras-jln-lanchang', 'Thai Geng Mookata (Cheras Jln Lanchang)', 'Buffet', 'Kuala Lumpur',
   '177-G, Jln Lanchang, Taman Sri Bahtera, 56100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',
   3.1011169, 101.7363077, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20(Cheras%20Jln%20Lanchang).webp',
   '+60 11-2355 8956', '12:00 – 00:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-kepong', 'Thai Geng Mookata Kepong', 'Buffet', 'Kuala Lumpur',
   '10, Jln Metro Perdana Barat 3, Kepong, 52100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',
   3.2159767, 101.6407655, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20Kepong.webp',
   '+60 10-358 8692', 'Mon - Fri: 12:00 - 01:00 · Weekends: 12:00 - 02:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-bukit-jalil', 'Thai Geng Mookata Bukit Jalil', 'Buffet', 'Kuala Lumpur',
   '9-8-G Jalan Jalil Perkasa 15, Arked Esplanad, Bukit Jalil, 57000 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',
   3.0611842, 101.6764627, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Mookata%20%20Bukit%20Jalil.webp',
   '+60 17-936 0138', 'Mon - Fri: 12:00 - 01:00 · Weekends: 12:00 - 02:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 20 - RM 40', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20all%20store/Thai%20Geng%203.webp"]'::jsonb,
   true),

  ('tg-signature-ss2', 'Thai Geng Signature Mookata Buffet SS2', 'Buffet', 'Petaling Jaya',
   '28, Jalan SS 2/66, SS 2, 47300 Petaling Jaya, Selangor',
   3.1191279, 101.6202623, 4.9,
   'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Thai%20Geng%20Signature%20Mookata%20Buffet%20SS2.webp',
   '+6010-658 8098', '12:00 - 01:00',
   'a highly popular, family-friendly Thai steamboat and BBQ (Mookata) buffet chain across the Klang Valley. It features fresh ingredients, traditional charcoal broth, and unlimited refills with a 120-minute dining limit',
   'RM 40 - RM 60', 'Mon – Sun',
   '["https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20SS2/Thai%20Geng%201.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20SS2/Thai%20Geng%202.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20SS2/Thai%20Geng%203.webp","https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-menu/Thai%20Geng%20SS2/Thai%20Geng%204.webp"]'::jsonb,
   true)
ON CONFLICT ("id") DO NOTHING;


-- Per-outlet referral codes (codes per the docs — the TGM… set, NOT the THGeng… set
-- Christine listed earlier; confirm with her which is printed on the QR).
INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('tg-bukit-raja-klang',    'TGMBRK1'),
  ('tg-bayu-tinggi-klang',   'TGMBTK2'),
  ('tg-puchong-kinrara',     'TGMPK3'),
  ('tg-semenyih-ecohill',    'TGMSE4'),
  ('tg-cheras-jln-lanchang', 'TGMCJL5'),
  ('tg-kepong',              'TGMKP6'),
  ('tg-bukit-jalil',         'TGMBJ7'),
  ('tg-signature-ss2',       'TGSMBSS28')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";
