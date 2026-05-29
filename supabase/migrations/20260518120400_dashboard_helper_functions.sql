-- Partner Analytics Dashboard — Phase 2 (Full-Supabase migration), Migration 5 of 5
--
-- Helper SQL functions used by the dashboard and the polling Edge Function.
-- Contributed during API-doc review 2026-05-18.
--
-- Functions:
--   • get_store_stats(text) — per-store rollup of views/likes/comments,
--     with platform breakdowns. Called by the dashboard's content tab.
--   • cleanup_old_snapshots() — deletes post_snapshots older than 90 days.
--     Called by the polling Edge Function after each daily write (NOT by
--     pg_cron directly; called as a final step inside the polling Function
--     so cleanup only runs after successful new writes).
--
-- Design notes:
--   • get_store_stats parameter is text (matching the partner_store_id type
--     used across the project). Returns a single row of aggregates.
--   • Counters are summed from current_* on all_social_posts where
--     curation_status = 'assigned' AND partner_store_id matches. Pending /
--     general / skipped posts are excluded from per-store totals.
--   • cleanup_old_snapshots() returns the count of deleted rows for
--     observability — the polling Function logs this.

BEGIN;

-- ============================================================
-- get_store_stats(partner_store_id) — per-store aggregate rollup
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."get_store_stats"(_partner_store_id "text")
RETURNS TABLE (
    "total_posts" bigint,
    "total_views" bigint,
    "total_likes" bigint,
    "youtube_views" bigint,
    "instagram_views" bigint,
    "tiktok_views" bigint,
    "facebook_views" bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total_posts,
    COALESCE(sum("current_views"), 0)::bigint AS total_views,
    COALESCE(sum("current_likes"), 0)::bigint AS total_likes,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'youtube'), 0)::bigint AS youtube_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'instagram'), 0)::bigint AS instagram_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'tiktok'), 0)::bigint AS tiktok_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'facebook'), 0)::bigint AS facebook_views
  FROM "public"."all_social_posts"
  WHERE "partner_store_id" = _partner_store_id
    AND "curation_status" = 'assigned';
$$;

COMMENT ON FUNCTION "public"."get_store_stats"("text") IS
  'Aggregated content stats for a partner store. Excludes pending/general/skipped posts. RLS still applies via SECURITY INVOKER — caller only sees stats for stores they have permission to read.';


-- ============================================================
-- cleanup_old_snapshots() — 90-day rolling retention
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."cleanup_old_snapshots"()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as table owner so RLS doesn't block bulk delete
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM "public"."post_snapshots"
      WHERE "snapshot_date" < (CURRENT_DATE - INTERVAL '90 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION "public"."cleanup_old_snapshots"() IS
  'Deletes post_snapshots older than 90 days. Returns count of deleted rows. Called by the polling Edge Function after each daily write.';

-- Grant execute to service_role for Edge Function calls.
GRANT EXECUTE ON FUNCTION "public"."cleanup_old_snapshots"() TO "service_role";

COMMIT;
