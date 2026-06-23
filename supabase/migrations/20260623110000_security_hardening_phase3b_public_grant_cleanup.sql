-- ============================================================================
-- Security hardening — F16 follow-up: the PUBLIC default EXECUTE grant.
--
-- The previous migration (20260623100000) did `revoke ... from anon` on the
-- login-required app RPCs. That was a NO-OP: Postgres grants EXECUTE to PUBLIC
-- by default, and `anon` inherits it via PUBLIC. So those RPCs were still
-- reachable by `anon` (linters 0028 kept firing). They don't *do* anything for
-- anon (auth.uid() is NULL → they no-op/error), but it's wrong hygiene.
--
-- Fix: revoke from PUBLIC (and anon explicitly) and grant only `authenticated`
-- + `service_role`. These RPCs already guard the caller via auth.uid().
--
-- Intentionally LEFT callable by anon (NOT touched here):
--   * is_admin / is_partner_for_store — RLS helper fns; anon/authenticated MUST
--     keep EXECUTE or policies referencing them break for those roles.
--   * resolve_referral_code — signup runs pre-login (anon).
--
-- Also drops the broad public-listing policy on the share-screenshots bucket
-- (linter 0025). Public object URLs keep working; only directory listing/
-- enumeration is removed.
--
-- DB-only. No app rebuild required.
-- ============================================================================

begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'complete_visit_task', 'get_user_favorites', 'get_store_favorite_count',
        'mark_voucher_fulfilled', 'record_daily_checkin', 'redeem_voucher',
        'toggle_favorite', 'trade_stars_for_progress'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- Remove broad SELECT/listing on the public share-screenshots bucket.
-- Object URLs remain accessible (public bucket); enumeration is removed.
drop policy if exists share_screenshots_public_read on storage.objects;

commit;
