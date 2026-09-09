-- get_store_content_trend — per-store daily cumulative-views source for the Vendors
-- Content page's "cumulative views" chart + month-over-month delta.
--
-- Plan:   .claude/plans/09_09_vendors-content-analytics-mapping.plan.md  (Phase 1)
-- Guards: reviewed with supabase-rls-guard (2026-09-09). Mirrors the definer-predicate
--         pattern of public.partner_visits_view (20260903130000).
--
-- WHY A DEFINER FUNCTION (not a broad RLS policy on post_snapshots):
--   post_snapshots has RLS ENABLED but NO read policy, so authenticated callers read
--   ZERO rows from it directly (deny-by-default). Rather than open a table-wide policy
--   on raw daily telemetry, this function is the ONE controlled read path. It runs as
--   its owner (postgres) so it can read post_snapshots + all_social_posts, and contains
--   the exposure with an in-body predicate:
--       is_partner_for_store(_store_id)  OR  is_admin(auth.uid())
--   A partner gets only a store they actually own (is_partner_for_store checks the
--   caller against the PASSED id, so passing someone else's id still returns nothing);
--   an admin gets any store. auth.uid() resolves per-request under PostgREST even in a
--   definer function, so the predicate gates the REAL caller, not the owner.
--
-- SCOPE: aggregates only (date + summed views) — no PII, no per-user rows. Counts only
--   'assigned' posts on the 3 supported platforms (facebook excluded by decision).
--
-- Dependencies verified present in remote schema (20260604102515_remote_schema.sql):
--   public.is_admin(uuid), public.is_partner_for_store(text),
--   all_social_posts(id, partner_store_id, platform, curation_status),
--   post_snapshots(post_id, snapshot_date, views).

begin;

create or replace function public.get_store_content_trend(
  _store_id text,
  _days int default 30
)
returns table (snapshot_date date, total_views bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.snapshot_date,
         coalesce(sum(d.views), 0)::bigint as total_views
    from public.post_snapshots d
    join public.all_social_posts p on p.id = d.post_id
   where p.partner_store_id = _store_id
     and p.curation_status = 'assigned'
     and p.platform in ('youtube', 'tiktok', 'instagram')
     and d.snapshot_date >= (current_date - greatest(_days, 0))
     and ( public.is_partner_for_store(_store_id)
           or (select public.is_admin(auth.uid())) )
   group by d.snapshot_date
   order by d.snapshot_date;
$$;

alter function public.get_store_content_trend(text, int) owner to postgres;

-- anon must NEVER read store telemetry; authenticated callers are gated in-body.
revoke all    on function public.get_store_content_trend(text, int) from anon, public;
grant  execute on function public.get_store_content_trend(text, int) to authenticated, service_role;

comment on function public.get_store_content_trend(text, int) is
  'Daily cumulative views for a partner store''s assigned social posts (youtube/tiktok/instagram), last _days. SECURITY DEFINER with in-body is_partner_for_store/is_admin gate — the controlled read path over post_snapshots (which has RLS on, no read policy). Feeds the Vendors Content trend chart + M-o-M.';

commit;
