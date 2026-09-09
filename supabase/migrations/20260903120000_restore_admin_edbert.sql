-- 20260903120000_restore_admin_edbert.sql
--
-- Restore the admin account that was lost when edbertjonnathan@gmail.com deleted
-- itself through the in-app "Delete Account" flow on 2026-09-03.
--
-- Context
-- -------
-- Deleting that profile left exactly ONE admin in the project (username 'Admin',
-- 11b60765-9911-4985-9cbf-0ba4d568303c -- the dedicated AI auto-review account),
-- whose credentials are not to hand. Since public.notify_on_submission_insert()
-- fans new-submission notifications out to every profile WHERE role = 'admin',
-- and app/admin/index.tsx gates the Admin Console on role === 'admin', the
-- project needs a real, sign-in-able admin again.
--
-- The auth user was recreated by hand in the dashboard (Authentication -> Users),
-- which fires handle_new_user() and therefore already created a profiles row --
-- but with username NULL (the dashboard sends no `username` in
-- raw_user_meta_data) and role 'subscriber' (the trigger hardcodes it). This
-- migration sets the username and promotes the role.
--
-- Why a migration and not a one-off UPDATE in the SQL editor
-- ---------------------------------------------------------
-- public.prevent_role_escalation (20260619140000_security_hardening_phase1.sql)
-- rejects ANY change to profiles.role unless the caller is service_role, is
-- already an admin, or sets the sanctioned transaction-local flag. A SQL editor
-- session is neither -- auth.role() and auth.uid() are both NULL there, so a
-- plain UPDATE raises 'Changing profile role is not permitted'. The flag below
-- is that migration's own documented escape hatch, and scoping it with
-- set_config(..., true) means it dies with this transaction.
--
-- Safety
-- ------
-- The uid is hardcoded, so this file is a no-op on any database that does not
-- have that exact account (local dev, preview branches). It also refuses to run
-- if the uid belongs to a different email than expected, so a stale/copy-pasted
-- uid can never promote the wrong person to admin.
--
-- NOTE: profiles.full_name is intentionally left NULL, matching every account
-- created through normal signup (handle_new_user only writes username). The
-- notifications screen resolves an actor as full_name -> username -> 'Someone',
-- so this account still renders as "admin edbert".
--
-- VERIFY:
--   select id, username, role from public.profiles where role = 'admin';
--   -- expect 2 rows: 'Admin' and 'admin edbert'

begin;

do $$
declare
  v_uid        uuid := '70b5a604-6caf-47ad-8a6a-8774c85f97e5';
  v_email      text := 'edbertjonnathan@gmail.com';
  v_username   text := 'admin edbert';
  v_auth_email text;
  v_clash      uuid;
begin
  select u.email into v_auth_email from auth.users u where u.id = v_uid;

  if v_auth_email is null then
    raise notice 'restore_admin_edbert: no auth.users row for % on this database -- skipping', v_uid;
    return;
  end if;

  if lower(v_auth_email) is distinct from lower(v_email) then
    raise exception 'restore_admin_edbert: uid % belongs to %, expected % -- refusing to promote the wrong account',
      v_uid, v_auth_email, v_email;
  end if;

  -- profiles_username_key is UNIQUE; fail loudly rather than aborting on the
  -- constraint with an opaque duplicate-key error.
  select p.id into v_clash
    from public.profiles p
   where p.username = v_username
     and p.id <> v_uid;

  if v_clash is not null then
    raise exception 'restore_admin_edbert: username % is already used by profile %', v_username, v_clash;
  end if;

  -- Transaction-local permission to change profiles.role (see header).
  perform set_config('app.role_change_ok', '1', true);

  insert into public.profiles (id, username, role, avatar_url)
  values (
    v_uid,
    v_username,
    'admin'::public.user_role,
    'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/others/default.png'
  )
  on conflict (id) do update
     set username   = excluded.username,
         role       = excluded.role,
         updated_at = now();
  -- avatar_url deliberately not in the DO UPDATE list: if the account already
  -- picked a picture, keep it.

  raise log 'restore_admin_edbert: % (%) is now admin with username %', v_email, v_uid, v_username;
end;
$$;

commit;
