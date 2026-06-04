

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."badge_category" AS ENUM (
    'activity',
    'cafe',
    'restaurant',
    'bar',
    'hotel'
);


ALTER TYPE "public"."badge_category" OWNER TO "postgres";


CREATE TYPE "public"."communication_channel" AS ENUM (
    'WhatsApp',
    'Telegram',
    'Line',
    'WeChat'
);


ALTER TYPE "public"."communication_channel" OWNER TO "postgres";


CREATE TYPE "public"."store_category" AS ENUM (
    'cafe',
    'restaurant',
    'others',
    'bar',
    'hotel'
);


ALTER TYPE "public"."store_category" OWNER TO "postgres";


CREATE TYPE "public"."submission_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."submission_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'subscriber',
    'member',
    'affiliate',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
BEGIN
  v_cycle_id := public._get_or_open_active_cycle(p_user_id);

  -- Cap at 10 — should never overflow but defensive.
  UPDATE public.visit_progress
  SET real_visits = LEAST(real_visits + 1, 10)
  WHERE cycle_id = v_cycle_id;
END;
$$;


ALTER FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_award_stars"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source_submission_id" bigint DEFAULT NULL::bigint, "p_source_referral_user_id" "uuid" DEFAULT NULL::"uuid", "p_source_checkin_id" bigint DEFAULT NULL::bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inserted_id bigint;
BEGIN
  IF p_delta <= 0 THEN
    RAISE EXCEPTION '_award_stars expects positive delta_stars; got %', p_delta;
  END IF;

  -- Insert ledger row. ON CONFLICT DO NOTHING covers the unique partial indexes.
  INSERT INTO public.star_ledger (
    user_id, delta_stars, reason,
    source_submission_id, source_referral_user_id, source_checkin_id
  )
  VALUES (
    p_user_id, p_delta, p_reason,
    p_source_submission_id, p_source_referral_user_id, p_source_checkin_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Idempotent skip — already awarded. No wallet update.
    RETURN false;
  END IF;

  -- Update wallet under row-level lock (UPSERT pattern).
  INSERT INTO public.star_wallet (user_id, balance, updated_at)
  VALUES (p_user_id, p_delta, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.star_wallet.balance + p_delta,
        updated_at = now();

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."_award_stars"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source_submission_id" bigint, "p_source_referral_user_id" "uuid", "p_source_checkin_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
BEGIN
  SELECT cycle_id INTO v_cycle_id
  FROM public.visit_progress
  WHERE user_id = p_user_id AND closed_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NOT NULL THEN
    RETURN v_cycle_id;
  END IF;

  -- Open a new cycle. The unique partial index "visit_progress_one_open_per_user"
  -- prevents two-races from creating two open cycles.
  INSERT INTO public.visit_progress (user_id)
  VALUES (p_user_id)
  RETURNING cycle_id INTO v_cycle_id;

  RETURN v_cycle_id;
END;
$$;


ALTER FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  acc numeric := 0;
  i int;
  b int;
  res text := '';
BEGIN
  FOR i IN 0 .. length(input)-1 LOOP
    b := get_byte(input, i);
    acc := acc * 256 + b;
  END LOOP;

  IF acc = 0 THEN
    txt := substring(alphabet from 1 for 1);
    RETURN;
  END IF;

  WHILE acc > 0 LOOP
    res := substring(alphabet from ( (acc % 62)::int ) + 1 for 1) || res;
    acc := floor(acc / 62);
  END LOOP;

  txt := res;
END;
$$;


ALTER FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer) RETURNS TABLE("tier" "text", "level" integer)
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF p_completed_cycles <= 0 THEN
    RETURN;  -- empty result = no badge yet
  ELSIF p_completed_cycles = 1 THEN
    RETURN QUERY SELECT 'bronze'::text, 1;
  ELSIF p_completed_cycles = 2 THEN
    RETURN QUERY SELECT 'bronze'::text, 2;
  ELSIF p_completed_cycles <= 4 THEN
    RETURN QUERY SELECT 'bronze'::text, 3;
  ELSIF p_completed_cycles <= 6 THEN
    RETURN QUERY SELECT 'silver'::text, 1;
  ELSIF p_completed_cycles <= 9 THEN
    RETURN QUERY SELECT 'silver'::text, 2;
  ELSIF p_completed_cycles <= 14 THEN
    RETURN QUERY SELECT 'silver'::text, 3;
  ELSIF p_completed_cycles <= 19 THEN
    RETURN QUERY SELECT 'gold'::text, 1;
  ELSIF p_completed_cycles <= 26 THEN
    RETURN QUERY SELECT 'gold'::text, 2;
  ELSIF p_completed_cycles <= 34 THEN
    RETURN QUERY SELECT 'gold'::text, 3;
  ELSIF p_completed_cycles <= 39 THEN
    RETURN QUERY SELECT 'platinum'::text, 1;
  ELSIF p_completed_cycles <= 44 THEN
    RETURN QUERY SELECT 'platinum'::text, 2;
  ELSE
    RETURN QUERY SELECT 'platinum'::text, 3;
  END IF;
END;
$$;


ALTER FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  CASE p_tier
    WHEN 'bronze'   THEN RETURN 'airbnb_3star';
    WHEN 'silver'   THEN RETURN 'hotel_3_4star';
    WHEN 'gold'     THEN RETURN 'hotel_4_5star';
    WHEN 'platinum' THEN RETURN 'specialty_5star_resort';
    ELSE RAISE EXCEPTION 'Unknown tier: %', p_tier;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."all_social_posts_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."all_social_posts_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_statements_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."billing_statements_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_snapshots"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM "public"."post_snapshots"
      WHERE "snapshot_date" < (CURRENT_DATE - INTERVAL '90 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_snapshots"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_snapshots"() IS 'Deletes post_snapshots older than 90 days. Returns count of deleted rows. Called by the polling Edge Function after each daily write.';



CREATE OR REPLACE FUNCTION "public"."complete_visit_task"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_cycle_id uuid;
  v_real_visits int;
  v_extras_applied int;
  v_completed_cycles int;
  v_inserted_badge_ids bigint[];
  v_voucher_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock active cycle.
  SELECT cycle_id, real_visits, extras_applied
    INTO v_cycle_id, v_real_visits, v_extras_applied
  FROM public.visit_progress
  WHERE user_id = v_user_id AND closed_at IS NULL
  FOR UPDATE;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'No active cycle';
  END IF;

  IF (v_real_visits + v_extras_applied) < 10 THEN
    RAISE EXCEPTION 'Cycle not yet at 10/10 (have %)', (v_real_visits + v_extras_applied);
  END IF;

  -- Close the active cycle first so the level evaluation reflects the new state.
  UPDATE public.visit_progress
  SET closed_at = now()
  WHERE cycle_id = v_cycle_id;

  SELECT count(*) INTO v_completed_cycles
  FROM public.visit_progress
  WHERE user_id = v_user_id AND closed_at IS NOT NULL;

  -- Open new cycle (idempotent; the unique partial index protects against races).
  PERFORM public._get_or_open_active_cycle(v_user_id);

  -- Visit Badge level evaluation: insert any newly-unlocked Visit Badge rows.
  -- Each insert fires trg_mint_voucher_on_visit_levelup which writes a voucher.
  WITH new_levels AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT v_user_id, b.id
    FROM public.badges b
    WHERE b.is_active = true
      AND b.badge_kind = 'visit'
      AND b.required_count <= v_completed_cycles
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id
  )
  SELECT array_agg(badge_id) INTO v_inserted_badge_ids FROM new_levels;

  -- If any level crossed, fetch the voucher just minted by the trigger.
  IF v_inserted_badge_ids IS NOT NULL AND array_length(v_inserted_badge_ids, 1) > 0 THEN
    SELECT id INTO v_voucher_id
    FROM public.vouchers
    WHERE user_id = v_user_id
      AND earned_from_badge_id = ANY (v_inserted_badge_ids)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_voucher_id;  -- NULL when this cycle close did not cross a Visit Badge level
END;
$$;


ALTER FUNCTION "public"."complete_visit_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_data"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
  -- Delete dependent records first
  DELETE FROM public."submissions"       WHERE user_id = p_user_id;
  DELETE FROM public."notifications"     WHERE recipient_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM public."user_badges"      WHERE user_id = p_user_id;
  DELETE FROM public."invitation_codes" WHERE user_id = p_user_id;
  DELETE FROM public."push_tokens"      WHERE user_id = p_user_id;

  -- Finally delete the profile
  DELETE FROM public."profiles"         WHERE id = p_user_id;
END;$$;


ALTER FUNCTION "public"."delete_user_data"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_store_stats"("_partner_store_id" "text") RETURNS TABLE("total_posts" bigint, "total_views" bigint, "total_likes" bigint, "youtube_views" bigint, "instagram_views" bigint, "tiktok_views" bigint, "facebook_views" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    count(*)::bigint AS total_posts,
    COALESCE(sum("current_views"), 0)::bigint AS total_views,
    COALESCE(sum("current_likes"), 0)::bigint AS total_likes,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'youtube'), 0)::bigint AS youtube_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'instagram'), 0)::bigint AS instagram_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'tiktok'), 0)::bigint AS tiktok_views,
    COALESCE(sum("current_views") FILTER (WHERE "platform" = 'facebook'), 0)::bigint AS facebook_views
  FROM "public"."all_social_posts"
  WHERE "partner_store_id" = _partner_store_id
    AND "curation_status" = 'assigned';
$$;


