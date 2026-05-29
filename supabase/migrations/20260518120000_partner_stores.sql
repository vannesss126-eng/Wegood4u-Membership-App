-- Partner Analytics Dashboard — Phase 2 (Full-Supabase migration), Migration 1 of 3
--
-- partner_stores: master partner store table. Replaces the Firestore
-- `partner_store` collection. Mirrors the existing field set from
-- Code/data/partnerStore.ts so the mobile app's mapDocToPartnerStore() can
-- be swapped to a Supabase query with minimal code change.
--
-- Locked 2026-05-18 — see firestore-to-supabase-migration-plan.md.
--
-- Design notes:
--   • id TEXT (not uuid) so existing Firestore doc ids carry over verbatim
--     during the one-time backfill. This means partner_store_id text columns
--     in partner_store_settings, partner_accounts, submissions, and the new
--     all_social_posts table all reference the SAME id space — backfill is
--     a straight copy, no remapping.
--   • Field shape mirrors the Firestore doc: name, type, city, address,
--     latitude, longitude, rating, image, phone, hours, description.
--     `days` and `price_range` and `menu-images` (renamed `menu_images`)
--     stay as jsonb for flexibility — the Firestore docs varied in shape.
--   • RLS: all authenticated users can SELECT (partner stores are public
--     data already exposed via the mobile app). Admin-only writes.
--   • FK additions to existing tables (partner_store_settings, partner_accounts,
--     submissions) happen in a LATER migration, AFTER the backfill is verified.
--     See firestore-to-supabase-migration-plan.md step 5.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."partner_stores" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "city" "text" NOT NULL,
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "rating" numeric(3,2),
    "image" "text",
    "phone" "text",
    "hours" "text",
    "description" "text",
    "price_range" "text",
    "days" "jsonb",
    "menu_images" "jsonb",
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "partner_stores_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."partner_stores" OWNER TO "postgres";

COMMENT ON TABLE "public"."partner_stores" IS
  'Master partner store table. Replaces the Firestore partner_store collection. id keeps the original Firestore doc id for clean backfill.';

CREATE INDEX IF NOT EXISTS "partner_stores_city_idx"
  ON "public"."partner_stores" ("city");
CREATE INDEX IF NOT EXISTS "partner_stores_type_idx"
  ON "public"."partner_stores" ("type");
CREATE INDEX IF NOT EXISTS "partner_stores_active_idx"
  ON "public"."partner_stores" ("active") WHERE "active" = true;


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE "public"."partner_stores" ENABLE ROW LEVEL SECURITY;

-- Public read: every authenticated user can browse the partner store list.
-- (Same effective visibility as today's Firestore reads from the mobile app.)
DROP POLICY IF EXISTS "all users read partner stores" ON "public"."partner_stores";
CREATE POLICY "all users read partner stores"
  ON "public"."partner_stores" FOR SELECT TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "admins write partner stores" ON "public"."partner_stores";
CREATE POLICY "admins write partner stores"
  ON "public"."partner_stores" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."partner_stores_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "partner_stores_updated_at" ON "public"."partner_stores";
CREATE TRIGGER "partner_stores_updated_at"
  BEFORE UPDATE ON "public"."partner_stores"
  FOR EACH ROW EXECUTE FUNCTION "public"."partner_stores_touch_updated_at"();

COMMIT;
