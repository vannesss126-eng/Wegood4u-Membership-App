-- Partner Analytics Dashboard — Phase 2 (Full-Supabase migration), Migration 2 of 3
--
-- all_social_posts: tracks marketing posts (videos / reels / shorts) across
-- YouTube / Instagram / TikTok / Facebook. Replaces the Firestore-based
-- design originally drafted in restaurant-analytic-api-overview.md.
--
-- Locked 2026-05-18 — full Supabase, no Firestore.
--
-- Design notes:
--   • One row per (platform, platform_post_id). The same campaign on YT + TT
--     produces 2 rows.
--   • `partner_store_id` is text + FK to partner_stores.id. NULL means
--     "awaiting curation" or the post is marked general/skipped (see
--     curation_status). A CHECK enforces the relationship.
--   • `curation_status` replaces Firestore's special-string convention
--     ("GENERAL", "SKIP") with a typed enum. Cleaner SQL; same intent.
--   • `current_*` cumulative counters are denormalised onto this row for
--     fast dashboard reads. Daily history lives in post_snapshots (next
--     migration). Both updated atomically by the polling Edge Function.
--   • RLS: partners read posts assigned to their stores; admins read all.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."all_social_posts" (
    "id" bigserial PRIMARY KEY,
    "platform" "text" NOT NULL,
    "platform_post_id" "text" NOT NULL,
    "url" "text",
    "title" "text",
    "thumbnail_url" "text",
    "posted_at" timestamptz,

    "partner_store_id" "text"
      REFERENCES "public"."partner_stores"("id") ON DELETE SET NULL,
    "curation_status" "text" NOT NULL DEFAULT 'pending',
    "assigned_at" timestamptz,
    "assigned_by" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,

    "current_views" bigint NOT NULL DEFAULT 0,
    "current_likes" bigint NOT NULL DEFAULT 0,
    "last_updated" timestamptz,

    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "all_social_posts_platform_check"
      CHECK ("platform" IN ('youtube', 'instagram', 'tiktok', 'facebook')),
    CONSTRAINT "all_social_posts_curation_check"
      CHECK ("curation_status" IN ('pending', 'assigned', 'general', 'skipped')),
    CONSTRAINT "all_social_posts_assignment_consistent"
      CHECK (
        ("curation_status" = 'assigned' AND "partner_store_id" IS NOT NULL)
        OR ("curation_status" != 'assigned' AND "partner_store_id" IS NULL)
      ),
    CONSTRAINT "all_social_posts_platform_id_unique"
      UNIQUE ("platform", "platform_post_id")
);

ALTER TABLE "public"."all_social_posts" OWNER TO "postgres";

COMMENT ON TABLE "public"."all_social_posts" IS
  'Marketing posts across YT/IG/TikTok/FB. Upserted by the polling Edge Function. partner_store_id assigned manually by admin via curation UI.';

CREATE INDEX IF NOT EXISTS "all_social_posts_store_posted_idx"
  ON "public"."all_social_posts" ("partner_store_id", "posted_at" DESC)
  WHERE "partner_store_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "all_social_posts_pending_idx"
  ON "public"."all_social_posts" ("posted_at" DESC)
  WHERE "curation_status" = 'pending';

CREATE INDEX IF NOT EXISTS "all_social_posts_platform_idx"
  ON "public"."all_social_posts" ("platform", "posted_at" DESC);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE "public"."all_social_posts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read their posts" ON "public"."all_social_posts";
CREATE POLICY "partners read their posts"
  ON "public"."all_social_posts" FOR SELECT TO "authenticated"
  USING (
    "partner_store_id" IS NOT NULL
    AND "public"."is_partner_for_store"("partner_store_id")
  );

DROP POLICY IF EXISTS "admins read all posts" ON "public"."all_social_posts";
CREATE POLICY "admins read all posts"
  ON "public"."all_social_posts" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write posts" ON "public"."all_social_posts";
CREATE POLICY "admins write posts"
  ON "public"."all_social_posts" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."all_social_posts_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "all_social_posts_updated_at" ON "public"."all_social_posts";
CREATE TRIGGER "all_social_posts_updated_at"
  BEFORE UPDATE ON "public"."all_social_posts"
  FOR EACH ROW EXECUTE FUNCTION "public"."all_social_posts_touch_updated_at"();

COMMIT;
