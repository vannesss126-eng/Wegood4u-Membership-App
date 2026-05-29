-- Favorites & Wishlist — Phase 1: user_favorite_stores table
--
-- Per-user favorites for partner stores. Stores themselves live in Firebase
-- Firestore (`partner_store` collection); this table just keeps the id list
-- so the heart icon on the partner store detail page becomes a real toggle.
--
-- Design notes:
--   • partner_store_id is a Firestore doc id (text, NO foreign key — Firestore
--     lives outside Supabase). Orphaned rows render as a fallback UI client-side.
--   • Composite primary key (user_id, partner_store_id) gives free idempotency
--     and a natural unique constraint; no separate unique index needed.
--   • No UPDATE policy — favorites are immutable; toggle = INSERT or DELETE.
--   • Realtime publication add lets the hook sync state across screens
--     (e.g. detail page toggle → Favorites listing screen updates without refetch).

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."user_favorite_stores" (
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "partner_store_id" "text" NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "user_favorite_stores_pkey" PRIMARY KEY ("user_id", "partner_store_id")
);

ALTER TABLE "public"."user_favorite_stores" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_favorite_stores" IS
  'Per-user favorited partner stores. partner_store_id is a Firestore doc id (no FK).';

-- Index for "list this user''s favorites, newest first" — covers the
-- Favorites screen and the Map/Home filter chip.
CREATE INDEX IF NOT EXISTS "user_favorite_stores_user_created_idx"
  ON "public"."user_favorite_stores" ("user_id", "created_at" DESC);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE "public"."user_favorite_stores" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users select own favorites" ON "public"."user_favorite_stores";
CREATE POLICY "users select own favorites"
  ON "public"."user_favorite_stores" FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users insert own favorites" ON "public"."user_favorite_stores";
CREATE POLICY "users insert own favorites"
  ON "public"."user_favorite_stores" FOR INSERT TO "authenticated"
  WITH CHECK ("user_id" = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users delete own favorites" ON "public"."user_favorite_stores";
CREATE POLICY "users delete own favorites"
  ON "public"."user_favorite_stores" FOR DELETE TO "authenticated"
  USING ("user_id" = (SELECT auth.uid()));

-- Admins can read everything for support / debugging.
DROP POLICY IF EXISTS "admins read all favorites" ON "public"."user_favorite_stores";
CREATE POLICY "admins read all favorites"
  ON "public"."user_favorite_stores" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- Realtime publication
-- ============================================================

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."user_favorite_stores";

COMMIT;
