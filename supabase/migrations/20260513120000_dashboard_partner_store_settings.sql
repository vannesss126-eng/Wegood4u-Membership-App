-- Partner Analytics Dashboard — Phase 1, Migration 1 of 7
--
-- partner_store_settings: per-store operational data that deliberately stays
-- out of Firestore (`partner_store` collection holds presentational data only).
--
-- Design notes:
--   • partner_store_id is the Firestore doc id (text, NO foreign key — same
--     pattern as user_favorite_stores).
--   • per_visit_fee lives here because it is a property of the STORE, not of
--     the (user, store) relationship. If it lived on partner_accounts it
--     would duplicate and could drift when a store has multiple partner users.
--   • partner_tier (Starter / Growth / Premium) was dropped 2026-05-17 — Kasey
--     said tiered pricing is not needed for now. Single per_visit_fee per
--     store; admin sets it manually. Re-add the column if tiers come back.
--   • A store appears in this table once it is enrolled as a paying partner.
--     Stores that exist in Firestore but are not enrolled simply have no row.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."partner_store_settings" (
    "partner_store_id" "text" NOT NULL,
    "per_visit_fee" numeric(10,2) NOT NULL,
    "active" boolean NOT NULL DEFAULT true,
    "enrolled_at" timestamptz NOT NULL DEFAULT now(),
    "notes" "text",
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "partner_store_settings_pkey" PRIMARY KEY ("partner_store_id")
);

ALTER TABLE "public"."partner_store_settings" OWNER TO "postgres";

COMMENT ON TABLE "public"."partner_store_settings" IS
  'Per-store operational settings (tier, per-visit fee, enrollment). partner_store_id is a Firestore doc id.';

CREATE INDEX IF NOT EXISTS "partner_store_settings_active_idx"
  ON "public"."partner_store_settings" ("active") WHERE "active" = true;


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE "public"."partner_store_settings" ENABLE ROW LEVEL SECURITY;

-- Partners can read settings for stores they are linked to via partner_accounts.
-- (Policy defined here without the helper function — helper is created in
-- migration 2 since it depends on partner_accounts.)
-- For now: admin-only access. Update in migration 2 once partner_accounts exists.

DROP POLICY IF EXISTS "admins read all partner store settings"
  ON "public"."partner_store_settings";
CREATE POLICY "admins read all partner store settings"
  ON "public"."partner_store_settings" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write partner store settings"
  ON "public"."partner_store_settings";
CREATE POLICY "admins write partner store settings"
  ON "public"."partner_store_settings" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."partner_store_settings_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "partner_store_settings_updated_at"
  ON "public"."partner_store_settings";
CREATE TRIGGER "partner_store_settings_updated_at"
  BEFORE UPDATE ON "public"."partner_store_settings"
  FOR EACH ROW EXECUTE FUNCTION "public"."partner_store_settings_touch_updated_at"();

COMMIT;