ALTER FUNCTION "public"."get_store_stats"("_partner_store_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_store_stats"("_partner_store_id" "text") IS 'Aggregated content stats for a partner store. Excludes pending/general/skipped posts. RLS still applies via SECURITY INVOKER — caller only sees stats for stores they have permission to read.';



CREATE OR REPLACE FUNCTION "public"."get_user_activity"("p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0) RETURNS TABLE("event_type" "text", "event_at" timestamp with time zone, "target" "text", "metadata" "jsonb", "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'get_user_activity requires an authenticated session';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'get_user_activity: p_limit must be between 1 and 100 (got %)', p_limit;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'get_user_activity: p_offset must be >= 0';
  END IF;

  RETURN QUERY
  WITH events AS (
    -- 1. Submissions approved / rejected
    SELECT
      ('submission_' || s.status)::text                   AS event_type,
      COALESCE(s.reviewed_at, s.updated_at, s.created_at) AS event_at,
      s.partner_store_name                                AS target,
      jsonb_build_object(
        'submission_id',         s.id,
        'status',                s.status,
        'category',              s.partner_store_category,
        'counts_for_visit_10',
          (s.status = 'approved'
           AND s.partner_store_category IN ('restaurant','cafe','bar'))
      )                                                   AS metadata
    FROM public.submissions s
    WHERE s.user_id = v_user_id
      AND s.status IN ('approved','rejected')

    UNION ALL

    -- 2a. Per-platform verified social shares (+15 stars each)
    SELECT
      'share_verified'::text                              AS event_type,
      ss.verified_at                                      AS event_at,
      ('Shared ' || COALESCE(s.partner_store_name, 'visit')
                 || ' on ' || INITCAP(ss.platform))::text AS target,
      jsonb_build_object(
        'share_id',           ss.id,
        'submission_id',      ss.submission_id,
        'platform',           ss.platform,
        'partner_store_name', s.partner_store_name,
        'stars_awarded',      15,
        'bonus',              false
      )                                                   AS metadata
    FROM public.submission_shares ss
    JOIN public.submissions s ON s.id = ss.submission_id
    WHERE ss.user_id = v_user_id
      AND ss.status  = 'verified'

    UNION ALL

    -- 2b. All-three platforms bonus (+5 stars), surfaced as its own row
    SELECT
      'share_verified'::text                              AS event_type,
      sl.created_at                                       AS event_at,
      'All-three platform bonus'::text                    AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'submission_id', sl.source_submission_id,
        'stars_awarded', sl.delta_stars,
        'bonus',         true
      )                                                   AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'share_all_three_bonus'

    UNION ALL

    -- 3. Daily streak milestone (every 14-day boundary)
    SELECT
      'daily_streak_milestone'::text                                            AS event_type,
      sl.created_at                                                             AS event_at,
      ((ROW_NUMBER() OVER (PARTITION BY sl.user_id ORDER BY sl.id)) * 14
        || '-day streak completed')::text                                       AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'streak_days',   (ROW_NUMBER() OVER (PARTITION BY sl.user_id ORDER BY sl.id)) * 14,
        'stars_awarded', sl.delta_stars
      )                                                                         AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'daily_streak_14'

    UNION ALL

    -- 4. Referral qualified (L1/L2 inviter-side awards only — self-bonus excluded)
    SELECT
      'referral_qualified'::text                                                AS event_type,
      sl.created_at                                                             AS event_at,
      (COALESCE(NULLIF(p.full_name, ''), 'Invitee')
        || ' qualified ('
        || CASE sl.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END
        || ')')::text                                                           AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'level',         CASE sl.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END,
        'invitee_id',    sl.source_referral_user_id,
        'invitee_name',  p.full_name,
        'stars_awarded', sl.delta_stars
      )                                                                         AS metadata
    FROM public.star_ledger sl
    LEFT JOIN public.profiles p ON p.id = sl.source_referral_user_id
    WHERE sl.user_id = v_user_id
      AND sl.reason IN ('l1_referral','l2_referral')

    UNION ALL

    -- 5. Manual stars → Visit 10 progress trade
    SELECT
      'stars_converted'::text                             AS event_type,
      sl.created_at                                       AS event_at,
      'Stars → Visit 10 progress'::text                   AS target,
      jsonb_build_object(
        'ledger_id',      sl.id,
        'cycle_id',       sl.cycle_id,
        'stars_consumed', ABS(sl.delta_stars),
        'progress_added', 1
      )                                                   AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'conversion_to_progress'

    UNION ALL

    -- 6. Cycle completed (10/10 → user tapped Complete Tasks → voucher minted)
    SELECT
      'cycle_completed'::text                             AS event_type,
      vp.closed_at                                        AS event_at,
      'Visit 10 Task completed'::text                     AS target,
      jsonb_build_object(
        'cycle_id',       vp.cycle_id,
        'opened_at',      vp.opened_at,
        'closed_at',      vp.closed_at,
        'real_visits',    vp.real_visits,
        'extras_applied', vp.extras_applied
      )                                                   AS metadata
    FROM public.visit_progress vp
    WHERE vp.user_id  = v_user_id
      AND vp.closed_at IS NOT NULL

    UNION ALL

    -- 7. Visit Badge earned (driven by completed cycles)
    SELECT
      'visit_badge_earned'::text                                                AS event_type,
      ub.earned_at                                                              AS event_at,
      ('Visit Badge — ' || INITCAP(b.tier) || ' L' || b.level)::text            AS target,
      jsonb_build_object(
        'badge_id',   ub.badge_id,
        'tier',       b.tier,
        'level',      b.level,
        'badge_kind', 'visit'
      )                                                                         AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id   = v_user_id
      AND b.badge_kind = 'visit'

    UNION ALL

    -- 8. Category Badge earned (per-category R/C/B/H)
    SELECT
      'category_badge_earned'::text                                             AS event_type,
      ub.earned_at                                                              AS event_at,
      (INITCAP(b.badge_kind) || ' Badge — ' || INITCAP(b.tier)
        || ' L' || b.level)::text                                               AS target,
      jsonb_build_object(
        'badge_id',       ub.badge_id,
        'badge_kind',     b.badge_kind,
        'tier',           b.tier,
        'level',          b.level,
        'required_count', b.required_count
      )                                                                         AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id    = v_user_id
      AND b.badge_kind IN ('cafe','bar','restaurant','hotel')

    UNION ALL

    -- 9. Voucher redemption requested (admin fulfills out-of-band in v1)
    SELECT
      'voucher_redemption_requested'::text                                      AS event_type,
      v.redeemed_at                                                             AS event_at,
      ('Requested ' || replace(v.reward_kind, '_', ' ') || ' voucher')::text    AS target,
      jsonb_build_object(
        'voucher_id',  v.id,
        'badge_kind',  v.badge_kind,
        'tier',        v.tier,
        'level',       v.level,
        'reward_kind', v.reward_kind
      )                                                                         AS metadata
    FROM public.vouchers v
    WHERE v.user_id     = v_user_id
      AND v.redeemed_at IS NOT NULL
  ),
  filtered AS (
    SELECT
      e.event_type,
      e.event_at,
      e.target,
      e.metadata
    FROM events e
    WHERE e.event_at IS NOT NULL
  )
  SELECT
    f.event_type,
    f.event_at,
    f.target,
    f.metadata,
    COUNT(*) OVER ()::bigint AS total_count
  FROM filtered f
  ORDER BY f.event_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) IS 'Paginated unified activity feed for the calling user. v2 covers the stars + Visit 10 event vocabulary. See documentation/history-feed.md.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    role,
    dob,
    gender,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    'subscriber',
    (NEW.raw_user_meta_data ->> 'dob')::date,          -- cast to DATE
    NEW.raw_user_meta_data ->> 'gender',               -- stored as tex
    'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/others/default.png'
  );
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_invitation_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.inviter_id IS NOT NULL THEN
    UPDATE public.invitation_codes 
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE user_id = NEW.inviter_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_invitation_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT role = 'admin'::user_role
  FROM public.profiles
  WHERE id = p_uid;
$$;


ALTER FUNCTION "public"."is_admin"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."partner_accounts"
    WHERE "user_id" = (SELECT auth.uid())
      AND "partner_store_id" = _partner_store_id
  );
$$;


ALTER FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") IS 'Returns true if the current authenticated user is linked to the given partner_store_id via partner_accounts.';



CREATE OR REPLACE FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_voucher record;
BEGIN
  v_admin_id := (SELECT auth.uid());
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  SELECT id, redeemed_at, fulfilled_at
    INTO v_voucher
  FROM public.vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_voucher.redeemed_at IS NULL THEN
    -- Can't fulfill what hasn't been requested.
    RETURN jsonb_build_object('success', false, 'reason', 'not_redeemed');
  END IF;

  IF v_voucher.fulfilled_at IS NOT NULL THEN
    -- Idempotent.
    RETURN jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'fulfilled_at', v_voucher.fulfilled_at
    );
  END IF;

  UPDATE public.vouchers
  SET fulfilled_at = now()
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_fulfilled', false,
    'fulfilled_at', now()
  );
END;
$$;


ALTER FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mint_voucher_on_visit_levelup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_kind text;
  v_tier text;
  v_level int;
  v_reward_kind text;
