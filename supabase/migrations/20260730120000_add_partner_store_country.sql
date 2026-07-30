-- Add a `country` dimension to partner_stores so the app can present a
-- Country ▸ City ▸ Store hierarchy in the submission store picker and the map
-- filter (previously both grouped by city only).
--
-- Backfill uses the verified city→country mapping as of 2026-07-30 — 108 active
-- stores across 6 cities:
--   Thailand : Chiang Mai (Nimman is stored under city = 'Chiang Mai')
--   Malaysia : Kuala Lumpur, Klang, Petaling Jaya, Puchong, Semenyih
--
-- The column is left NULLABLE: the app buckets any NULL/unmapped country under
-- an "Other" group so a missing value can never break the picker. Future seed
-- migrations that INSERT partner_stores should set `country` explicitly.

ALTER TABLE public.partner_stores
  ADD COLUMN IF NOT EXISTS country text;

-- Explicit city → country backfill (source of truth).
UPDATE public.partner_stores
SET country = 'Thailand'
WHERE country IS NULL
  AND city = 'Chiang Mai';

UPDATE public.partner_stores
SET country = 'Malaysia'
WHERE country IS NULL
  AND city IN ('Kuala Lumpur', 'Klang', 'Petaling Jaya', 'Puchong', 'Semenyih');

-- Safety net for any store whose city was added between writing and running this
-- migration: infer from latitude. Thailand sits far north of Malaysia
-- (Chiang Mai ≈ 18.8°N vs the Klang Valley ≈ 3°N), so 8°N cleanly separates them.
UPDATE public.partner_stores
SET country = CASE WHEN latitude >= 8 THEN 'Thailand' ELSE 'Malaysia' END
WHERE country IS NULL
  AND latitude IS NOT NULL;
