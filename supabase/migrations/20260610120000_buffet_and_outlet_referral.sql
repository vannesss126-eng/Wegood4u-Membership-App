-- Buffet outlets, per-receipt diner limit & per-outlet referral — Phase 1 (schema only).
--
-- Backs three features requested by Christine (Shi En) for the 7 Thai Geng Mookata
-- buffet outlets. See .agent/plans/buffet-outlets-and-outlet-referral.plan.md.
--
--   1. Buffet = 2 Visit-10 points (vs 1 normally) — per-store visit_points, plus a
--      carry-over bank on profiles for points that overflow a full cycle.
--   2. Per-receipt diner cap — per-store enforce_diner_limit; submissions gain the
--      diner_count + invoice number (receipt_reference) + address read off the receipt,
--      and a real FK from submissions to the matched store.
--   3. Per-outlet referral codes — store_referral_codes (code -> outlet), and an
--      attribution column on profiles. Distinct from invitation_codes (user L1/L2 chain).
--
-- Function/trigger logic (awarding 2 points, the diner cap, signup attribution) lands
-- in later phases. This migration only adds columns, the table, FKs, indexes and RLS.


-- ── 1. Partner store per-store rules ───────────────────────────────────────────
-- Generalised so other store types can vary later, not just buffet.
ALTER TABLE "public"."partner_stores"
  ADD COLUMN IF NOT EXISTS "visit_points" smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "enforce_diner_limit" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."partner_stores"
  DROP CONSTRAINT IF EXISTS "partner_stores_visit_points_range";
ALTER TABLE "public"."partner_stores"
  ADD CONSTRAINT "partner_stores_visit_points_range" CHECK (("visit_points" >= 1) AND ("visit_points" <= 10));

COMMENT ON COLUMN "public"."partner_stores"."visit_points" IS
  'Visit-10 points awarded per approved submission. Default 1; buffet outlets = 2. Only consulted for restaurant/cafe/bar categories (hotel never advances the cycle).';
COMMENT ON COLUMN "public"."partner_stores"."enforce_diner_limit" IS
  'When true (buffet outlets), the AI reviewer caps the number of distinct users who can claim one physical receipt at the receipt''s diner count.';


-- ── 2. Submissions: link to the matched store + capture buffet receipt facts ───
-- partner_store_id already exists (legacy Firestore doc id, NULL for old rows).
-- partner_stores now lives in Supabase keyed on those same ids, so we can FK it.
ALTER TABLE "public"."submissions"
  ADD COLUMN IF NOT EXISTS "diner_count" integer,
  ADD COLUMN IF NOT EXISTS "receipt_reference" "text",
  ADD COLUMN IF NOT EXISTS "receipt_address" "text";

COMMENT ON COLUMN "public"."submissions"."diner_count" IS
  'Pax read off a buffet receipt = sum of ADULT set-package quantities. NULL for non-buffet / unreadable. Kid sets excluded.';
COMMENT ON COLUMN "public"."submissions"."receipt_reference" IS
  'Printed Invoice no (e.g. "8483"). Groups all photos of one physical receipt across users for the diner cap.';
COMMENT ON COLUMN "public"."submissions"."receipt_address" IS
  'Address block read off the receipt, for admin audit and address corroboration against the store''s DB address.';

-- Defensive: legacy rows are NULL, but null out any partner_store_id that has no
-- matching store so the FK can be added cleanly.
UPDATE "public"."submissions" s
  SET "partner_store_id" = NULL
  WHERE "partner_store_id" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "public"."partner_stores" ps WHERE ps."id" = s."partner_store_id");

ALTER TABLE "public"."submissions"
  DROP CONSTRAINT IF EXISTS "submissions_partner_store_id_fkey";
ALTER TABLE "public"."submissions"
  ADD CONSTRAINT "submissions_partner_store_id_fkey"
  FOREIGN KEY ("partner_store_id")
  REFERENCES "public"."partner_stores"("id")
  ON DELETE SET NULL;

COMMENT ON COLUMN "public"."submissions"."partner_store_id" IS
  'FK to partner_stores(id). Set on new submissions so per-store rules (visit_points, diner limit) and address checks can resolve. NULL on legacy rows / if the store is later deleted.';

-- Group key for the cross-user diner cap. partner_store_id leads, so this also
-- serves plain partner_store_id lookups (FK joins, per-outlet analytics).
CREATE INDEX IF NOT EXISTS "idx_submissions_receipt_group"
  ON "public"."submissions" USING "btree" ("partner_store_id", "receipt_reference");


-- ── 3. Per-outlet referral codes (store attribution) ───────────────────────────
CREATE TABLE IF NOT EXISTS "public"."store_referral_codes" (
  "partner_store_id" "text" NOT NULL,
  "code" "text" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "store_referral_codes_pkey" PRIMARY KEY ("partner_store_id"),
  CONSTRAINT "store_referral_codes_code_key" UNIQUE ("code"),
  CONSTRAINT "store_referral_codes_partner_store_id_fkey"
    FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_stores"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."store_referral_codes" OWNER TO "postgres";

COMMENT ON TABLE "public"."store_referral_codes" IS
  'One referral/QR code per outlet for download attribution. A new user scans the code; it resolves to partner_store_id, stored on profiles.referred_by_store_id. Distinct from invitation_codes (the user L1/L2 star chain).';

ALTER TABLE "public"."store_referral_codes" ENABLE ROW LEVEL SECURITY;

-- Anyone can read the code -> outlet mapping (signup resolves it as anon, before auth).
CREATE POLICY "anyone reads store referral codes"
  ON "public"."store_referral_codes"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

-- Admins manage the codes.
CREATE POLICY "admins manage store referral codes"
  ON "public"."store_referral_codes"
  TO "authenticated"
  USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")))
  WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));

GRANT ALL ON TABLE "public"."store_referral_codes" TO "anon";
GRANT ALL ON TABLE "public"."store_referral_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."store_referral_codes" TO "service_role";


-- ── 4. Profile: outlet attribution + Visit-10 carry-over bank ──────────────────
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "referred_by_store_id" "text",
  ADD COLUMN IF NOT EXISTS "pending_carryover_visits" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."profiles"
  DROP CONSTRAINT IF EXISTS "profiles_referred_by_store_id_fkey";
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_referred_by_store_id_fkey"
  FOREIGN KEY ("referred_by_store_id")
  REFERENCES "public"."partner_stores"("id")
  ON DELETE SET NULL;

ALTER TABLE "public"."profiles"
  DROP CONSTRAINT IF EXISTS "profiles_pending_carryover_visits_nonneg";
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_pending_carryover_visits_nonneg" CHECK ("pending_carryover_visits" >= 0);

COMMENT ON COLUMN "public"."profiles"."referred_by_store_id" IS
  'Outlet whose referral code/QR attributed this signup. Separate from inviter_id (the user referral chain). NULL if signup was not via an outlet code.';
COMMENT ON COLUMN "public"."profiles"."pending_carryover_visits" IS
  'Visit-10 points that overflowed a full cycle (e.g. a buffet +2 at 9/10). Drained into the next cycle when it opens. See _apply_real_visit / _get_or_open_active_cycle.';
