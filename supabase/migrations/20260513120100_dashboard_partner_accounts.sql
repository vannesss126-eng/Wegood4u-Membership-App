-- Partner Analytics Dashboard — Phase 1, Migration 2 of 7
--
-- partner_accounts: links an authenticated user to one or more partner stores.
-- Per project decision (chat with Kasey 2026-05-13), partners do NOT
-- self-register — rows are inserted manually by admin.
--
-- Design notes:
--   • partner_store_id is the Firestore doc id (text), with an FK to
--     partner_store_settings (which owns the store-level operational data).
--   • role: owner / manager / viewer (per dashboard spec §4.1–4.2). Owners
--     can manage team members in a future Phase 5 feature; for MVP everyone
--     reads.
--   • Composite PK (user_id, partner_store_id) — a user can be linked to
--     multiple stores; a store can have multiple partner users.
--   • Also adds the is_partner_for_store(text) helper function used by every
--     downstream RLS policy, and updates the partner_store_settings policy
--     to use it.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."partner_accounts" (
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "partner_store_id" "text" NOT NULL
      REFERENCES "public"."partner_store_settings"("partner_store_id") ON DELETE CASCADE,
    "role" "text" NOT NULL DEFAULT 'owner',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "partner_accounts_pkey" PRIMARY KEY ("user_id", "partner_store_id"),
    CONSTRAINT "partner_accounts_role_check"
      CHECK ("role" IN ('owner', 'manager', 'viewer'))
);

ALTER TABLE "public"."partner_accounts" OWNER TO "postgres";

COMMENT ON TABLE "public"."partner_accounts" IS
  'Maps auth users to the partner stores they can access. Admin-managed.';

CREATE INDEX IF NOT EXISTS "partner_accounts_user_idx"
  ON "public"."partner_accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "partner_accounts_store_idx"
  ON "public"."partner_accounts" ("partner_store_id");


-- ============================================================
-- Helper function used by every dashboard RLS policy
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."is_partner_for_store"(_partner_store_id "text")
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."partner_accounts"
    WHERE "user_id" = (SELECT auth.uid())
      AND "partner_store_id" = _partner_store_id
  );
$$;

COMMENT ON FUNCTION "public"."is_partner_for_store"("text") IS
  'Returns true if the current authenticated user is linked to the given partner_store_id via partner_accounts.';


-- ============================================================
-- RLS — partner_accounts itself
-- ============================================================

ALTER TABLE "public"."partner_accounts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own partner accounts" ON "public"."partner_accounts";
CREATE POLICY "users read own partner accounts"
  ON "public"."partner_accounts" FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admins read all partner accounts" ON "public"."partner_accounts";
CREATE POLICY "admins read all partner accounts"
  ON "public"."partner_accounts" FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())));

DROP POLICY IF EXISTS "admins write partner accounts" ON "public"."partner_accounts";
CREATE POLICY "admins write partner accounts"
  ON "public"."partner_accounts" FOR ALL TO "authenticated"
  USING ("public"."is_admin"((SELECT auth.uid())))
  WITH CHECK ("public"."is_admin"((SELECT auth.uid())));


-- ============================================================
-- Update partner_store_settings RLS to use the helper
-- ============================================================

DROP POLICY IF EXISTS "partners read their store settings"
  ON "public"."partner_store_settings";
CREATE POLICY "partners read their store settings"
  ON "public"."partner_store_settings" FOR SELECT TO "authenticated"
  USING ("public"."is_partner_for_store"("partner_store_id"));

COMMIT;
