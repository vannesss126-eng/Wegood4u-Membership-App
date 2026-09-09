-- 20260902120000_delete_user_data_complete.sql
--
-- Make public.delete_user_data(uuid) delete EVERY row that belongs to the user,
-- explicitly, instead of naming 5 tables and leaving the other 8 to FK cascade.
--
-- Why
-- ---
-- The original function deleted only submissions, notifications, user_badges,
-- invitation_codes and push_tokens before deleting the profile. Eight further
-- user-owned tables have been added since (star_wallet, star_ledger,
-- visit_progress, vouchers, daily_checkins, submission_shares,
-- user_favorite_stores, partner_accounts). They are cleaned up TODAY only as a
-- side effect of `on delete cascade` on their FK to public.profiles -- an
-- implicit guarantee that silently breaks the moment a new user-owned table is
-- created without that clause (exactly the class of bug that produced the
-- 23503 `profiles_inviter_id_fkey` deletion failure fixed in
-- 20260628120000_fix_account_deletion_fks.sql).
--
-- Deleting each table by name makes the deletion promise auditable in one
-- place: what the app tells the user ("all your travel proofs, badges and
-- rewards will be permanently lost") is now literally the body of this
-- function, and the row counts are written to the Postgres log for evidence.
--
-- Scope -- what this function does NOT do (deliberately)
-- -----------------------------------------------------
--   * auth.users     -- deleted by the delete-account Edge Function via the
--                       Admin API (auth.admin.deleteUser), which also revokes
--                       sessions, refresh tokens and identities. Deleting
--                       auth.users from SQL would bypass GoTrue.
--   * storage objects -- rows in storage.objects can be deleted from SQL, but
--                       that leaves the actual FILE bytes orphaned in the
--                       bucket. Storage cleanup must stay in the Edge Function,
--                       which uses the Storage API (submitted-receipt,
--                       submitted-selfie, profilePic,
--                       submission-share-screenshots under the `<uid>/` prefix).
--
-- Rows belonging to OTHER users that merely POINT at this user are detached,
-- never deleted -- handled by the FK actions set in 20260628120000:
--   profiles.inviter_id              -> set null (invitees keep their accounts)
--   submissions.reviewed_by          -> set null (reviews stay auditable)
--   star_ledger.source_referral_user -> set null (other users keep their stars)
--   all_social_posts.assigned_by     -> set null (curation history survives)
--
-- The whole function runs inside the caller's transaction, so deletion is
-- all-or-nothing: a failure anywhere leaves the account fully intact.
--
-- VERIFY (as postgres, with a disposable test account):
--   select public.delete_user_data('<uuid>');
--   -- then, all of these must return 0:
--   select count(*) from public.submissions        where user_id = '<uuid>';
--   select count(*) from public.star_ledger        where user_id = '<uuid>';
--   select count(*) from public.visit_progress     where user_id = '<uuid>';
--   select count(*) from public.profiles           where id      = '<uuid>';
--   -- and the invitees must survive, detached:
--   select id, inviter_id from public.profiles where inviter_id is null;

begin;

create or replace function public.delete_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := (select auth.uid());
  v_counts jsonb := '{}'::jsonb;
  v_n      bigint;
begin
  if p_user_id is null then
    raise exception 'delete_user_data: p_user_id is required';
  end if;

  -- Only the account owner may delete their own account.
  -- EXECUTE is already revoked from anon/authenticated (see
  -- 20260619140000_security_hardening_phase1.sql), so in practice the only
  -- caller is the delete-account Edge Function using the service_role key --
  -- which has no auth.uid(), hence the null check. This guard is the structural
  -- backstop: if EXECUTE is ever granted to `authenticated` again, a logged-in
  -- user still cannot pass somebody else's id. Direct DB sessions (SQL editor,
  -- psql, migrations) also have no auth.uid() and are unaffected -- they already
  -- have full table access, so there is nothing to protect against there.
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'delete_user_data: you may only delete your own account'
      using errcode = '42501';
  end if;

  -- Children first, profile last. Every table below is keyed by the user; the
  -- order keeps the deletion deterministic instead of relying on cascade order.

  delete from public.submission_shares     where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('submission_shares', v_n);

  delete from public.star_ledger           where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('star_ledger', v_n);

  delete from public.star_wallet           where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('star_wallet', v_n);

  delete from public.visit_progress        where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('visit_progress', v_n);

  delete from public.vouchers              where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('vouchers', v_n);

  delete from public.daily_checkins        where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('daily_checkins', v_n);

  delete from public.user_favorite_stores  where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('user_favorite_stores', v_n);

  delete from public.user_badges           where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('user_badges', v_n);

  delete from public.push_tokens           where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('push_tokens', v_n);

  delete from public.invitation_codes      where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('invitation_codes', v_n);

  -- Both directions: notifications the user received AND ones they triggered.
  delete from public.notifications
    where recipient_id = p_user_id or actor_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('notifications', v_n);

  -- Partner/vendor portal access grants (role stays on the profile, which goes
  -- away next; this row is the actual store permission).
  delete from public.partner_accounts      where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('partner_accounts', v_n);

  -- After star_ledger, which references submissions via source_submission_id.
  delete from public.submissions           where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('submissions', v_n);

  delete from public.profiles              where id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('profiles', v_n);

  if (v_counts->>'profiles')::bigint = 0 then
    raise warning 'delete_user_data: no profile row for % (already deleted?)', p_user_id;
  end if;

  -- Evidence trail for data-deletion requests (Postgres Logs in the dashboard).
  raise log 'delete_user_data: deleted user % -> %', p_user_id, v_counts;
end;
$$;

comment on function public.delete_user_data(uuid) is
  'Deletes every public-schema row owned by p_user_id, table by table, in one transaction. Callable only by service_role (the delete-account Edge Function) or by the account owner themselves. Does NOT delete auth.users or storage files -- the Edge Function does both, in that order, after this returns.';

commit;
