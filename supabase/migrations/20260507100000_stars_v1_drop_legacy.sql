-- Stars + Visit 10 v1 — Drop legacy artifacts
--
-- Removes the per-category credits/cycle model that's being replaced by:
--   - single cumulative Visit 10 cycle (visit_progress table, in next migration)
--   - star wallet + manual trade (star_wallet, star_ledger tables)
--   - direct +50 star L2 referrals (replaces half-credit accumulator)
--
-- See .agent/documentation/credits-overview.md and
-- .agent/plans/stars-and-extra-progress.plan.md Phase 1 §1.0 for context.

BEGIN;

-- 1. Drop the trigger on submissions before the function it calls.
DROP TRIGGER IF EXISTS "on_submission_approved" ON "public"."submissions";

-- 2. Drop the legacy on_submission_approved trigger function (we recreate it
--    with new logic in stars_v1_triggers.sql).
DROP FUNCTION IF EXISTS "public"."on_submission_approved"();

-- 3. Drop all 8 legacy per-category cycle functions.
DROP FUNCTION IF EXISTS "public"."_credits_active_cycle_id"("uuid", "public"."store_category");
DROP FUNCTION IF EXISTS "public"."_credits_apply_delta"("uuid", "public"."store_category", "text", bigint, "uuid");
DROP FUNCTION IF EXISTS "public"."_credits_award_tier_badge"("uuid");
DROP FUNCTION IF EXISTS "public"."_credits_completed_task_count"("uuid");
DROP FUNCTION IF EXISTS "public"."_credits_pick_referral_target"("uuid");
DROP FUNCTION IF EXISTS "public"."_credits_reward_kind_for_tier"("text");
DROP FUNCTION IF EXISTS "public"."_credits_tier_for_task_count"(integer);

-- 4. Drop the legacy badge-award function (replaced by per-badge_kind logic
--    in stars_v1_triggers.sql).
DROP FUNCTION IF EXISTS "public"."check_and_award_badges"() CASCADE;

-- 5. Drop legacy tables. CASCADE clears any dependent indexes / sequences.
DROP TABLE IF EXISTS "public"."credits_ledger" CASCADE;
DROP TABLE IF EXISTS "public"."referral_half_credit_accumulator" CASCADE;

-- vouchers gets recreated with new shape (badge_kind, level, new reward_kind values)
-- in stars_v1_schema.sql. CASCADE drops the existing CHECK constraints.
DROP TABLE IF EXISTS "public"."vouchers" CASCADE;

-- Note on enums: store_category and badge_category are intentionally NOT extended
-- with 'experience' in v1. Add later when the Experience category lands:
--   ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'experience';
--   ALTER TYPE public.badge_category ADD VALUE IF NOT EXISTS 'experience';

COMMIT;
