-- 2026-08-20: Fix two partner-store images that pointed at missing/placeholder files.
--
--   Sedulang CitaRasa Kampung: was IMG_1593.webp (HTTP 400 — never uploaded, so the
--     app showed a blank image) -> Sedulang CitaRasa Kampung.webp (verified 200).
--   EG's Wok Kitchen: set to Eg's Wok Kitchen.webp (verified 200) — the file the
--     coworker intended; the earlier MVIMG_… URL did not exist. Apostrophe is
--     URL-encoded (%27) so the stored URL needs no SQL escaping.
--
-- VERIFY:
--   SELECT id, image FROM public.partner_stores
--     WHERE id IN ('sedulang-citarasa-kampung','egs-wok-kitchen');

UPDATE public.partner_stores
SET image = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Sedulang%20CitaRasa%20Kampung.webp'
WHERE id = 'sedulang-citarasa-kampung';

UPDATE public.partner_stores
SET image = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Eg%27s%20Wok%20Kitchen.webp'
WHERE id = 'egs-wok-kitchen';
