-- OPTIONAL backfill — link historical submissions to their partner store by exact
-- name match. NOT required for the buffet features: those only need NEW submissions
-- to carry partner_store_id (now set by the app). This just lets future per-outlet
-- analytics include pre-existing rows. Push it only if you want that historical link.
--
-- Safety:
--   * IS NULL guard skips already-linked rows.
--   * Only links names that map to EXACTLY ONE store (HAVING count = 1), so an
--     ambiguous duplicate name is left untouched rather than linked arbitrarily.
--   * partner_stores.id is the PK (indexed); submissions is modest in size. If it
--     ever grows large, batch this instead.

UPDATE "public"."submissions" s
SET "partner_store_id" = m."id"
FROM (
  SELECT "name", min("id") AS "id"
  FROM "public"."partner_stores"
  GROUP BY "name"
  HAVING count(*) = 1
) m
WHERE s."partner_store_id" IS NULL
  AND s."partner_store_name" = m."name";