BEGIN
  -- Filter to Visit Badges. Category Badge inserts cost one row read each,
  -- which is acceptable for the volume.
  SELECT b.badge_kind, b.tier, b.level
    INTO v_kind, v_tier, v_level
  FROM public.badges b
  WHERE b.id = NEW.badge_id;

  IF v_kind IS DISTINCT FROM 'visit' THEN
    RETURN NEW;
  END IF;

  IF v_tier IS NULL THEN
    -- Legacy seed row with no tier — skip silently.
    RETURN NEW;
  END IF;

  v_reward_kind := public._voucher_kind_for_tier(v_tier);

  INSERT INTO public.vouchers (
    user_id,
    badge_kind,
    tier,
    level,
    reward_kind,
    earned_from_badge_id
  ) VALUES (
    NEW.user_id,
    'visit',
    v_tier,
    v_level,
    v_reward_kind,
    NEW.badge_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't let a voucher-mint failure block the underlying badge award.
  RAISE WARNING 'mint_voucher_on_visit_levelup failed for user_badges %: %', NEW, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mint_voucher_on_visit_levelup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_badge_earned"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_badge_name text;
BEGIN
  SELECT name INTO v_badge_name FROM public.badges WHERE id = NEW.badge_id;

  INSERT INTO public.notifications (recipient_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    'badge_earned',
    'badge',
    NEW.badge_id::text,
    jsonb_build_object('badge_name', v_badge_name, 'earned_at', NEW.earned_at)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'badge-earned notification failed for user % badge %: %',
    NEW.user_id, NEW.badge_id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_badge_earned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_referral_qualified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invitee_name text;
BEGIN
  IF NEW.reason NOT IN ('l1_referral','l2_referral') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Invitee')
    INTO v_invitee_name
  FROM public.profiles
  WHERE id = NEW.source_referral_user_id;

  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    NEW.source_referral_user_id,
    'referral_qualified',
    'referral',
    NEW.id::text,
    jsonb_build_object(
      'level',         CASE NEW.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END,
      'invitee_id',    NEW.source_referral_user_id,
      'invitee_name',  v_invitee_name,
      'stars_awarded', NEW.delta_stars
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'referral-qualified notification failed for ledger %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_referral_qualified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_share_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_store_name text;
BEGIN
  IF NEW.status != 'verified' OR (OLD.status IS NOT DISTINCT FROM 'verified') THEN
    RETURN NEW;
  END IF;

  SELECT partner_store_name INTO v_store_name
  FROM public.submissions
  WHERE id = NEW.submission_id;

  INSERT INTO public.notifications (recipient_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    'share_verified',
    'share',
    NEW.id::text,
    jsonb_build_object(
      'platform',           NEW.platform,
      'submission_id',      NEW.submission_id,
      'partner_store_name', v_store_name,
      'stars_awarded',      15
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'share-verified notification failed for share %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_share_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_submission_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Only notify when created (status default 'pending') and user is a 'member'
  IF (NEW.status = 'pending') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
    SELECT p.id AS recipient_id,
           NEW.user_id AS actor_id,
           'submission_created' AS action,
           'submission' AS object_type,
           NEW.id::text AS object_id,
           jsonb_build_object('submission', to_jsonb(NEW)) AS data
    FROM public.profiles p
    WHERE p.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_submission_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_submission_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- only notify when changed to approved or rejected
    IF (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
      INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
      VALUES (
        NEW.user_id, -- recipient is the submission owner
        NEW.reviewed_by, -- actor is the admin who reviewed
        CASE WHEN NEW.status = 'approved' THEN 'submission_approved' ELSE 'submission_rejected' END,
        'submission',
        NEW.id::text,
        jsonb_build_object('status', NEW.status, 'admin_notes', NEW.admin_notes, 'reviewed_at', NEW.reviewed_at)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_submission_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_voucher_redemption_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_data jsonb;
BEGIN
  v_data := jsonb_build_object(
    'voucher_id',  NEW.id,
    'badge_kind',  NEW.badge_kind,
    'tier',        NEW.tier,
    'level',       NEW.level,
    'reward_kind', NEW.reward_kind,
    'redeemed_at', NEW.redeemed_at
  );

  -- 1. Receipt to the requesting user.
  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    'voucher_redemption_requested',
    'voucher',
    NEW.id::text,
    v_data
  );

  -- 2. Admin alert — one row per admin, drives manual fulfillment queue.
  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  SELECT p.id,
         NEW.user_id,
         'voucher_redemption_admin_alert',
         'voucher',
         NEW.id::text,
         v_data
  FROM public.profiles p
  WHERE p.role = 'admin';

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_voucher_redemption_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."oauth_tokens_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."oauth_tokens_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_submission_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := NEW.user_id;
  v_category store_category := NEW.partner_store_category;
  v_was_first_approval boolean;
  v_inviter_id uuid;
  v_grandparent_id uuid;
  v_category_count int;
BEGIN
  -- Only act on transitions to 'approved'.
  IF NEW.status != 'approved' OR (OLD.status IS NOT DISTINCT FROM 'approved') THEN
    RETURN NEW;
  END IF;

  -- 1. Backfill profiles.first_approved_submission_at if not set.
  --    We use this both for downstream queries and to detect "is this the user's
  --    first ever approval?" without an extra query.
  UPDATE public.profiles
  SET first_approved_submission_at = now()
  WHERE id = v_user_id AND first_approved_submission_at IS NULL;

  v_was_first_approval := FOUND;  -- true iff the UPDATE actually wrote a row

  -- 2. R/C/B submissions advance the active Visit 10 cycle. Hotel does not.
  IF v_category IN ('restaurant', 'cafe', 'bar') THEN
    PERFORM public._apply_real_visit(v_user_id);
  END IF;

  -- 3. Category Badge threshold evaluation (all 4 v1 categories: R/C/B/Hotel).
  IF v_category IN ('restaurant', 'cafe', 'bar', 'hotel') THEN
    SELECT count(*) INTO v_category_count
    FROM public.submissions
    WHERE user_id = v_user_id
      AND status = 'approved'
      AND partner_store_category = v_category;

    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT v_user_id, b.id
    FROM public.badges b
    WHERE b.is_active = true
      AND b.badge_kind = v_category::text
      AND b.required_count <= v_category_count
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- 4. Referral chain — only on the user's FIRST approval.
  IF v_was_first_approval THEN
    -- L1 self-bonus (awarded to the invitee themselves).
    PERFORM public._award_stars(
      p_user_id := v_user_id,
      p_delta := 100,
      p_reason := 'l1_referral_self_bonus',
      p_source_referral_user_id := v_user_id
    );

    -- L1 to direct inviter, if any.
    SELECT inviter_id INTO v_inviter_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_inviter_id IS NOT NULL THEN
      PERFORM public._award_stars(
        p_user_id := v_inviter_id,
        p_delta := 100,
        p_reason := 'l1_referral',
        p_source_referral_user_id := v_user_id
      );

      -- L2 to grandparent affiliate (the inviter's inviter), if any.
      SELECT inviter_id INTO v_grandparent_id
      FROM public.profiles
      WHERE id = v_inviter_id;

      IF v_grandparent_id IS NOT NULL THEN
        PERFORM public._award_stars(
          p_user_id := v_grandparent_id,
          p_delta := 50,
          p_reason := 'l2_referral',
          p_source_referral_user_id := v_user_id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."on_submission_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_submission_share_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reason text;
  v_verified_platform_count int;
BEGIN
  -- Only on transition to 'verified'.
  IF NEW.status != 'verified' OR (OLD.status IS NOT DISTINCT FROM 'verified') THEN
    RETURN NEW;
  END IF;

  -- Per-platform award.
  v_reason := 'share_' || NEW.platform;  -- 'share_facebook' | 'share_instagram' | 'share_tiktok'

  PERFORM public._award_stars(
    p_user_id := NEW.user_id,
    p_delta := 15,
    p_reason := v_reason,
    p_source_submission_id := NEW.submission_id
  );

  -- All-three bonus check.
  SELECT count(*) INTO v_verified_platform_count
  FROM public.submission_shares
  WHERE submission_id = NEW.submission_id AND status = 'verified';

  IF v_verified_platform_count = 3 THEN
    -- _award_stars is idempotent on (user, reason, source_submission_id), so
    -- replays of this trigger after the 3rd verification are no-ops.
    PERFORM public._award_stars(
      p_user_id := NEW.user_id,
      p_delta := 5,
      p_reason := 'share_all_three_bonus',
      p_source_submission_id := NEW.submission_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."on_submission_share_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_store_settings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."partner_store_settings_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_stores_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."partner_stores_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_daily_checkin"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_yesterday date;
  v_last_date date;
  v_new_streak int;
  v_checkin_id bigint;
  v_awarded boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
  v_yesterday := v_today - INTERVAL '1 day';

  -- Lock the user's profile row to serialize concurrent check-ins.
  SELECT (last_checkin_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date
    INTO v_last_date
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- Try to insert the checkin. UNIQUE blocks same-day double-tap.
  BEGIN
    INSERT INTO public.daily_checkins (user_id, checkin_date)
    VALUES (v_user_id, v_today)
    RETURNING id INTO v_checkin_id;
  EXCEPTION WHEN unique_violation THEN
    -- Already checked in today.
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_checked_in_today',
      'streak', (SELECT current_streak FROM public.profiles WHERE id = v_user_id)
    );
  END;

  -- Update streak.
  IF v_last_date = v_yesterday THEN
    v_new_streak := (SELECT current_streak FROM public.profiles WHERE id = v_user_id) + 1;
  ELSE
    v_new_streak := 1;  -- reset (first checkin OR missed a day)
  END IF;

  UPDATE public.profiles
  SET current_streak = v_new_streak,
      last_checkin_at = now()
  WHERE id = v_user_id;

  -- Award 50 stars on every 14-day milestone.
  IF v_new_streak > 0 AND v_new_streak % 14 = 0 THEN
    v_awarded := public._award_stars(
      p_user_id := v_user_id,
      p_delta := 50,
      p_reason := 'daily_streak_14',
      p_source_checkin_id := v_checkin_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'streak', v_new_streak,
    'awarded_stars', CASE WHEN v_awarded THEN 50 ELSE 0 END,
    'checkin_id', v_checkin_id
  );
END;
$$;


ALTER FUNCTION "public"."record_daily_checkin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_voucher record;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, redeemed_at
  INTO v_voucher
  FROM public.vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_voucher.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF v_voucher.redeemed_at IS NOT NULL THEN
    -- Idempotent: already requested — return current state without touching it.
    RETURN jsonb_build_object(
      'success', true,
      'already_redeemed', true,
      'redeemed_at', v_voucher.redeemed_at
    );
  END IF;

  UPDATE public.vouchers
  SET redeemed_at = now()
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_redeemed', false,
    'redeemed_at', now()
  );
END;
$$;


ALTER FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."refresh_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trade_stars_for_progress"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_cycle_id uuid;
  v_balance int;
  v_extras_applied int;
  v_new_balance int;
  v_new_extras int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock wallet row to serialize concurrent trade taps.
  SELECT balance INTO v_balance
  FROM public.star_wallet
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 100 THEN
    RAISE EXCEPTION 'Insufficient stars (have %, need 100)', COALESCE(v_balance, 0);
  END IF;

  -- Get active cycle. Lock it too to prevent concurrent close + trade.
  SELECT cycle_id, extras_applied INTO v_cycle_id, v_extras_applied
  FROM public.visit_progress
  WHERE user_id = v_user_id AND closed_at IS NULL
  FOR UPDATE;

  IF v_cycle_id IS NULL THEN
    -- No open cycle yet — open one.
    v_cycle_id := public._get_or_open_active_cycle(v_user_id);
    v_extras_applied := 0;
  END IF;

  IF v_extras_applied >= 4 THEN
    RAISE EXCEPTION 'Cycle already at +4 extras cap';
  END IF;

  -- Atomic update.
  UPDATE public.star_wallet
  SET balance = balance - 100,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.visit_progress
  SET extras_applied = extras_applied + 1
  WHERE cycle_id = v_cycle_id
  RETURNING extras_applied INTO v_new_extras;

  -- Audit row. delta_stars is negative for conversions (out of wallet).
  INSERT INTO public.star_ledger (user_id, delta_stars, reason, cycle_id)
  VALUES (v_user_id, -100, 'conversion_to_progress', v_cycle_id);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'new_extras_applied', v_new_extras,
    'cycle_id', v_cycle_id
  );
END;
$$;


ALTER FUNCTION "public"."trade_stars_for_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_ai_review_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_function_url text := 'https://dimpgwotujtaacoajisn.supabase.co/functions/v1/review-submission';
BEGIN
  PERFORM net.http_post(
    url := v_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('submission_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT on webhook-delivery failures. The admin can
  -- manually invoke review-submission later for any row with null receipt_hash.
  RAISE WARNING 'AI review trigger failed for submission %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_ai_review_submission"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_ai_review_submission"() IS 'Fires async HTTP POST to review-submission Edge Function for AI auto-review on new pending submissions.';



CREATE OR REPLACE FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text" DEFAULT NULL::"text", "p_reviewed_by" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.submissions
  SET
    status = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_by = COALESCE(p_reviewed_by, reviewed_by),
    updated_at = NOW()
  WHERE id = p_submission_id;
END;
$$;


ALTER FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_daily_submission_count"("uid" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select count(*)
  from public.submissions
  where user_id = uid
    and (timezone('UTC', created_at))::date = (timezone('UTC', now()))::date;
$$;


ALTER FUNCTION "public"."user_daily_submission_count"("uid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."all_social_posts" (
    "id" bigint NOT NULL,
    "platform" "text" NOT NULL,
    "platform_post_id" "text" NOT NULL,
    "url" "text",
    "title" "text",
    "thumbnail_url" "text",
    "posted_at" timestamp with time zone,
    "partner_store_id" "text",
    "curation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assigned_at" timestamp with time zone,
    "assigned_by" "uuid",
    "current_views" bigint DEFAULT 0 NOT NULL,
    "current_likes" bigint DEFAULT 0 NOT NULL,
    "last_updated" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "all_social_posts_assignment_consistent" CHECK (((("curation_status" = 'assigned'::"text") AND ("partner_store_id" IS NOT NULL)) OR (("curation_status" <> 'assigned'::"text") AND ("partner_store_id" IS NULL)))),
    CONSTRAINT "all_social_posts_curation_check" CHECK (("curation_status" = ANY (ARRAY['pending'::"text", 'assigned'::"text", 'general'::"text", 'skipped'::"text"]))),
    CONSTRAINT "all_social_posts_platform_check" CHECK (("platform" = ANY (ARRAY['youtube'::"text", 'instagram'::"text", 'tiktok'::"text", 'facebook'::"text"])))
);


ALTER TABLE "public"."all_social_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."all_social_posts" IS 'Marketing posts across YT/IG/TikTok/FB. Upserted by the polling Edge Function. partner_store_id assigned manually by admin via curation UI.';



CREATE SEQUENCE IF NOT EXISTS "public"."all_social_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."all_social_posts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."all_social_posts_id_seq" OWNED BY "public"."all_social_posts"."id";



CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."badge_category" NOT NULL,
    "required_count" integer NOT NULL,
    "selfie_url" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "receipt_url" "text",
    "badge_kind" "text",
    "tier" "text",
    "level" integer,
    CONSTRAINT "badges_badge_kind_check" CHECK ((("badge_kind" IS NULL) OR ("badge_kind" = ANY (ARRAY['visit'::"text", 'cafe'::"text", 'bar'::"text", 'restaurant'::"text", 'hotel'::"text"])))),
    CONSTRAINT "badges_level_range" CHECK ((("level" IS NULL) OR (("level" >= 1) AND ("level" <= 3)))),
    CONSTRAINT "badges_tier_check" CHECK ((("tier" IS NULL) OR ("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"]))))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


COMMENT ON TABLE "public"."badges" IS 'Defines all achievable badges and their requirements.';



COMMENT ON COLUMN "public"."badges"."badge_kind" IS 'visit | cafe | bar | restaurant | hotel. NULL for legacy rows. Drives which trigger evaluates threshold crossings.';



COMMENT ON COLUMN "public"."badges"."tier" IS 'bronze | silver | gold | platinum. NULL for legacy rows.';



COMMENT ON COLUMN "public"."badges"."level" IS 'Sub-level within a tier: 1 | 2 | 3. NULL for legacy rows.';



CREATE SEQUENCE IF NOT EXISTS "public"."badges_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."badges_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."badges_id_seq" OWNED BY "public"."badges"."id";



CREATE TABLE IF NOT EXISTS "public"."billing_statements" (
    "id" bigint NOT NULL,
    "partner_store_id" "text" NOT NULL,
    "period_year" smallint NOT NULL,
    "period_month" smallint NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "verified_visit_count" integer DEFAULT 0 NOT NULL,
    "per_visit_fee_at_generation" numeric(10,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'MYR'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_statements_period_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12)))
);


ALTER TABLE "public"."billing_statements" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_statements" IS 'Monthly billing statements per partner store. verified_visit_count × per_visit_fee_at_generation = total_amount. Payment status tracked out-of-band.';



CREATE SEQUENCE IF NOT EXISTS "public"."billing_statements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."billing_statements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."billing_statements_id_seq" OWNED BY "public"."billing_statements"."id";



CREATE TABLE IF NOT EXISTS "public"."daily_checkins" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "checkin_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_checkins" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_checkins" IS 'One row per (user, KL-day). UNIQUE constraint blocks double-tap. checkin_date stored in Asia/Kuala_Lumpur.';



ALTER TABLE "public"."daily_checkins" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_checkins_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitation_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."invitation_codes" IS 'Stores unique invitation codes for affiliate members.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "object_type" "text" NOT NULL,
    "object_id" "text",
    "data" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."oauth_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_store_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "scopes" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oauth_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'tiktok'::"text"])))
);


ALTER TABLE "public"."oauth_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."oauth_tokens" IS 'Per-partner OAuth tokens for IG/TikTok polling. Sensitive — service role access only.';



COMMENT ON COLUMN "public"."oauth_tokens"."access_token" IS 'Sensitive. Stored plain on Supabase free tier (no column encryption). Move to Vault if at-rest encryption becomes a requirement.';



CREATE TABLE IF NOT EXISTS "public"."partner_accounts" (
    "user_id" "uuid" NOT NULL,
    "partner_store_id" "text" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "partner_accounts_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."partner_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_accounts" IS 'Maps auth users to the partner stores they can access. Admin-managed.';



CREATE TABLE IF NOT EXISTS "public"."partner_store_settings" (
    "partner_store_id" "text" NOT NULL,
    "per_visit_fee" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partner_store_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_store_settings" IS 'Per-store operational settings (tier, per-visit fee, enrollment). partner_store_id is a Firestore doc id.';



CREATE TABLE IF NOT EXISTS "public"."partner_stores" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "city" "text" NOT NULL,
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "rating" numeric(3,2),
    "image" "text",
    "phone" "text",
    "hours" "text",
    "description" "text",
    "price_range" "text",
    "days" "text",
    "menu_images" "jsonb",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partner_stores" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_stores" IS 'Master partner store table. Replaces the Firestore partner_store collection. id keeps the original Firestore doc id for clean backfill.';



COMMENT ON COLUMN "public"."partner_stores"."days" IS 'Operating days as a display string, e.g. "Mon – Sun". Matches the Firestore source data shape.';



CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "partner_store_name" "text" NOT NULL,
    "partner_store_category" "public"."store_category" NOT NULL,
    "status" "public"."submission_status" DEFAULT 'pending'::"public"."submission_status" NOT NULL,
    "selfie_url" "text" NOT NULL,
    "receipt_url" "text" NOT NULL,
    "admin_notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "receipt_date" "date",
    "total_amount" numeric(12,2),
    "currency" "text",
    "merchant_name" "text",
    "receipt_hash" "text",
    "partner_store_id" "text"
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."submissions" IS 'Records member submissions for admin review.';



COMMENT ON COLUMN "public"."submissions"."admin_notes" IS 'Notes from admin during review process';



COMMENT ON COLUMN "public"."submissions"."reviewed_by" IS 'reviewed_by remains a uuid FK to profiles. AI auto-reviews use a dedicated admin profile UUID (wegood4u@gmail.com).';



COMMENT ON COLUMN "public"."submissions"."receipt_date" IS 'Transaction date extracted from receipt image via OCR';



COMMENT ON COLUMN "public"."submissions"."total_amount" IS 'Total amount extracted from receipt image via OCR';



COMMENT ON COLUMN "public"."submissions"."currency" IS 'Currency code extracted from receipt (e.g. MYR, USD). NULL if unreadable — no default.';



COMMENT ON COLUMN "public"."submissions"."merchant_name" IS 'Merchant/store name extracted from receipt';



COMMENT ON COLUMN "public"."submissions"."receipt_hash" IS 'SHA-256 hash of receipt image bytes for duplicate detection';



COMMENT ON COLUMN "public"."submissions"."partner_store_id" IS 'Firestore partner_store doc id. NULL for legacy rows pre-backfill. No FK — Firestore lives outside Supabase.';



CREATE OR REPLACE VIEW "public"."pending_submissions_view" AS
 SELECT "id",
    "user_id",
    "partner_store_name",
    "partner_store_category",
    "receipt_url",
    "selfie_url",
    "status",
    "receipt_date",
    "total_amount",
    "currency",
    "merchant_name",
    "admin_notes",
    "reviewed_by",
    "created_at",
    "updated_at"
   FROM "public"."submissions" "s"
  WHERE ("status" = 'pending'::"public"."submission_status")
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."pending_submissions_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_snapshots" (
    "post_id" bigint NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "views" bigint DEFAULT 0 NOT NULL,
    "likes" bigint DEFAULT 0 NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_response" "jsonb"
);


ALTER TABLE "public"."post_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."post_snapshots" IS 'Daily per-post stats snapshot. 90-day rolling retention. Counters are cumulative; compute deltas via LAG() in queries.';



COMMENT ON COLUMN "public"."post_snapshots"."raw_response" IS 'Optional raw JSON from the platform API for forensic debugging. Never expose to partners.';



CREATE TABLE IF NOT EXISTS "public"."product" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_category_check" CHECK (("category" = ANY (ARRAY['Horoscope'::"text", 'Zodiac'::"text"])))
);


ALTER TABLE "public"."product" OWNER TO "postgres";


ALTER TABLE "public"."product" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "inviter_id" "uuid",
    "full_name" "text",
    "dob" "date",
    "country_of_residence" "text",
    "preferred_communication_channel" "public"."communication_channel",
    "communication_contact_details" "text",
    "travel_destination_category" "text",
    "travel_destination_detail" "text",
    "travel_preference" "text",
    "accommodation_preference" "text",
    "travel_budget" "text",
    "role" "public"."user_role" DEFAULT 'subscriber'::"public"."user_role" NOT NULL,
    "verification_completed" boolean DEFAULT false,
    "affiliate_request_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gender" "text",
    "avatar_url" "text",
    "first_approved_submission_at" timestamp with time zone,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "last_checkin_at" timestamp with time zone,
    CONSTRAINT "profiles_affiliate_request_status_check" CHECK (("affiliate_request_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Stores all public user data and questionnaire responses.';



COMMENT ON COLUMN "public"."profiles"."inviter_id" IS 'Tracks who invited this user, forming the affiliate tree.';



COMMENT ON COLUMN "public"."profiles"."role" IS 'Current user role: subscriber -> member -> affiliate -> admin';



COMMENT ON COLUMN "public"."profiles"."verification_completed" IS 'Whether user completed verification questionnaire to become member';



COMMENT ON COLUMN "public"."profiles"."first_approved_submission_at" IS 'Timestamp of the user''s first approved submission. NULL until that happens. Set once by the on_submission_approved trigger; never cleared.';



COMMENT ON COLUMN "public"."profiles"."current_streak" IS 'Consecutive daily check-ins. Resets to 0 if user misses a day. KL TZ for day boundary.';



COMMENT ON COLUMN "public"."profiles"."last_checkin_at" IS 'Timestamp of the user''s most recent daily check-in. NULL = never checked in.';



CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expo_push_token" "text" NOT NULL,
    "device_info" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


ALTER TABLE "public"."push_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."push_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."referral_tree" AS
 WITH RECURSIVE "referral_levels" AS (
         SELECT "p1"."inviter_id" AS "affiliate_id",
            "p1"."id" AS "user_id",
            "p1"."username",
            "p1"."full_name",
            1 AS "level",
            "p1"."created_at",
            "p1"."inviter_id",
            "p1"."verification_completed",
            "p1"."first_approved_submission_at"
           FROM "public"."profiles" "p1"
          WHERE ("p1"."inviter_id" IS NOT NULL)
        UNION ALL
         SELECT "rl"."affiliate_id",
            "p2"."id" AS "user_id",
            "p2"."username",
            "p2"."full_name",
            2 AS "level",
            "p2"."created_at",
            "rl"."user_id" AS "inviter_id",
            "p2"."verification_completed",
            "p2"."first_approved_submission_at"
           FROM ("referral_levels" "rl"
             JOIN "public"."profiles" "p2" ON (("p2"."inviter_id" = "rl"."user_id")))
          WHERE ("rl"."level" = 1)
        )
 SELECT "affiliate_id",
    "user_id",
    "username",
    "full_name",
    "level",
    "created_at",
    "inviter_id",
    "verification_completed",
    "first_approved_submission_at",
        CASE
            WHEN ("first_approved_submission_at" IS NOT NULL) THEN 'active'::"text"
            WHEN COALESCE("verification_completed", false) THEN 'verified'::"text"
            ELSE 'registered'::"text"
        END AS "referral_state"
   FROM "referral_levels"
  ORDER BY "affiliate_id", "level", "created_at";


ALTER VIEW "public"."referral_tree" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."star_ledger" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "delta_stars" integer NOT NULL,
    "reason" "text" NOT NULL,
    "source_submission_id" bigint,
    "source_referral_user_id" "uuid",
    "source_checkin_id" bigint,
    "cycle_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "star_ledger_reason_check" CHECK (("reason" = ANY (ARRAY['share_facebook'::"text", 'share_instagram'::"text", 'share_tiktok'::"text", 'share_all_three_bonus'::"text", 'daily_streak_14'::"text", 'l1_referral'::"text", 'l1_referral_self_bonus'::"text", 'l2_referral'::"text", 'conversion_to_progress'::"text"])))
);


ALTER TABLE "public"."star_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."star_ledger" IS 'Append-only audit of every star event: awards (+) and trade-to-progress conversions (-). delta_stars is positive for awards, negative for conversions. cycle_id set on conversion_to_progress rows.';



ALTER TABLE "public"."star_ledger" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."star_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."star_wallet" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "star_wallet_balance_nonneg" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."star_wallet" OWNER TO "postgres";


COMMENT ON TABLE "public"."star_wallet" IS 'Per-user running star balance. Stars are earned from extra tasks (share/streak/referral) and spent via the manual trade button to add +1 to Visit 10 cycle progress.';



CREATE TABLE IF NOT EXISTS "public"."submission_shares" (
    "id" bigint NOT NULL,
    "submission_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "post_url" "text",
    "screenshot_path" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "ai_review_meta" "jsonb",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "submission_shares_platform_check" CHECK (("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'tiktok'::"text"]))),
    CONSTRAINT "submission_shares_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."submission_shares" OWNER TO "postgres";


COMMENT ON TABLE "public"."submission_shares" IS 'One row per (submission, platform) share attempt. UNIQUE blocks duplicate shares of the same approved submission to the same platform. Stars awarded on verified_at via trigger.';



ALTER TABLE "public"."submission_shares" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."submission_shares_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."submissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."submissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."submissions_id_seq" OWNED BY "public"."submissions"."id";



CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "user_id" "uuid" NOT NULL,
    "badge_id" integer NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_badges" IS 'Tracks which users have earned which badges.';



CREATE TABLE IF NOT EXISTS "public"."user_favorite_stores" (
    "user_id" "uuid" NOT NULL,
    "partner_store_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_favorite_stores" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_favorite_stores" IS 'Per-user favorited partner stores. partner_store_id is a Firestore doc id (no FK).';



CREATE OR REPLACE VIEW "public"."user_stats" AS
 SELECT "p"."id",
    "p"."username",
    "p"."full_name",
    "p"."role",
    COALESCE("s"."total_submissions", (0)::bigint) AS "total_submissions",
    COALESCE("s"."approved_submissions", (0)::bigint) AS "approved_submissions",
    COALESCE("s"."pending_submissions", (0)::bigint) AS "pending_submissions",
    COALESCE("b"."badge_count", (0)::bigint) AS "badge_count",
    COALESCE("r"."direct_referrals", (0)::bigint) AS "direct_referrals",
    "p"."created_at"
   FROM ((("public"."profiles" "p"
     LEFT JOIN ( SELECT "submissions"."user_id",
            "count"(*) AS "total_submissions",
            "count"(
                CASE
                    WHEN ("submissions"."status" = 'approved'::"public"."submission_status") THEN 1
                    ELSE NULL::integer
                END) AS "approved_submissions",
            "count"(
                CASE
                    WHEN ("submissions"."status" = 'pending'::"public"."submission_status") THEN 1
                    ELSE NULL::integer
                END) AS "pending_submissions"
           FROM "public"."submissions"
          GROUP BY "submissions"."user_id") "s" ON (("p"."id" = "s"."user_id")))
     LEFT JOIN ( SELECT "user_badges"."user_id",
            "count"(*) AS "badge_count"
           FROM "public"."user_badges"
          GROUP BY "user_badges"."user_id") "b" ON (("p"."id" = "b"."user_id")))
     LEFT JOIN ( SELECT "profiles"."inviter_id",
            "count"(*) AS "direct_referrals"
           FROM "public"."profiles"
          WHERE ("profiles"."inviter_id" IS NOT NULL)
          GROUP BY "profiles"."inviter_id") "r" ON (("p"."id" = "r"."inviter_id")));


ALTER VIEW "public"."user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_progress" (
    "cycle_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "real_visits" integer DEFAULT 0 NOT NULL,
    "extras_applied" integer DEFAULT 0 NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "visit_progress_extras_range" CHECK ((("extras_applied" >= 0) AND ("extras_applied" <= 4))),
    CONSTRAINT "visit_progress_real_visits_range" CHECK ((("real_visits" >= 0) AND ("real_visits" <= 10))),
    CONSTRAINT "visit_progress_total_lte_10" CHECK ((("real_visits" + "extras_applied") <= 10))
);


ALTER TABLE "public"."visit_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."visit_progress" IS 'Active and historical Visit 10 cycles. closed_at IS NULL means the user''s currently active cycle. Closes when user taps "Complete Tasks" at 10/10.';



CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_kind" "text" DEFAULT 'visit'::"text" NOT NULL,
    "tier" "text" NOT NULL,
    "level" integer,
    "reward_kind" "text" NOT NULL,
    "earned_from_cycle_id" "uuid",
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfilled_at" timestamp with time zone,
    "earned_from_badge_id" bigint,
    CONSTRAINT "vouchers_badge_kind_check" CHECK (("badge_kind" = ANY (ARRAY['visit'::"text", 'cafe'::"text", 'bar'::"text", 'restaurant'::"text", 'hotel'::"text"]))),
    CONSTRAINT "vouchers_level_range" CHECK ((("level" IS NULL) OR (("level" >= 1) AND ("level" <= 3)))),
    CONSTRAINT "vouchers_reward_kind_check" CHECK (("reward_kind" = ANY (ARRAY['airbnb_3star'::"text", 'hotel_3_4star'::"text", 'hotel_4_5star'::"text", 'specialty_5star_resort'::"text"]))),
    CONSTRAINT "vouchers_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


COMMENT ON TABLE "public"."vouchers" IS 'Minted on Visit 10 cycle close. Tier is snapshot at mint time — future tier-ups don''t retroactively upgrade. badge_kind is "visit" for v1; per-category values reserved for future Category Badge rewards.';



COMMENT ON COLUMN "public"."vouchers"."tier" IS 'User''s Visit Badge tier at the moment they tapped Complete Tasks. Frozen — never updated post-mint.';



COMMENT ON COLUMN "public"."vouchers"."level" IS 'L1/L2/L3 sub-level at mint, for display only. Tier (not level) determines reward_kind.';



COMMENT ON COLUMN "public"."vouchers"."reward_kind" IS 'airbnb_3star (Bronze) | hotel_3_4star (Silver) | hotel_4_5star (Gold) | specialty_5star_resort (Platinum)';



COMMENT ON COLUMN "public"."vouchers"."redeemed_at" IS 'Set when user claims voucher in Rewards subtab. NULL = unredeemed (claimable). v1 ships with "Coming soon" modal — stays NULL.';



COMMENT ON COLUMN "public"."vouchers"."fulfilled_at" IS 'Set by admin in Tasks → Redeem Req tab once they have contacted the user via WhatsApp / email to deliver the voucher. Sibling of redeemed_at.';



COMMENT ON COLUMN "public"."vouchers"."earned_from_badge_id" IS 'The badges.id of the Visit Badge level that minted this voucher. NULL for legacy rows minted by the pre-2026-05-10 per-cycle logic.';



ALTER TABLE ONLY "public"."all_social_posts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."all_social_posts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."badges" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."badges_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."billing_statements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."billing_statements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."submissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."submissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."all_social_posts"
    ADD CONSTRAINT "all_social_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."all_social_posts"
    ADD CONSTRAINT "all_social_posts_platform_id_unique" UNIQUE ("platform", "platform_post_id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_period_unique" UNIQUE ("partner_store_id", "period_year", "period_month");



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_unique_per_day" UNIQUE ("user_id", "checkin_date");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_store_platform_unique" UNIQUE ("partner_store_id", "platform");



ALTER TABLE ONLY "public"."partner_accounts"
    ADD CONSTRAINT "partner_accounts_pkey" PRIMARY KEY ("user_id", "partner_store_id");



ALTER TABLE ONLY "public"."partner_store_settings"
    ADD CONSTRAINT "partner_store_settings_pkey" PRIMARY KEY ("partner_store_id");



ALTER TABLE ONLY "public"."partner_stores"
    ADD CONSTRAINT "partner_stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_snapshots"
    ADD CONSTRAINT "post_snapshots_pkey" PRIMARY KEY ("post_id", "snapshot_date");



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_expo_push_token_key" UNIQUE ("expo_push_token");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."star_wallet"
    ADD CONSTRAINT "star_wallet_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."submission_shares"
    ADD CONSTRAINT "submission_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_shares"
    ADD CONSTRAINT "submission_shares_unique_submission_platform" UNIQUE ("submission_id", "platform");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_favorite_stores"
    ADD CONSTRAINT "user_favorite_stores_pkey" PRIMARY KEY ("user_id", "partner_store_id");



ALTER TABLE ONLY "public"."visit_progress"
    ADD CONSTRAINT "visit_progress_pkey" PRIMARY KEY ("cycle_id");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id");



CREATE INDEX "all_social_posts_pending_idx" ON "public"."all_social_posts" USING "btree" ("posted_at" DESC) WHERE ("curation_status" = 'pending'::"text");



CREATE INDEX "all_social_posts_platform_idx" ON "public"."all_social_posts" USING "btree" ("platform", "posted_at" DESC);



CREATE INDEX "all_social_posts_store_posted_idx" ON "public"."all_social_posts" USING "btree" ("partner_store_id", "posted_at" DESC) WHERE ("partner_store_id" IS NOT NULL);



CREATE INDEX "badges_active_kind_required_idx" ON "public"."badges" USING "btree" ("badge_kind", "required_count") WHERE (("is_active" = true) AND ("badge_kind" IS NOT NULL));



CREATE INDEX "billing_statements_store_period_idx" ON "public"."billing_statements" USING "btree" ("partner_store_id", "period_year" DESC, "period_month" DESC);



CREATE INDEX "daily_checkins_user_date_idx" ON "public"."daily_checkins" USING "btree" ("user_id", "checkin_date" DESC);



CREATE INDEX "idx_invitation_codes_code" ON "public"."invitation_codes" USING "btree" ("code");



CREATE INDEX "idx_notifications_actor_id" ON "public"."notifications" USING "btree" ("actor_id");



CREATE INDEX "idx_notifications_recipient_created_at" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notifications_recipient_id" ON "public"."notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_profiles_inviter_id" ON "public"."profiles" USING "btree" ("inviter_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "idx_push_tokens_active" ON "public"."push_tokens" USING "btree" ("user_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_submissions_duplicate_lookup" ON "public"."submissions" USING "btree" ("user_id", "partner_store_name", "receipt_date") WHERE ("status" = ANY (ARRAY['approved'::"public"."submission_status", 'pending'::"public"."submission_status"]));



CREATE INDEX "idx_submissions_partner_store_category" ON "public"."submissions" USING "btree" ("partner_store_category");



CREATE INDEX "idx_submissions_partner_store_name" ON "public"."submissions" USING "btree" ("partner_store_name");



CREATE INDEX "idx_submissions_receipt_date" ON "public"."submissions" USING "btree" ("receipt_date");



CREATE INDEX "idx_submissions_receipt_hash" ON "public"."submissions" USING "btree" ("receipt_hash");



CREATE INDEX "idx_submissions_receipt_hash_lookup" ON "public"."submissions" USING "btree" ("receipt_hash") WHERE ("receipt_hash" IS NOT NULL);



CREATE INDEX "idx_submissions_status" ON "public"."submissions" USING "btree" ("status");



CREATE INDEX "idx_submissions_status_pending" ON "public"."submissions" USING "btree" ("status", "created_at" DESC) WHERE ("status" = 'pending'::"public"."submission_status");



CREATE INDEX "idx_submissions_total_amount" ON "public"."submissions" USING "btree" ("total_amount");



CREATE INDEX "idx_submissions_user_id" ON "public"."submissions" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "partner_accounts_store_idx" ON "public"."partner_accounts" USING "btree" ("partner_store_id");



CREATE INDEX "partner_accounts_user_idx" ON "public"."partner_accounts" USING "btree" ("user_id");



CREATE INDEX "partner_store_settings_active_idx" ON "public"."partner_store_settings" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "partner_stores_active_idx" ON "public"."partner_stores" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "partner_stores_city_idx" ON "public"."partner_stores" USING "btree" ("city");



CREATE INDEX "partner_stores_type_idx" ON "public"."partner_stores" USING "btree" ("type");



CREATE INDEX "post_snapshots_date_idx" ON "public"."post_snapshots" USING "btree" ("snapshot_date" DESC);



CREATE UNIQUE INDEX "star_ledger_unique_checkin" ON "public"."star_ledger" USING "btree" ("user_id", "reason", "source_checkin_id") WHERE ("source_checkin_id" IS NOT NULL);



CREATE UNIQUE INDEX "star_ledger_unique_referral" ON "public"."star_ledger" USING "btree" ("user_id", "reason", "source_referral_user_id") WHERE ("source_referral_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "star_ledger_unique_share" ON "public"."star_ledger" USING "btree" ("user_id", "reason", "source_submission_id") WHERE ("source_submission_id" IS NOT NULL);



CREATE INDEX "star_ledger_user_created_at_idx" ON "public"."star_ledger" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "submission_shares_submission_id_idx" ON "public"."submission_shares" USING "btree" ("submission_id");



CREATE INDEX "submission_shares_user_status_idx" ON "public"."submission_shares" USING "btree" ("user_id", "status");



CREATE INDEX "submissions_partner_store_id_idx" ON "public"."submissions" USING "btree" ("partner_store_id") WHERE ("partner_store_id" IS NOT NULL);



CREATE INDEX "submissions_store_status_created_idx" ON "public"."submissions" USING "btree" ("partner_store_id", "status", "created_at" DESC) WHERE ("partner_store_id" IS NOT NULL);



CREATE INDEX "user_favorite_stores_user_created_idx" ON "public"."user_favorite_stores" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "visit_progress_one_open_per_user" ON "public"."visit_progress" USING "btree" ("user_id") WHERE ("closed_at" IS NULL);



CREATE INDEX "visit_progress_user_closed_at_idx" ON "public"."visit_progress" USING "btree" ("user_id", "closed_at" DESC) WHERE ("closed_at" IS NOT NULL);



CREATE INDEX "vouchers_fulfilled_at_idx" ON "public"."vouchers" USING "btree" ("fulfilled_at");



CREATE INDEX "vouchers_user_redeemed_idx" ON "public"."vouchers" USING "btree" ("user_id", "redeemed_at");



CREATE OR REPLACE TRIGGER "all_social_posts_updated_at" BEFORE UPDATE ON "public"."all_social_posts" FOR EACH ROW EXECUTE FUNCTION "public"."all_social_posts_touch_updated_at"();



CREATE OR REPLACE TRIGGER "billing_statements_updated_at" BEFORE UPDATE ON "public"."billing_statements" FOR EACH ROW EXECUTE FUNCTION "public"."billing_statements_touch_updated_at"();



CREATE OR REPLACE TRIGGER "invitation_codes_updated_at" BEFORE UPDATE ON "public"."invitation_codes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "notify_on_voucher_redemption_request" AFTER UPDATE OF "redeemed_at" ON "public"."vouchers" FOR EACH ROW WHEN ((("old"."redeemed_at" IS NULL) AND ("new"."redeemed_at" IS NOT NULL))) EXECUTE FUNCTION "public"."notify_on_voucher_redemption_request"();



CREATE OR REPLACE TRIGGER "oauth_tokens_updated_at" BEFORE UPDATE ON "public"."oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."oauth_tokens_touch_updated_at"();



CREATE OR REPLACE TRIGGER "on_profile_inviter_set" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."increment_invitation_usage"();



CREATE OR REPLACE TRIGGER "on_profile_inviter_updated" AFTER UPDATE ON "public"."profiles" FOR EACH ROW WHEN ((("old"."inviter_id" IS NULL) AND ("new"."inviter_id" IS NOT NULL))) EXECUTE FUNCTION "public"."increment_invitation_usage"();



CREATE OR REPLACE TRIGGER "on_submission_approved" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW WHEN ((("new"."status" = 'approved'::"public"."submission_status") AND ("old"."status" IS DISTINCT FROM 'approved'::"public"."submission_status"))) EXECUTE FUNCTION "public"."on_submission_approved"();



CREATE OR REPLACE TRIGGER "on_submission_share_verified" AFTER UPDATE OF "status" ON "public"."submission_shares" FOR EACH ROW WHEN ((("new"."status" = 'verified'::"text") AND ("old"."status" IS DISTINCT FROM 'verified'::"text"))) EXECUTE FUNCTION "public"."on_submission_share_verified"();



CREATE OR REPLACE TRIGGER "partner_store_settings_updated_at" BEFORE UPDATE ON "public"."partner_store_settings" FOR EACH ROW EXECUTE FUNCTION "public"."partner_store_settings_touch_updated_at"();



CREATE OR REPLACE TRIGGER "partner_stores_updated_at" BEFORE UPDATE ON "public"."partner_stores" FOR EACH ROW EXECUTE FUNCTION "public"."partner_stores_touch_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "submissions_updated_at" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_review_on_submission_insert" AFTER INSERT ON "public"."submissions" FOR EACH ROW WHEN (("new"."status" = 'pending'::"public"."submission_status")) EXECUTE FUNCTION "public"."trigger_ai_review_submission"();



CREATE OR REPLACE TRIGGER "trg_mint_voucher_on_visit_levelup" AFTER INSERT ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."mint_voucher_on_visit_levelup"();



CREATE OR REPLACE TRIGGER "trg_notify_on_badge_earned" AFTER INSERT ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_badge_earned"();



CREATE OR REPLACE TRIGGER "trg_notify_on_referral_qualified" AFTER INSERT ON "public"."star_ledger" FOR EACH ROW WHEN (("new"."reason" = ANY (ARRAY['l1_referral'::"text", 'l2_referral'::"text"]))) EXECUTE FUNCTION "public"."notify_on_referral_qualified"();



CREATE OR REPLACE TRIGGER "trg_notify_on_share_verified" AFTER UPDATE OF "status" ON "public"."submission_shares" FOR EACH ROW WHEN ((("new"."status" = 'verified'::"text") AND ("old"."status" IS DISTINCT FROM 'verified'::"text"))) EXECUTE FUNCTION "public"."notify_on_share_verified"();



CREATE OR REPLACE TRIGGER "trg_notify_on_submission_insert" AFTER INSERT ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_submission_insert"();



CREATE OR REPLACE TRIGGER "trg_notify_on_submission_status_change" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_submission_status_change"();



CREATE OR REPLACE TRIGGER "trg_push_tokens_updated_at" BEFORE UPDATE ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_updated_at"();



ALTER TABLE ONLY "public"."all_social_posts"
    ADD CONSTRAINT "all_social_posts_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."all_social_posts"
    ADD CONSTRAINT "all_social_posts_partner_store_id_fkey" FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_stores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_partner_store_id_fkey" FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_store_settings"("partner_store_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "fk_notifications_actor_profiles" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "fk_notifications_recipient_profiles" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "fk_push_tokens_profiles" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_partner_store_id_fkey" FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_accounts"
    ADD CONSTRAINT "partner_accounts_partner_store_id_fkey" FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_store_settings"("partner_store_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_accounts"
    ADD CONSTRAINT "partner_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_snapshots"
    ADD CONSTRAINT "post_snapshots_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."all_social_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_cycle_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."visit_progress"("cycle_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_source_checkin_fkey" FOREIGN KEY ("source_checkin_id") REFERENCES "public"."daily_checkins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_source_referral_user_fkey" FOREIGN KEY ("source_referral_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_source_submission_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."star_ledger"
    ADD CONSTRAINT "star_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."star_wallet"
    ADD CONSTRAINT "star_wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submission_shares"
    ADD CONSTRAINT "submission_shares_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submission_shares"
    ADD CONSTRAINT "submission_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorite_stores"
    ADD CONSTRAINT "user_favorite_stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_progress"
    ADD CONSTRAINT "visit_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_cycle_fkey" FOREIGN KEY ("earned_from_cycle_id") REFERENCES "public"."visit_progress"("cycle_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_earned_from_badge_id_fkey" FOREIGN KEY ("earned_from_badge_id") REFERENCES "public"."badges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage all invitation codes" ON "public"."invitation_codes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all checkins" ON "public"."daily_checkins" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all star ledger" ON "public"."star_ledger" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all star wallets" ON "public"."star_wallet" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all submission shares" ON "public"."submission_shares" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all submissions" ON "public"."submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all visit progress" ON "public"."visit_progress" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all vouchers" ON "public"."vouchers" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can update notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update submission shares" ON "public"."submission_shares" FOR UPDATE TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can update submissions" ON "public"."submissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Affiliates can read own invitation code" ON "public"."invitation_codes" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['affiliate'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Allow Authenticated Users to 'Select' Submission" ON "public"."submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" IS NOT NULL) AND ("profiles"."role" <> 'subscriber'::"public"."user_role")))));



CREATE POLICY "Allow Authenticated Users to Insert Submissions" ON "public"."submissions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" IS NOT NULL) AND ("profiles"."role" <> 'subscriber'::"public"."user_role"))))));



CREATE POLICY "Allow Authenticated Users to Update their own submissions while" ON "public"."submissions" FOR UPDATE TO "authenticated" USING (
CASE
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role") THEN true
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) IS NULL) THEN false
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) = 'subscriber'::"public"."user_role") THEN false
    ELSE ("user_id" = ( SELECT "auth"."uid"() AS "uid"))
END) WITH CHECK (
CASE
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role") THEN true
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) IS NULL) THEN false
    WHEN (( SELECT "profiles"."role"
       FROM "public"."profiles"
      WHERE ("submissions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) = 'subscriber'::"public"."user_role") THEN false
    ELSE ("user_id" = ( SELECT "auth"."uid"() AS "uid"))
END);



CREATE POLICY "Anon can manage profiles at signup" ON "public"."profiles" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can read active invitation codes for validation" ON "public"."invitation_codes" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Authenticated users can read badges" ON "public"."badges" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Limit submissions to 20 per day (UTC)" ON "public"."submissions" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("public"."user_daily_submission_count"("auth"."uid"()) < 20)));



CREATE POLICY "Members can create submissions" ON "public"."submissions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['member'::"public"."user_role", 'affiliate'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Members can insert own invitation codes" ON "public"."invitation_codes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'member'::"public"."user_role"))))));



CREATE POLICY "Members can read own invitation codes" ON "public"."invitation_codes" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'member'::"public"."user_role"))))));



