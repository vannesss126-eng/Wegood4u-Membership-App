-- 2026-08-20: Update partner_stores.image for stores whose photo was missing/blank.
--
--   JMC Jaimascus              -> JMC Jaimascus.webp
--   Warung Cikgu Bukit Puchong -> Warung Cikgu Bukit Puchong.webp
--   Iqan Bakar                 -> IQAN BAKAR.webp
--
-- All 3 new image URLs were verified to return HTTP 200 before writing.
--
-- HELD — EG's Wok Kitchen (egs-wok-kitchen): the URL the coworker supplied
-- (partner-store-images/MVIMG_20260806_152219_11zon (1).webp) returns HTTP 400 —
-- that object does not exist in the bucket. A file "Eg's Wok Kitchen.webp" IS in
-- the bucket (resolves 200) and is the likely intended image, but not applied
-- here pending confirmation.
--
-- VERIFY:
--   SELECT id, image FROM public.partner_stores
--     WHERE id IN ('jmc-jaimascus','warung-cikgu-bukit-puchong','iqan-bakar');

UPDATE public.partner_stores
SET image = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/JMC%20Jaimascus.webp'
WHERE id = 'jmc-jaimascus';

UPDATE public.partner_stores
SET image = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Warung%20Cikgu%20Bukit%20Puchong.webp'
WHERE id = 'warung-cikgu-bukit-puchong';

UPDATE public.partner_stores
SET image = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/IQAN%20BAKAR.webp'
WHERE id = 'iqan-bakar';
