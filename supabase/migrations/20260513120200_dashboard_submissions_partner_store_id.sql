-- Partner Analytics Dashboard — Phase 1, Migration 3 of 7
--
-- Adds partner_store_id (text — Firestore doc id) to submissions so the
-- dashboard can attribute verified visits to a specific partner store.
--
-- Background: submissions.partner_store_name is free text today (users pick
-- from a fixed list, but it is not enforced at the DB level). Per project
-- decision 2026-05-13, names are clean enough for a deterministic backfill.
--
-- Important:
--   • Column added as NULLABLE first. Backfill runs as a separate one-off
--     (see drafts/_BACKFILL_PLAN.md). Once backfill is verified, a follow-up
--     migration in a future Phase can flip this NOT NULL once the mobile app
--     starts writing partner_store_id directly on insert.
--   • partner_store_id is a Firestore doc id — text, NO foreign key (same
--     pattern as user_favorite_stores and partner_accounts).
--   • An RLS policy is added so partners can read their own store's
--     submissions. Existing user-scoped and admin policies on submissions
--     are NOT touched.
--   • Critical: anonymisation. Partners read submissions for their store but
--     must NOT see customer PII. Section 6.4 of the dashboard spec calls for
--     a view layer (e.g. partner_visits_view) that strips PII before the
--     dashboard queries it. That view is created in a later migration after
--     all dashboard tables are in place; until then, the RLS policy is fine
--     for backend testing only — DO NOT expose the raw submissions table to
--     partners in the UI.

BEGIN;

ALTER TABLE "public"."submissions"
  ADD COLUMN IF NOT EXISTS "partner_store_id" "text";

COMMENT ON COLUMN "public"."submissions"."partner_store_id" IS
  'Firestore partner_store doc id. NULL for legacy rows pre-backfill. No FK — Firestore lives outside Supabase.';

CREATE INDEX IF NOT EXISTS "submissions_partner_store_id_idx"
  ON "public"."submissions" ("partner_store_id") WHERE "partner_store_id" IS NOT NULL;

-- Composite index for the dashboard's hottest query: visits for a given
-- store, newest first, optionally filtered by status.
CREATE INDEX IF NOT EXISTS "submissions_store_status_created_idx"
  ON "public"."submissions" ("partner_store_id", "status", "created_at" DESC)
  WHERE "partner_store_id" IS NOT NULL;


-- ============================================================
-- RLS — partners read submissions for their own store(s)
-- ============================================================

-- Note: existing user/admin policies on submissions are untouched.

DROP POLICY IF EXISTS "partners read submissions for their store"
  ON "public"."submissions";
CREATE POLICY "partners read submissions for their store"
  ON "public"."submissions" FOR SELECT TO "authenticated"
  USING (
    "partner_store_id" IS NOT NULL
    AND "public"."is_partner_for_store"("partner_store_id")
  );

COMMIT;