CREATE POLICY "Members can update own invitation codes" ON "public"."invitation_codes" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'member'::"public"."user_role")))))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "No client inserts" ON "public"."notifications" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "Public read product (anon)" ON "public"."product" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public read product (authenticated)" ON "public"."product" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Push tokens: delete own" ON "public"."push_tokens" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Push tokens: insert own" ON "public"."push_tokens" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Push tokens: select own" ON "public"."push_tokens" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Push tokens: update own" ON "public"."push_tokens" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Recipient can delete own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "Recipient can read own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "Recipient can update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "System can award badges" ON "public"."user_badges" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own badges" ON "public"."user_badges" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own checkins" ON "public"."daily_checkins" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own star ledger" ON "public"."star_ledger" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own star wallet" ON "public"."star_wallet" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own submission shares" ON "public"."submission_shares" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own submissions" ON "public"."submissions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own visit progress" ON "public"."visit_progress" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own vouchers" ON "public"."vouchers" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all billing" ON "public"."billing_statements" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all favorites" ON "public"."user_favorite_stores" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all partner accounts" ON "public"."partner_accounts" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all partner store settings" ON "public"."partner_store_settings" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all post snapshots" ON "public"."post_snapshots" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read all posts" ON "public"."all_social_posts" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins read oauth tokens" ON "public"."oauth_tokens" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write billing" ON "public"."billing_statements" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write oauth tokens" ON "public"."oauth_tokens" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write partner accounts" ON "public"."partner_accounts" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write partner store settings" ON "public"."partner_store_settings" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write partner stores" ON "public"."partner_stores" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write post snapshots" ON "public"."post_snapshots" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins write posts" ON "public"."all_social_posts" TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "all users read partner stores" ON "public"."partner_stores" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."all_social_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_store_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_stores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partners read submissions for their store" ON "public"."submissions" FOR SELECT TO "authenticated" USING ((("partner_store_id" IS NOT NULL) AND "public"."is_partner_for_store"("partner_store_id")));



