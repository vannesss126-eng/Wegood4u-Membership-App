-- Stars + Visit 10 v1 — Realtime publication
--
-- The base remote_schema migration only added `badges` and `profiles` to the
-- supabase_realtime publication. The Phase 1 schema introduced four tables that
-- the client needs to react to live (wallet pill increments, visit progress
-- updates, share verification state, referral banner toasts).
--
-- IF NOT EXISTS guards keep this safe to re-run.

BEGIN;

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."star_wallet";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."star_ledger";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."visit_progress";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."submission_shares";

COMMIT;
