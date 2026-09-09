-- 20260903150000_backfill_store_currency_by_country.sql
--
-- Set every partner store's display currency from its COUNTRY (the store's physical
-- location), so the Vendors app shows ฿ for Thailand stores and RM for Malaysia
-- stores automatically — no manual per-store toggle.
--
-- Why country, not the AI-detected receipt currency:
--   submissions.currency (set by the AI review) is too noisy to key off — Chiang Mai
--   receipts are sometimes mis-read as MYR (e.g. Dipsy Bar, Rob's Berry), there's a
--   stray USD, and ~45 nulls. A single mis-read flips a low-volume store's currency.
--   The store's own city is the reliable country signal: in this project every store
--   is in Malaysia except the Chiang Mai (Thailand) ones (91 of them).
--
-- Idempotent: pure UPDATE by city; safe to re-run. Covers the 6 seeded stores too.
--
-- VERIFY:
--   select currency, count(*) from public.partner_stores group by 1;   -- ~91 THB, rest MYR
--   select name, city, currency from public.partner_stores
--    where name in ('Dipsy Bar','Forest Bake','Fatt Kee Roast Fish');  -- THB, THB, MYR

begin;

update public.partner_stores
   set currency = case
         when lower(btrim(city)) in (
           'chiang mai','chiang rai','bangkok','phuket','pattaya','nonthaburi',
           'lampang','krabi','chonburi','ayutthaya','hua hin','samut prakan',
           'khon kaen','udon thani','surat thani'
         ) then 'THB'
         else 'MYR'
       end,
       updated_at = now()
 where currency is distinct from (
         case when lower(btrim(city)) in (
           'chiang mai','chiang rai','bangkok','phuket','pattaya','nonthaburi',
           'lampang','krabi','chonburi','ayutthaya','hua hin','samut prakan',
           'khon kaen','udon thani','surat thani'
         ) then 'THB' else 'MYR' end
       );

commit;
