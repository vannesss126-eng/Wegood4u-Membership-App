-- 2026-08-20: Rename partner store display name (requested by partner).
--   'Akathip Chokdee' -> 'Ekathip Chokedee'
--
-- Display name only. The id/slug ('akathip-chokdee') is left unchanged on purpose:
-- it is the primary key the referral code (store_referral_codes) and the printed
-- QR archive folder key off, so renaming it would break attribution and the
-- existing QR. Only partner_stores.name changes.
--
-- VERIFY:
--   SELECT id, name FROM public.partner_stores WHERE id = 'akathip-chokdee';

UPDATE public.partner_stores
SET name = 'Ekathip Chokedee'
WHERE id = 'akathip-chokdee';
