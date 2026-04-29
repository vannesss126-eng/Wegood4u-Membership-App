-- Extend referral_tree view with the two profile fields the UI needs to
-- distinguish "Registered only" / "Verified member" / "Active (qualified)"
-- referral states. Source columns:
--   - profiles.verification_completed (existed pre-credits)
--   - profiles.first_approved_submission_at (added in credits_system_tables)
--
-- Compute a discriminator column `referral_state` so the client can switch
-- on a single value rather than re-deriving from booleans.

CREATE OR REPLACE VIEW "public"."referral_tree" AS
WITH RECURSIVE referral_levels AS (
  SELECT
    p1.inviter_id                       AS affiliate_id,
    p1.id                               AS user_id,
    p1.username,
    p1.full_name,
    1                                   AS level,
    p1.created_at,
    p1.inviter_id,
    p1.verification_completed,
    p1.first_approved_submission_at
  FROM public.profiles p1
  WHERE p1.inviter_id IS NOT NULL

  UNION ALL

  SELECT
    rl.affiliate_id,
    p2.id                               AS user_id,
    p2.username,
    p2.full_name,
    2                                   AS level,
    p2.created_at,
    rl.user_id                          AS inviter_id,
    p2.verification_completed,
    p2.first_approved_submission_at
  FROM referral_levels rl
  JOIN public.profiles p2 ON p2.inviter_id = rl.user_id
  WHERE rl.level = 1
)
SELECT
  affiliate_id,
  user_id,
  username,
  full_name,
  level,
  created_at,
  inviter_id,
  verification_completed,
  first_approved_submission_at,
  CASE
    WHEN first_approved_submission_at IS NOT NULL THEN 'active'
    WHEN COALESCE(verification_completed, false)  THEN 'verified'
    ELSE 'registered'
  END AS referral_state
FROM referral_levels
ORDER BY affiliate_id, level, created_at;

ALTER VIEW "public"."referral_tree" OWNER TO "postgres";

GRANT ALL ON TABLE "public"."referral_tree" TO "anon";
GRANT ALL ON TABLE "public"."referral_tree" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_tree" TO "service_role";
