-- ============================================================================
-- Security hardening — Phase 1 (zero-risk DB corrections)
-- Plan: .claude/plans/good-day-i-want-rustling-haven.md
-- Companion notes: .claude/documentation/19_06_security-issues.md
--
-- App is pre-launch; every statement here is additive/corrective and closes an
-- escalation or abuse path WITHOUT changing behavior for legitimate users.
-- The only paired client change is UnverifiedMember.tsx -> request_member_upgrade().
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Pin search_path on SECURITY DEFINER functions (F8)
--    Prevents search_path-hijack privilege escalation. All bodies already
--    schema-qualify public.*, so 'public' is sufficient (pg_catalog is implicit).
-- ----------------------------------------------------------------------------
alter function public.is_admin(uuid)                                     set search_path to 'public';
alter function public.delete_user_data(uuid)                             set search_path to 'public';
alter function public.handle_new_user()                                  set search_path to 'public';
alter function public.increment_invitation_usage()                       set search_path to 'public';
alter function public.update_submission_review(bigint, text, text, text) set search_path to 'public';
alter function public.user_daily_submission_count(uuid)                  set search_path to 'public';

-- ----------------------------------------------------------------------------
-- 2) Revoke client EXECUTE on privileged SECURITY DEFINER functions (F1, F2)
--    IMPORTANT: Postgres grants EXECUTE to PUBLIC by default, so revoking only
--    anon/authenticated would leave the function callable via PUBLIC. We revoke
--    PUBLIC explicitly. service_role keeps access (edge functions use it).
-- ----------------------------------------------------------------------------

-- delete_user_data: was callable by anon -> anyone could delete any user's data.
revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;

-- update_submission_review: was callable by anon -> anyone could approve/reject
-- any submission. Admin UI updates submissions directly via RLS; edge fn uses
-- service_role. No client caller exists.
revoke all on function public.update_submission_review(bigint, text, text, text) from public, anon, authenticated;

-- Trigger-only functions never need direct client EXECUTE (triggers run as the
-- table owner regardless of EXECUTE grants).
revoke all on function public.handle_new_user()            from public, anon, authenticated;
revoke all on function public.increment_invitation_usage() from public, anon, authenticated;

-- Daily-count helper: drop anon + the PUBLIC default. Keep the explicit
-- authenticated grant (the Phase 2C abuse-ceiling RLS policy evaluates it as
-- the authenticated user) and service_role.
revoke all on function public.user_daily_submission_count(uuid) from public, anon;

-- ----------------------------------------------------------------------------
-- 3) Lock profiles.role against self-escalation (F5)
--    The "Users can update own profile" policy only checks id = auth.uid(), so a
--    logged-in user could set their own role to 'admin'. Gate role changes here.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.role is distinct from old.role then
    -- Permitted only for: backend (service_role), an existing admin, or the
    -- sanctioned request_member_upgrade() RPC (sets the txn-local flag below).
    if auth.role() = 'service_role'
       or coalesce(current_setting('app.role_change_ok', true), '') = '1'
       or coalesce(public.is_admin(auth.uid()), false) then
      return new;
    end if;
    raise exception 'Changing profile role is not permitted';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- Sanctioned subscriber -> member upgrade, server-enforcing the exact gate the
-- client previously checked client-side (email confirmed + questionnaire done).
create or replace function public.request_member_upgrade()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_email_confirmed boolean;
  v_verification_completed boolean;
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select (u.email_confirmed_at is not null),
         coalesce(p.verification_completed, false),
         p.role
    into v_email_confirmed, v_verification_completed, v_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_uid;

  if v_role is null then
    raise exception 'Profile not found';
  end if;

  -- Idempotent: already promoted beyond subscriber -> no-op.
  if v_role <> 'subscriber'::public.user_role then
    return;
  end if;

  if not v_email_confirmed then
    raise exception 'Email not confirmed';
  end if;
  if not v_verification_completed then
    raise exception 'Questionnaire not completed';
  end if;

  perform set_config('app.role_change_ok', '1', true);
  update public.profiles set role = 'member'::public.user_role where id = v_uid;
end;
$$;

revoke all on function public.request_member_upgrade() from public, anon;
grant execute on function public.request_member_upgrade() to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Remove over-broad member self-update on submissions (F7)
--    Its WITH CHECK did not lock the status/reviewed_by columns, so a member
--    could set their own submission to 'approved' and trigger the star reward.
--    Members have no app flow that updates submissions; admins update via the
--    "Admins can update submissions" policy and the AI edge fn uses service_role
--    (bypasses RLS).
-- ----------------------------------------------------------------------------
drop policy if exists "Allow Authenticated Users to Update their own submissions while" on public.submissions;

-- ----------------------------------------------------------------------------
-- 5) Block client-side badge inserts (F9)
--    Badges are awarded only by SECURITY DEFINER functions (owner context,
--    bypasses RLS). The old "WITH CHECK (true)" let any user self-award.
-- ----------------------------------------------------------------------------
drop policy if exists "System can award badges" on public.user_badges;
create policy "Badges are awarded server-side only"
  on public.user_badges for insert to authenticated
  with check (false);

-- ----------------------------------------------------------------------------
-- 6) Per-user receipt dedup as a hard constraint (F10)
--    The edge function fills receipt_hash post-insert; this prevents a single
--    user from holding two non-rejected submissions for the same physical
--    receipt. 'rejected' rows are excluded so a flagged duplicate may retain its
--    hash. Buffet receipts shared across DIFFERENT users are unaffected (keyed
--    by user_id) and remain governed by the edge fn's diner cap.
--    Pre-launch: assumes no pre-existing duplicate (user_id, receipt_hash) rows.
-- ----------------------------------------------------------------------------
create unique index if not exists idx_submissions_user_active_receipt_hash
  on public.submissions (user_id, receipt_hash)
  where receipt_hash is not null and status <> 'rejected'::public.submission_status;

-- ----------------------------------------------------------------------------
-- 7) Drop broken submission policies that effectively grant all authenticated
--    (F11). Their role subquery omits "profiles.id = auth.uid()", so the
--    "role <> subscriber" guard is always satisfied (any non-subscriber exists).
--    The correct "Members can create submissions" + "Users can read own
--    submissions" + admin/partner policies remain in force.
-- ----------------------------------------------------------------------------
drop policy if exists "Allow Authenticated Users to 'Select' Submission" on public.submissions;
drop policy if exists "Allow Authenticated Users to Insert Submissions" on public.submissions;

commit;
