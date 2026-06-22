-- ============================================================================
-- Security hardening — F15: SECURITY DEFINER views readable by anon
-- Plan: .claude/plans/20_06_security-fix.plan.md · Findings: .claude/documentation/19_06_security-issues.md
--
-- Flagged by Supabase's Security Advisor. Three views run with the owner's
-- rights (definer → bypass RLS) AND were GRANTed to anon, so anyone with the
-- public key could SELECT them and read cross-user PII (names, roles, all
-- pending submissions, the full referral graph) — bypassing the RLS we hardened.
--
-- Fix:
--   * pending_submissions_view, user_stats — unused by clients; switch to
--     security_invoker (respect the caller's RLS: admin sees all, a user sees
--     only their own, anon nothing) and revoke anon. service_role (BYPASSRLS)
--     still sees everything for server use.
--   * referral_tree — must stay definer (recursive walk over OTHER users'
--     profiles), so scope it to the calling user (auth.uid()) and revoke anon.
--     useReferrals already filters by affiliate_id = the user's own id → no
--     client change required.
-- ============================================================================

begin;

-- 1) pending_submissions_view --------------------------------------------------
alter view public.pending_submissions_view set (security_invoker = on);
revoke all on table public.pending_submissions_view from anon;

-- 2) user_stats ----------------------------------------------------------------
alter view public.user_stats set (security_invoker = on);
revoke all on table public.user_stats from anon;

-- 3) referral_tree — scope to the calling user (kept as a definer view) --------
create or replace view public.referral_tree as
 with recursive referral_levels as (
   select p1.inviter_id as affiliate_id, p1.id as user_id, p1.username, p1.full_name,
          1 as level, p1.created_at, p1.inviter_id,
          p1.verification_completed, p1.first_approved_submission_at
     from public.profiles p1
    where p1.inviter_id is not null
   union all
   select rl.affiliate_id, p2.id as user_id, p2.username, p2.full_name,
          2 as level, p2.created_at, rl.user_id as inviter_id,
          p2.verification_completed, p2.first_approved_submission_at
     from referral_levels rl
     join public.profiles p2 on p2.inviter_id = rl.user_id
    where rl.level = 1
 )
 select affiliate_id, user_id, username, full_name, level, created_at, inviter_id,
        verification_completed, first_approved_submission_at,
        case
            when first_approved_submission_at is not null then 'active'::text
            when coalesce(verification_completed, false) then 'verified'::text
            else 'registered'::text
        end as referral_state
   from referral_levels
  where affiliate_id = (select auth.uid())   -- only the caller's own referrals
  order by affiliate_id, level, created_at;

revoke all on table public.referral_tree from anon;

commit;
