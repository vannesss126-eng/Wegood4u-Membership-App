-- 20260909130000_seed_store_content.sql
--
-- Seed realistic social-content analytics for the 6 test stores so the Vendors
-- Content page renders real data (Phase 2 of the content feature).
--   Plan: .claude/plans/09_09_vendors-content-feature.plan.md
--
-- Produces per store: 3 YouTube + 4 TikTok + 3 Instagram = 10 assigned posts, with
-- YouTube carrying the highest views-per-video so it LEADS total reach (matches the
-- page's "long-form earns sustained discovery" narrative). Facebook excluded.
--
-- Also generates up to 90 daily post_snapshots per post (the retention window) with a
-- saturating ln-growth curve — fast early, slowing — whose LAST day equals the post's
-- current_views exactly, so the trend chart, month-over-month, and the KPI totals all
-- reconcile. Snapshots are anchored to current_date, so the chart always shows the
-- most recent 90 days ending "today" regardless of when this is pushed.
--
-- Deterministic ids (900000000+) + platform_post_id 'seed-%' make it safe to re-run:
-- the seed rows are deleted first (FK cascade clears their snapshots) then rebuilt.
--
-- VERIFY:
--   select partner_store_id, platform, count(*), sum(current_views)
--     from public.all_social_posts where platform_post_id like 'seed-%'
--     group by 1,2 order by 1,2;
--   select count(*) from public.post_snapshots
--     where post_id in (select id from public.all_social_posts where platform_post_id like 'seed-%');

begin;

-- Idempotent reset: remove any prior seed posts; ON DELETE CASCADE drops their snapshots.
delete from public.all_social_posts where platform_post_id like 'seed-%';

-- 1) Posts.
do $$
declare
  v_stores text[][] := array[
    array['mee-rebus-haji-wajid','Mee Rebus Haji Wajid'],
    array['fatt-kee-roast-fish','Fatt Kee Roast Fish'],
    array['sunsan-bake','Sunsan Bake'],
    array['kanom-jeen-san-pa-khoi','Kanom Jeen San Pa Khoi'],
    array['forest-bake','Forest Bake'],
    array['ohkajhu-sansai','Ohkajhu Organic Farm Sansai']
  ];
  v_platforms text[] := array['youtube','tiktok','instagram'];
  v_counts    int[]  := array[3, 4, 3];
  v_vmin      int[]  := array[12000, 3000, 1500];
  v_vspan     int[]  := array[58000, 22000, 10500];
  v_lrate     numeric[] := array[0.025, 0.060, 0.050];
  -- title flavours per platform (cycled by post index)
  v_yt text[] := array['Full tour & tasting at %s','We tried everything at %s','Why locals love %s','%s — the honest review'];
  v_tt text[] := array['%s in 60 seconds','POV: first bite at %s','You NEED to try %s','%s hidden gem'];
  v_ig text[] := array['Reels: best bites at %s','A morning at %s','%s aesthetic','Saved you a seat at %s'];
  v_titles text[];
  s_idx int; p_idx int; k int;
  v_store_id text; v_store_name text; v_platform text;
  v_id bigint; v_ppid text; v_views bigint; v_likes bigint;
  v_posted timestamptz; v_url text; v_title text;
begin
  perform setseed(0.42);
  for s_idx in 1 .. array_length(v_stores, 1) loop
    v_store_id   := v_stores[s_idx][1];
    v_store_name := v_stores[s_idx][2];
    for k in 1 .. array_length(v_platforms, 1) loop
      v_platform := v_platforms[k];
      v_titles := case v_platform when 'youtube' then v_yt when 'tiktok' then v_tt else v_ig end;
      for p_idx in 1 .. v_counts[k] loop
        -- deterministic id: 9e8 + store*1000 + platform*100 + post
        v_id    := 900000000 + s_idx * 1000 + k * 100 + p_idx;
        v_ppid  := 'seed-' || v_id;
        v_views := v_vmin[k] + floor(random() * v_vspan[k])::bigint;
        v_likes := round(v_views * v_lrate[k] * (0.8 + random() * 0.4))::bigint;
        v_posted := timestamptz '2026-05-01 10:00:00+08'
                    + (floor(random() * 116))::int * interval '1 day'
                    + (floor(random() * 12))::int * interval '1 hour';
        v_title := format(v_titles[1 + (p_idx % array_length(v_titles, 1))], v_store_name);
        v_url := case v_platform
                   when 'youtube'   then 'https://www.youtube.com/watch?v=' || v_ppid
                   when 'tiktok'    then 'https://www.tiktok.com/@wegood4u/video/' || v_id
                   else                  'https://www.instagram.com/reel/' || v_ppid || '/'
                 end;
        insert into public.all_social_posts
          (id, platform, platform_post_id, url, title, thumbnail_url, posted_at,
           partner_store_id, curation_status, assigned_at, assigned_by,
           current_views, current_likes, last_updated, created_at, updated_at)
        values
          (v_id, v_platform, v_ppid, v_url, v_title, null, v_posted,
           v_store_id, 'assigned', v_posted, null,
           v_views, v_likes, now(), v_posted, now());
      end loop;
    end loop;
  end loop;
end $$;

-- 2) Daily snapshots (≤90 days) — saturating ln-growth; last day == current_views.
insert into public.post_snapshots (post_id, snapshot_date, views, likes, captured_at)
select
  p.id,
  gs::date as snapshot_date,
  round(p.current_views
        * ln(1 + (gs::date - p.posted_at::date))
        / ln(1 + greatest(current_date - p.posted_at::date, 1)))::bigint as views,
  round(p.current_likes
        * ln(1 + (gs::date - p.posted_at::date))
        / ln(1 + greatest(current_date - p.posted_at::date, 1)))::bigint as likes,
  gs::date + time '23:30' as captured_at
from public.all_social_posts p
cross join lateral generate_series(
    greatest(p.posted_at::date, current_date - 89),
    current_date,
    interval '1 day') gs
where p.platform_post_id like 'seed-%';

commit;
