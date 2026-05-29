-- Partner Analytics Dashboard — Phase 2 (Full-Supabase migration), Migration 3 of 3
--
-- post_snapshots: daily history of per-post stats. Replaces the Firestore
-- subcollection design from the original API doc. The parent/child table
-- pattern is strictly more powerful for analytics — enables cross-post
-- queries via window functions, JOINs to partner_stores, etc.
--
-- Locked 2026-05-18.
--
-- Design notes:
--   • Composite key (post_id, snapshot_date). One row per post per day.
--   • Counters are cumulative lifetime totals from the platform APIs.
--     Day-over-day deltas computed via LAG() in views/queries.
--   • 90-day rolling retention: cleanup function runs after each daily
--     write, deleting snapshots older than 90 days. See the cleanup_rpc
--     migration (drafted separately when polling Edge Function lands).
--   • RLS scoped via the parent post's partner_store_id.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."post_snapshots" (
    "post_id" bigint NOT NULL
      REFERENCES "public"."all_social_posts"("id") ON DELETE CASCADE,
    "snapshot_date" date NOT NULL,
    "views" bigint NOT NULL DEFAULT 0,
    "likes" bigint NOT NULL DEFAULT 0,
    "captured_at" timestamptz NOT NULL DEFAULT now(),
    "raw_response" jsonb,
    CONSTRAINT "post_snapshots_pkey" PRIMARY KEY ("post_id", "snapshot_date")
);

ALTER TABLE "public"."post_snapshots" OWNER TO "postgres";

COMMENT ON TABLE "public"."post_snapshots" IS
  'Daily per-post stats snapshot. 90-day rolling retention. Counters are cumulative; compute deltas via LAG() in queries.';

COMMENT ON COLUMN "public"."post_snapshots"."raw_response" IS
  'Optional raw JSON from the platform API for forensic debugging. Never expose to partners.';

CREATE INDEX IF NOT EXISTS "post_snapshots_date_idx"
  ON "public"."post_snapshots" ("snapshot_date" DESC);


-- ============================================================
-- RLS — scope via parent post
-- ============================================================

ALTER TABLE "public"."post_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read their post snapshots" ON "public"."post_snapshots";
CREATE POLICY "partners read their post snapshots"
  ON "public"."post_snapshots" FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."all_social_posts" p
      WHERE p."id" = "post_snapshots"."post_id"
        AND p."partner_store_id" IS NOT NULL
        AND "public"."is_partner_for_store"(p."partner_store_id")
    )
  );

DROP POLICY IF EXISTS "admins read all post snapshots" ON "public"."post_snapshots";
CREATE POLICY "admins read all post snapshots"
  ON "public"."post_snapshots" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write post snapshots" ON "public"."post_snapshots";
CREATE POLICY "admins write post snapshots"
  ON "public"."post_snapshots" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));

COMMIT;
