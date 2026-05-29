-- Stars + Visit 10 v1 — Row Level Security
--
-- Pattern (matches existing tables):
--   - Users SELECT only their own rows
--   - Admins SELECT everything (via public.is_admin)
--   - NO client INSERT / UPDATE / DELETE — all writes go through SECURITY DEFINER
--     RPCs (stars_v1_rpcs.sql) and triggers (stars_v1_triggers.sql).

BEGIN;

-- ============================================================
-- star_wallet
-- ============================================================
ALTER TABLE "public"."star_wallet" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own star wallet" ON "public"."star_wallet"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all star wallets" ON "public"."star_wallet"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));


-- ============================================================
-- star_ledger
-- ============================================================
ALTER TABLE "public"."star_ledger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own star ledger" ON "public"."star_ledger"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all star ledger" ON "public"."star_ledger"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));


-- ============================================================
-- visit_progress
-- ============================================================
ALTER TABLE "public"."visit_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own visit progress" ON "public"."visit_progress"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all visit progress" ON "public"."visit_progress"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));


-- ============================================================
-- daily_checkins
-- ============================================================
ALTER TABLE "public"."daily_checkins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checkins" ON "public"."daily_checkins"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all checkins" ON "public"."daily_checkins"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));


-- ============================================================
-- submission_shares
-- ============================================================
ALTER TABLE "public"."submission_shares" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own submission shares" ON "public"."submission_shares"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all submission shares" ON "public"."submission_shares"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));

-- Admins can update status (manual review queue override).
CREATE POLICY "Admins can update submission shares" ON "public"."submission_shares"
  FOR UPDATE TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")))
  WITH CHECK ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));


-- ============================================================
-- vouchers (recreated with new shape — needs fresh policies)
-- ============================================================
ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vouchers" ON "public"."vouchers"
  FOR SELECT TO "authenticated"
  USING ("user_id" = (SELECT "auth"."uid"() AS "uid"));

CREATE POLICY "Admins can read all vouchers" ON "public"."vouchers"
  FOR SELECT TO "authenticated"
  USING ("public"."is_admin"((SELECT "auth"."uid"() AS "uid")));

-- Note: redemption flow is "Coming soon" in v1. When it ships, add an UPDATE
-- policy that lets a SECURITY DEFINER redeem RPC set redeemed_at, scoped to
-- the voucher owner.

COMMIT;
