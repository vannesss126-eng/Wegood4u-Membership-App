-- Partner Analytics Dashboard — Phase 2, Post-Export Reconciliation
--
-- Change partner_stores.days from jsonb to text.
--
-- Locked 2026-05-18 — during the Firestore export verification step we
-- discovered the actual `days` values are plain display strings (e.g.
-- "Mon – Sun", "Tue – Sun", "Wed – Mon") rather than the JSON array
-- structure the original migration assumed. jsonb would reject every row
-- at import time; text is the correct type.
--
-- The table is empty at the time this runs (Firestore CSV import happens
-- AFTER this migration), so the type change is trivial — no USING clause,
-- no data to coerce.

BEGIN;

ALTER TABLE "public"."partner_stores" ALTER COLUMN "days" TYPE text;

COMMENT ON COLUMN "public"."partner_stores"."days" IS
  'Operating days as a display string, e.g. "Mon – Sun". Matches the Firestore source data shape.';

COMMIT;
