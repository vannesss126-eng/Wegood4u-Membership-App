-- Remove the 20-submissions-per-UTC-day cap on submissions (product decision: no
-- per-day usage limit on proof-of-travel submissions).
--
-- This drops ONLY the RESTRICTIVE rate-limit policy. The permissive INSERT policies
-- ("Allow Authenticated Users to Insert Submissions" and "Members can create submissions")
-- stay in place, so a user can still only insert their OWN submissions — we are removing
-- the quantity cap, not the ownership check.
--
-- The user_daily_submission_count() helper function is intentionally LEFT in place: it is
-- harmless without the policy and may still be referenced by analytics/admin tooling.
-- The matching client-side cap (component daily-count guard + 19/20 warning UI) is removed
-- in the same change set (components/verified-member/submission/index.tsx).

DROP POLICY IF EXISTS "Limit submissions to 20 per day (UTC)" ON "public"."submissions";
