-- 20260903160000_seed_store_fee_tiers.sql
--
-- Give the 6 seeded test stores three distinct per-visit fees — 3 / 5 / 8 — one of
-- each per country, so the different plan tiers are clearly visible in the Vendors
-- app. The app derives the plan label from this fee (3 → Starter, 5 → Growth,
-- 8 → Premium), so setting the fee also sets the tier.
--
--   Malaysia:  Mee Rebus Haji Wajid = 3   Fatt Kee Roast Fish = 5   Sunsan Bake = 8
--   Thailand:  Kanom Jeen San Pa Khoi = 3  Forest Bake = 5           Ohkajhu Sansai = 8
--
-- VERIFY: select partner_store_id, per_visit_fee from public.partner_store_settings
--          where partner_store_id in ('mee-rebus-haji-wajid','fatt-kee-roast-fish',
--          'sunsan-bake','kanom-jeen-san-pa-khoi','forest-bake','ohkajhu-sansai');

begin;

update public.partner_store_settings set per_visit_fee = 3.00, updated_at = now()
 where partner_store_id in ('mee-rebus-haji-wajid', 'kanom-jeen-san-pa-khoi');

update public.partner_store_settings set per_visit_fee = 5.00, updated_at = now()
 where partner_store_id in ('fatt-kee-roast-fish', 'forest-bake');

update public.partner_store_settings set per_visit_fee = 8.00, updated_at = now()
 where partner_store_id in ('sunsan-bake', 'ohkajhu-sansai');

commit;
