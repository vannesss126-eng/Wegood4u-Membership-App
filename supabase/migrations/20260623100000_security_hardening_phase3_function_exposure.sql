-- ============================================================================
-- Security hardening — F16: SECURITY DEFINER functions over-exposed via REST RPC
-- Surfaced by Supabase linters 0028/0029 (anon/authenticated can execute).
--
-- CRITICAL: internal helpers like _award_stars(p_user_id, p_delta, ...) had NO
-- caller check and were GRANTed to anon → anyone with the public key could mint
-- unlimited stars/vouchers (reward fraud). They are only ever meant to be called
-- internally (by other SECURITY DEFINER functions, which run as the table owner)
-- or by the service role — never directly from the API.
--
-- App-called RPCs (record_daily_checkin, redeem_voucher, mark_voucher_fulfilled,
-- toggle_favorite, etc.) already verify the caller via auth.uid()/is_admin and
-- KEEP their `authenticated` grant — we only drop their `anon` grant. is_admin,
-- is_partner_for_store (RLS helpers) and resolve_referral_code (signup) are left
-- as-is. This migration is DB-only and does NOT require an app rebuild.
-- ============================================================================

begin;

-- 1) All trigger functions: never callable from the API. (Trigger execution
--    does NOT depend on EXECUTE grants, so this is safe.)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 2) Internal helpers + maintenance functions: service_role only (kept via its
--    own explicit grant). The exploitable ones (_award_stars, _apply_real_visit,
--    _get_or_open_active_cycle) are here. Internal definer callers run as owner,
--    so the app's reward chain is unaffected.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_award_stars', '_apply_real_visit', '_get_or_open_active_cycle',
        'mint_voucher_on_visit_levelup', 'cleanup_old_snapshots'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 3) Login-required app RPCs: drop anon, keep authenticated + service_role.
--    (These already guard the caller via auth.uid()/is_admin internally.)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'complete_visit_task', 'get_user_activity', 'get_user_favorites',
        'mark_voucher_fulfilled', 'record_daily_checkin', 'redeem_voucher',
        'toggle_favorite', 'trade_stars_for_progress', 'get_store_favorite_count'
      )
  loop
    execute format('revoke all on function %s from anon', r.sig);
  end loop;
end $$;

-- 4) Pin search_path on any remaining public functions missing it (linter 0011).
--    'public, extensions' is a safe superset for this app.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = ''public'', ''extensions''', r.sig);
  end loop;
end $$;

commit;
