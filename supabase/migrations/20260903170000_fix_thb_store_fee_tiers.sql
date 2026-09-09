-- 20260903170000_fix_thb_store_fee_tiers.sql
--
-- The plan tiers are market-priced, not identical across currencies. The Malaysia
-- stores keep MYR 3 / 5 / 8 (set in 20260903160000); the THAILAND stores use the
-- THB pricing from the /partnership page: Starter 25, Growth 45, Premium 70.
--
--   Kanom Jeen San Pa Khoi = 25 (Starter)
--   Forest Bake            = 45 (Growth)
--   Ohkajhu Sansai         = 70 (Premium)
--
-- The Vendors app derives the plan label from the fee currency-aware (MYR 3/5/8,
-- THB 25/45/70), so these fees also drive the correct tier.
--
-- VERIFY: select partner_store_id, per_visit_fee from public.partner_store_settings
--          where partner_store_id in ('kanom-jeen-san-pa-khoi','forest-bake','ohkajhu-sansai');

begin;

update public.partner_store_settings set per_visit_fee = 25.00, updated_at = now()
 where partner_store_id = 'kanom-jeen-san-pa-khoi';

update public.partner_store_settings set per_visit_fee = 45.00, updated_at = now()
 where partner_store_id = 'forest-bake';

update public.partner_store_settings set per_visit_fee = 70.00, updated_at = now()
 where partner_store_id = 'ohkajhu-sansai';

commit;