CREATE POLICY "partners read their billing" ON "public"."billing_statements" FOR SELECT TO "authenticated" USING ("public"."is_partner_for_store"("partner_store_id"));



CREATE POLICY "partners read their post snapshots" ON "public"."post_snapshots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."all_social_posts" "p"
  WHERE (("p"."id" = "post_snapshots"."post_id") AND ("p"."partner_store_id" IS NOT NULL) AND "public"."is_partner_for_store"("p"."partner_store_id")))));



CREATE POLICY "partners read their posts" ON "public"."all_social_posts" FOR SELECT TO "authenticated" USING ((("partner_store_id" IS NOT NULL) AND "public"."is_partner_for_store"("partner_store_id")));



CREATE POLICY "partners read their store settings" ON "public"."partner_store_settings" FOR SELECT TO "authenticated" USING ("public"."is_partner_for_store"("partner_store_id"));



ALTER TABLE "public"."post_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."star_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."star_wallet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submission_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_favorite_stores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users delete own favorites" ON "public"."user_favorite_stores" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users insert own favorites" ON "public"."user_favorite_stores" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users read own partner accounts" ON "public"."partner_accounts" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users select own favorites" ON "public"."user_favorite_stores" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."visit_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."badges";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."star_ledger";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."star_wallet";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."submission_shares";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."submissions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_favorite_stores";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."visit_progress";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_award_stars"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source_submission_id" bigint, "p_source_referral_user_id" "uuid", "p_source_checkin_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."_award_stars"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source_submission_id" bigint, "p_source_referral_user_id" "uuid", "p_source_checkin_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_award_stars"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source_submission_id" bigint, "p_source_referral_user_id" "uuid", "p_source_checkin_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."all_social_posts_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."all_social_posts_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."all_social_posts_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_statements_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."billing_statements_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_statements_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_snapshots"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_snapshots"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_snapshots"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_visit_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."complete_visit_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_visit_task"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_store_stats"("_partner_store_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_store_stats"("_partner_store_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_store_stats"("_partner_store_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_invitation_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_invitation_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_invitation_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("p_uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partner_for_store"("_partner_store_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mint_voucher_on_visit_levelup"() TO "anon";
GRANT ALL ON FUNCTION "public"."mint_voucher_on_visit_levelup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mint_voucher_on_visit_levelup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_referral_qualified"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_referral_qualified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_referral_qualified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_share_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_share_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_share_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_submission_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_submission_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_voucher_redemption_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_voucher_redemption_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_voucher_redemption_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."oauth_tokens_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."oauth_tokens_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."oauth_tokens_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_submission_share_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_submission_share_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_submission_share_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."partner_store_settings_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."partner_store_settings_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."partner_store_settings_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."partner_stores_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."partner_stores_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."partner_stores_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_daily_checkin"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_daily_checkin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_daily_checkin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trade_stars_for_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."trade_stars_for_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trade_stars_for_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."all_social_posts" TO "anon";
GRANT ALL ON TABLE "public"."all_social_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."all_social_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."all_social_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."all_social_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."all_social_posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."billing_statements" TO "anon";
GRANT ALL ON TABLE "public"."billing_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_statements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."billing_statements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."billing_statements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."billing_statements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_checkins" TO "anon";
GRANT ALL ON TABLE "public"."daily_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_checkins" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_checkins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_checkins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_checkins_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_tokens" TO "anon";
GRANT ALL ON TABLE "public"."oauth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."partner_accounts" TO "anon";
GRANT ALL ON TABLE "public"."partner_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."partner_store_settings" TO "anon";
GRANT ALL ON TABLE "public"."partner_store_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_store_settings" TO "service_role";



GRANT ALL ON TABLE "public"."partner_stores" TO "anon";
GRANT ALL ON TABLE "public"."partner_stores" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_stores" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."pending_submissions_view" TO "anon";
GRANT ALL ON TABLE "public"."pending_submissions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_submissions_view" TO "service_role";



GRANT ALL ON TABLE "public"."post_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."post_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."post_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."product" TO "anon";
GRANT ALL ON TABLE "public"."product" TO "authenticated";
GRANT ALL ON TABLE "public"."product" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON SEQUENCE "public"."push_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_tokens_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."referral_tree" TO "anon";
GRANT ALL ON TABLE "public"."referral_tree" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_tree" TO "service_role";



GRANT ALL ON TABLE "public"."star_ledger" TO "anon";
GRANT ALL ON TABLE "public"."star_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."star_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."star_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."star_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."star_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."star_wallet" TO "anon";
GRANT ALL ON TABLE "public"."star_wallet" TO "authenticated";
GRANT ALL ON TABLE "public"."star_wallet" TO "service_role";



GRANT ALL ON TABLE "public"."submission_shares" TO "anon";
GRANT ALL ON TABLE "public"."submission_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_shares" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submission_shares_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submission_shares_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submission_shares_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorite_stores" TO "anon";
GRANT ALL ON TABLE "public"."user_favorite_stores" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorite_stores" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."visit_progress" TO "anon";
GRANT ALL ON TABLE "public"."visit_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_progress" TO "service_role";



GRANT ALL ON TABLE "public"."vouchers" TO "anon";
GRANT ALL ON TABLE "public"."vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."vouchers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow authenticated uploads to submitted buckets"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = ANY (ARRAY['submitted-selfie'::text, 'submitted-receipt'::text])));



  create policy "Allow public SELECT on submitted buckets"
  on "storage"."objects"
  as permissive
  for select
  to anon
using ((bucket_id = ANY (ARRAY['submitted-selfie'::text, 'submitted-receipt'::text])));



  create policy "ProfilePic insert by owner"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'profilePic'::text) AND ((string_to_array(name, '/'::text))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "ProfilePic select by owner"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'profilePic'::text) AND ((string_to_array(name, '/'::text))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "ProfilePic update by owner"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'profilePic'::text) AND ((string_to_array(name, '/'::text))[1] = ( SELECT (auth.uid())::text AS uid))))
with check (((bucket_id = 'profilePic'::text) AND ((string_to_array(name, '/'::text))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "share_screenshots_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'submission-share-screenshots'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "share_screenshots_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'submission-share-screenshots'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "share_screenshots_owner_modify"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'submission-share-screenshots'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "share_screenshots_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'submission-share-screenshots'::text));



  create policy "Allow authenticated multipart insert"
  on "storage"."s3_multipart_uploads"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = ANY (ARRAY['submitted-selfie'::text, 'submitted-receipt'::text])));



