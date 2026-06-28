-- 20260628120000_fix_account_deletion_fks.sql
--
-- Fix: account deletion fails with SQLSTATE 23503 (foreign_key_violation).
--
-- Root cause
-- ----------
-- Several foreign keys that reference public.profiles(id) were created with NO
-- explicit ON DELETE action, which in Postgres defaults to NO ACTION (RESTRICT).
-- When delete_user_data() (or an auth.users -> profiles cascade) deletes a
-- profile that is still referenced by another row, Postgres blocks the delete.
--
-- Observed production failure (delete-account Edge Function logs):
--   RPC public.delete_user_data error 23503
--   message: violates foreign key constraint "profiles_inviter_id_fkey"
--   details: Key (id)=(a224350a-...) is still referenced from table "profiles".
-- i.e. the user had invited at least one other user, so an invitee row still
-- carried invitee.inviter_id = <deleted user id>.
--
-- Fix
-- ---
-- Give every profile-referencing FK a deliberate ON DELETE action so deleting a
-- user can never violate them. inviter_id and reviewed_by are nullable, so
-- SET NULL is valid and non-destructive: invitees and reviewed submissions are
-- preserved; only the dangling link to the deleted user is cleared.

begin;

-- 1) Self-referential affiliate link (THE LIVE BUG).
--    Deleting an inviter must NOT delete the users they invited -- it must just
--    detach them (their account survives; they simply no longer have an inviter).
alter table public.profiles
  drop constraint if exists profiles_inviter_id_fkey;
alter table public.profiles
  add constraint profiles_inviter_id_fkey
  foreign key (inviter_id) references public.profiles(id) on delete set null;

-- 2) Submission reviewer link (latent blocker for reviewer/admin accounts).
--    reviewed_by points at the staff/admin profile that reviewed a submission
--    (AI auto-reviews use the dedicated wegood4u@gmail.com admin profile). With
--    NO ACTION, that reviewer/admin profile could never be deleted. Keep the
--    submission, clear the reviewer on delete.
alter table public.submissions
  drop constraint if exists submissions_reviewed_by_fkey;
alter table public.submissions
  add constraint submissions_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

-- 3) Notification actor/recipient links.
--    These currently only survive account deletion because delete_user_data()
--    manually removes the user's notifications BEFORE deleting the profile. Make
--    that guarantee structural so a notification can never block deletion even
--    if the function's manual cleanup is ever changed. A notification with no
--    valid actor/recipient is meaningless, so cascade-delete is correct.
alter table public.notifications
  drop constraint if exists fk_notifications_actor_profiles;
alter table public.notifications
  add constraint fk_notifications_actor_profiles
  foreign key (actor_id) references public.profiles(id) on delete cascade;

alter table public.notifications
  drop constraint if exists fk_notifications_recipient_profiles;
alter table public.notifications
  add constraint fk_notifications_recipient_profiles
  foreign key (recipient_id) references public.profiles(id) on delete cascade;

commit;
