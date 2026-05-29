

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


CREATE OR REPLACE FUNCTION "public"."_credits_active_cycle_id"("p_user_id" "uuid", "p_category" "public"."store_category") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
  v_numerator int;
BEGIN
  SELECT cycle_id, SUM(delta_numerator)
  INTO v_cycle_id, v_numerator
  FROM public.credits_ledger
  WHERE user_id = p_user_id AND category = p_category
  GROUP BY cycle_id
  ORDER BY MAX(created_at) DESC
  LIMIT 1;

  IF v_cycle_id IS NULL OR v_numerator >= 10 THEN
    RETURN gen_random_uuid();
  END IF;

  RETURN v_cycle_id;
END;
$$;


ALTER FUNCTION "public"."_credits_active_cycle_id"("p_user_id" "uuid", "p_category" "public"."store_category") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_apply_delta"("p_user_id" "uuid", "p_category" "public"."store_category", "p_reason" "text", "p_submission_id" bigint, "p_referral_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
  v_new_numerator int;
  v_tier text;
  v_task_count int;
BEGIN
  v_cycle_id := public._credits_active_cycle_id(p_user_id, p_category);

  INSERT INTO public.credits_ledger (
    user_id, category, delta_numerator, reason,
    source_submission_id, source_referral_id, cycle_id
  )
  VALUES (
    p_user_id, p_category, 1, p_reason,
    p_submission_id, p_referral_id, v_cycle_id
  );

  SELECT COALESCE(SUM(delta_numerator), 0)
  INTO v_new_numerator
  FROM public.credits_ledger
  WHERE user_id = p_user_id AND category = p_category AND cycle_id = v_cycle_id;

  IF v_new_numerator >= 10 THEN
    -- Include this newly-closed cycle in the task count, so the voucher tier
    -- reflects the user's post-completion standing (e.g. 5th task → Silver).
    v_task_count := public._credits_completed_task_count(p_user_id);
    v_tier := public._credits_tier_for_task_count(v_task_count);

    INSERT INTO public.vouchers (user_id, tier, reward_kind, earned_from_cycle_id)
    VALUES (
      p_user_id,
      v_tier,
      public._credits_reward_kind_for_tier(v_tier),
      v_cycle_id
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."_credits_apply_delta"("p_user_id" "uuid", "p_category" "public"."store_category", "p_reason" "text", "p_submission_id" bigint, "p_referral_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_award_tier_badge"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_task_count int;
  v_badge_id int;
BEGIN
  v_task_count := public._credits_completed_task_count(p_user_id);

  FOR v_badge_id IN
    SELECT id
    FROM public.badges
    WHERE category = 'activity'
      AND required_count <= v_task_count
      AND is_active = true
  LOOP
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (p_user_id, v_badge_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."_credits_award_tier_badge"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_completed_task_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM (
    SELECT cycle_id
    FROM public.credits_ledger
    WHERE user_id = p_user_id
      AND category IN ('restaurant','cafe','bar')
    GROUP BY cycle_id
    HAVING SUM(delta_numerator) >= 10
  ) closed;
$$;


ALTER FUNCTION "public"."_credits_completed_task_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_pick_referral_target"("p_user_id" "uuid") RETURNS "public"."store_category"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result public.store_category;
BEGIN
  WITH candidates AS (
    SELECT cat FROM (VALUES
      ('restaurant'::public.store_category),
      ('cafe'::public.store_category),
      ('bar'::public.store_category)
    ) AS t(cat)
  ),
  active AS (
    SELECT c.cat AS category,
           public._credits_active_cycle_id(p_user_id, c.cat) AS cycle_id
    FROM candidates c
  ),
  progress AS (
    SELECT
      a.category,
      a.cycle_id,
      COALESCE(SUM(cl.delta_numerator), 0) AS numerator,
      COALESCE(SUM(
        CASE WHEN cl.reason IN ('level1_referral','level2_pair') THEN 1 ELSE 0 END
      ), 0) AS referral_count
    FROM active a
    LEFT JOIN public.credits_ledger cl
      ON cl.user_id = p_user_id
     AND cl.category = a.category
     AND cl.cycle_id = a.cycle_id
    GROUP BY a.category, a.cycle_id
  )
  SELECT category INTO v_result
  FROM progress
  WHERE referral_count < 4
  ORDER BY numerator DESC,
           CASE category
             WHEN 'restaurant' THEN 1
             WHEN 'cafe'       THEN 2
             WHEN 'bar'        THEN 3
             ELSE 99
           END
  LIMIT 1;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."_credits_pick_referral_target"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_reward_kind_for_tier"("p_tier" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE p_tier
    WHEN 'bronze'   THEN 'airbnb'
    WHEN 'silver'   THEN '3_star_hotel'
    WHEN 'gold'     THEN '4_star_hotel'
    WHEN 'platinum' THEN 'specialty'
  END;
$$;


ALTER FUNCTION "public"."_credits_reward_kind_for_tier"("p_tier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_credits_tier_for_task_count"("p_tasks" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_tasks >= 35 THEN 'platinum'
    WHEN p_tasks >= 15 THEN 'gold'
    WHEN p_tasks >= 5  THEN 'silver'
    ELSE 'bronze'
  END;
$$;


ALTER FUNCTION "public"."_credits_tier_for_task_count"("p_tasks" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."check_and_award_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_approved_count INT;
  cafe_approved_count INT;
  restaurant_approved_count INT;
  badge_record RECORD;
BEGIN
  -- Only proceed if submission was just approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Get current counts for the user
    SELECT COUNT(*) INTO total_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved';
    
    SELECT COUNT(*) INTO cafe_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved' AND partner_store_category = 'cafe';
    
    SELECT COUNT(*) INTO restaurant_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved' AND partner_store_category = 'restaurant';
    
    -- Check for activity badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'activity' AND required_count <= total_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Check for cafe badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'cafe' AND required_count <= cafe_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Check for restaurant badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'restaurant' AND required_count <= restaurant_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_and_award_badges"() OWNER TO "postgres";


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
    SELECT
      ('submission_' || s.status)::text                   AS event_type,
      COALESCE(s.reviewed_at, s.updated_at, s.created_at) AS event_at,
      s.partner_store_name                                AS target,
      jsonb_build_object(
        'submission_id', s.id,
        'status',        s.status,
        'category',      s.partner_store_category
      )                                                   AS metadata
    FROM public.submissions s
    WHERE s.user_id = v_user_id
      AND s.status IN ('approved','rejected')

    UNION ALL

    SELECT
      'badge_earned'::text              AS event_type,
      ub.earned_at                      AS event_at,
      COALESCE(b.name, 'Badge')         AS target,
      jsonb_build_object(
        'badge_id',       ub.badge_id,
        'badge_category', b.category,
        'required_count', b.required_count
      )                                  AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id = v_user_id

    UNION ALL

    SELECT
      'task_completed'::text     AS event_type,
      closing.created_at         AS event_at,
      closing.category::text     AS target,
      jsonb_build_object(
        'category', closing.category,
        'cycle_id', closing.cycle_id
      )                          AS metadata
    FROM (
      SELECT cl.category, cl.cycle_id, cl.created_at,
             ROW_NUMBER() OVER (PARTITION BY cl.cycle_id ORDER BY cl.id DESC) AS rn,
             SUM(cl.delta_numerator) OVER (PARTITION BY cl.cycle_id) AS cycle_sum
      FROM public.credits_ledger cl
      WHERE cl.user_id = v_user_id
    ) closing
    WHERE closing.rn = 1
      AND closing.cycle_sum >= 10

    UNION ALL

    SELECT
      'voucher_redeemed'::text   AS event_type,
      v.redeemed_at              AS event_at,
      v.reward_kind              AS target,
      jsonb_build_object(
        'voucher_id',  v.id,
        'tier',        v.tier,
        'reward_kind', v.reward_kind
      )                          AS metadata
    FROM public.vouchers v
    WHERE v.user_id = v_user_id
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
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_activity"("p_limit" integer, "p_offset" integer) IS 'Paginated unified activity feed for the calling user. Returns total_count via window function so the UI can render numbered pagination.';



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


CREATE OR REPLACE FUNCTION "public"."on_submission_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_first_approval boolean := false;
  v_inviter_id uuid;
  v_grandparent_id uuid;
  v_ref_category public.store_category;
  v_half_count smallint;
BEGIN
  -- Only react to status transitioning into 'approved'.
  IF NOT (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved')) THEN
    RETURN NEW;
  END IF;

  -- Serialise concurrent approvals for the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  -- Mark first approval (driver for referral qualification).
  UPDATE public.profiles
  SET first_approved_submission_at = COALESCE(NEW.reviewed_at, now())
  WHERE id = NEW.user_id
    AND first_approved_submission_at IS NULL;

  IF FOUND THEN
    v_is_first_approval := true;
  END IF;

  -- 1. Credit the invitee for their own approved submission (eligible cats only).
  IF NEW.partner_store_category IN ('restaurant','cafe','bar') THEN
    PERFORM public._credits_apply_delta(
      NEW.user_id,
      NEW.partner_store_category,
      'approved_submission',
      NEW.id,
      NULL
    );
    PERFORM public._credits_award_tier_badge(NEW.user_id);
  END IF;

  -- 2. Referral rewards — only on the very first qualifying approval.
  IF v_is_first_approval THEN
    SELECT inviter_id INTO v_inviter_id
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF v_inviter_id IS NOT NULL THEN
      -- Level 1 — inviter gets +1 credit auto-placed.
      PERFORM pg_advisory_xact_lock(hashtextextended(v_inviter_id::text, 0));

      v_ref_category := public._credits_pick_referral_target(v_inviter_id);
      IF v_ref_category IS NOT NULL THEN
        PERFORM public._credits_apply_delta(
          v_inviter_id,
          v_ref_category,
          'level1_referral',
          NULL,
          NEW.user_id
        );
        PERFORM public._credits_award_tier_badge(v_inviter_id);
      END IF;

      -- Level 2 — grandparent accumulates +0.5; settles as +1 on even count.
      SELECT inviter_id INTO v_grandparent_id
      FROM public.profiles
      WHERE id = v_inviter_id;

      IF v_grandparent_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_grandparent_id::text, 0));

        INSERT INTO public.referral_half_credit_accumulator (user_id, count)
        VALUES (v_grandparent_id, 1)
        ON CONFLICT (user_id) DO UPDATE
          SET count = public.referral_half_credit_accumulator.count + 1,
              updated_at = now()
        RETURNING count INTO v_half_count;

        IF v_half_count IS NOT NULL AND (v_half_count % 2) = 0 THEN
          v_ref_category := public._credits_pick_referral_target(v_grandparent_id);
          IF v_ref_category IS NOT NULL THEN
            PERFORM public._credits_apply_delta(
              v_grandparent_id,
              v_ref_category,
              'level2_pair',
              NULL,
              NEW.user_id
            );
            PERFORM public._credits_award_tier_badge(v_grandparent_id);
          END IF;

          -- Settle the pair regardless of whether placement succeeded; if
          -- all three categories are capped, the credit is effectively
          -- forfeit for this cycle. Revisit if product wants carry-over.
          UPDATE public.referral_half_credit_accumulator
          SET count = count - 2,
              updated_at = now()
          WHERE user_id = v_grandparent_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."on_submission_approved"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."on_submission_approved"() IS 'Handles approved submissions: credits_ledger writes, cycle closure + voucher minting, referral auto-placement (L1 + L2 pair), and tier badge promotion.';



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


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."badge_category" NOT NULL,
    "required_count" integer NOT NULL,
    "selfie_url" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "receipt_url" "text"
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


COMMENT ON TABLE "public"."badges" IS 'Defines all achievable badges and their requirements.';



CREATE SEQUENCE IF NOT EXISTS "public"."badges_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."badges_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."badges_id_seq" OWNED BY "public"."badges"."id";



CREATE TABLE IF NOT EXISTS "public"."credits_ledger" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "public"."store_category" NOT NULL,
    "delta_numerator" smallint DEFAULT 1 NOT NULL,
    "reason" "text" NOT NULL,
    "source_submission_id" bigint,
    "source_referral_id" "uuid",
    "cycle_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credits_ledger_category_eligible" CHECK (("category" = ANY (ARRAY['restaurant'::"public"."store_category", 'cafe'::"public"."store_category", 'bar'::"public"."store_category"]))),
    CONSTRAINT "credits_ledger_delta_numerator_check" CHECK (("delta_numerator" = 1)),
    CONSTRAINT "credits_ledger_reason_check" CHECK (("reason" = ANY (ARRAY['approved_submission'::"text", 'level1_referral'::"text", 'level2_pair'::"text"]))),
    CONSTRAINT "credits_ledger_referral_source_required" CHECK (((("reason" = ANY (ARRAY['level1_referral'::"text", 'level2_pair'::"text"])) AND ("source_referral_id" IS NOT NULL)) OR ("reason" = 'approved_submission'::"text"))),
    CONSTRAINT "credits_ledger_submission_source_required" CHECK (((("reason" = 'approved_submission'::"text") AND ("source_submission_id" IS NOT NULL)) OR ("reason" = ANY (ARRAY['level1_referral'::"text", 'level2_pair'::"text"]))))
);


ALTER TABLE "public"."credits_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."credits_ledger" IS 'Append-only +1 credit events per cycle. Derive per-category progress by summing delta_numerator grouped by cycle_id.';



COMMENT ON COLUMN "public"."credits_ledger"."category" IS 'Eligible categories only: restaurant, cafe, bar. Hotel and others never appear here.';



COMMENT ON COLUMN "public"."credits_ledger"."reason" IS 'approved_submission | level1_referral | level2_pair — set by the trigger, never by clients.';



COMMENT ON COLUMN "public"."credits_ledger"."cycle_id" IS 'UUID identifying the current task cycle for (user_id, category). Minted on the first row of a new cycle; subsequent rows reuse it until the cycle closes at numerator=10.';



CREATE SEQUENCE IF NOT EXISTS "public"."credits_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."credits_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."credits_ledger_id_seq" OWNED BY "public"."credits_ledger"."id";



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
    "receipt_hash" "text"
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
    CONSTRAINT "profiles_affiliate_request_status_check" CHECK (("affiliate_request_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Stores all public user data and questionnaire responses.';



COMMENT ON COLUMN "public"."profiles"."inviter_id" IS 'Tracks who invited this user, forming the affiliate tree.';



COMMENT ON COLUMN "public"."profiles"."role" IS 'Current user role: subscriber -> member -> affiliate -> admin';



COMMENT ON COLUMN "public"."profiles"."verification_completed" IS 'Whether user completed verification questionnaire to become member';



COMMENT ON COLUMN "public"."profiles"."first_approved_submission_at" IS 'Timestamp of the user''s first approved submission. NULL until that happens. Set once by the on_submission_approved trigger; never cleared.';



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



CREATE TABLE IF NOT EXISTS "public"."referral_half_credit_accumulator" (
    "user_id" "uuid" NOT NULL,
    "count" smallint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_half_credit_accumulator_count_check" CHECK (("count" >= 0))
);


ALTER TABLE "public"."referral_half_credit_accumulator" OWNER TO "postgres";


COMMENT ON TABLE "public"."referral_half_credit_accumulator" IS 'Holds unsettled Level-2 half-credits. When count becomes even, the placement trigger writes a level2_pair row to credits_ledger and decrements by 2.';



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


CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "reward_kind" "text" NOT NULL,
    "earned_from_cycle_id" "uuid" NOT NULL,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vouchers_reward_kind_check" CHECK (("reward_kind" = ANY (ARRAY['airbnb'::"text", '3_star_hotel'::"text", '4_star_hotel'::"text", 'specialty'::"text"]))),
    CONSTRAINT "vouchers_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


COMMENT ON TABLE "public"."vouchers" IS 'Hotel-stay vouchers minted on task completion. One voucher per closed cycle. Tier frozen at mint.';



COMMENT ON COLUMN "public"."vouchers"."tier" IS 'Badge tier at mint time. Later tier changes do not retroactively upgrade a voucher.';



COMMENT ON COLUMN "public"."vouchers"."earned_from_cycle_id" IS 'References the credits_ledger.cycle_id that triggered the mint. Not a FK because cycle_id appears on multiple rows; enforce via trigger invariants.';



COMMENT ON COLUMN "public"."vouchers"."redeemed_at" IS 'Set when the user claims the voucher in the Rewards subtab. NULL = unredeemed.';



ALTER TABLE ONLY "public"."badges" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."badges_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credits_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credits_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."submissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."submissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credits_ledger"
    ADD CONSTRAINT "credits_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."referral_half_credit_accumulator"
    ADD CONSTRAINT "referral_half_credit_accumulator_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_id");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_credits_ledger_source_submission" ON "public"."credits_ledger" USING "btree" ("source_submission_id") WHERE ("source_submission_id" IS NOT NULL);



CREATE INDEX "idx_credits_ledger_user_category_cycle" ON "public"."credits_ledger" USING "btree" ("user_id", "category", "cycle_id");



CREATE INDEX "idx_credits_ledger_user_created" ON "public"."credits_ledger" USING "btree" ("user_id", "created_at" DESC);



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



CREATE INDEX "idx_vouchers_user_created" ON "public"."vouchers" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_vouchers_user_unredeemed" ON "public"."vouchers" USING "btree" ("user_id") WHERE ("redeemed_at" IS NULL);



CREATE OR REPLACE TRIGGER "invitation_codes_updated_at" BEFORE UPDATE ON "public"."invitation_codes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_profile_inviter_set" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."increment_invitation_usage"();



CREATE OR REPLACE TRIGGER "on_profile_inviter_updated" AFTER UPDATE ON "public"."profiles" FOR EACH ROW WHEN ((("old"."inviter_id" IS NULL) AND ("new"."inviter_id" IS NOT NULL))) EXECUTE FUNCTION "public"."increment_invitation_usage"();



CREATE OR REPLACE TRIGGER "on_submission_approved" AFTER UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."on_submission_approved"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "submissions_updated_at" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_review_on_submission_insert" AFTER INSERT ON "public"."submissions" FOR EACH ROW WHEN (("new"."status" = 'pending'::"public"."submission_status")) EXECUTE FUNCTION "public"."trigger_ai_review_submission"();



CREATE OR REPLACE TRIGGER "trg_notify_on_badge_earned" AFTER INSERT ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_badge_earned"();



CREATE OR REPLACE TRIGGER "trg_notify_on_submission_insert" AFTER INSERT ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_submission_insert"();



CREATE OR REPLACE TRIGGER "trg_notify_on_submission_status_change" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_submission_status_change"();



CREATE OR REPLACE TRIGGER "trg_push_tokens_updated_at" BEFORE UPDATE ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_updated_at"();



ALTER TABLE ONLY "public"."credits_ledger"
    ADD CONSTRAINT "credits_ledger_source_referral_id_fkey" FOREIGN KEY ("source_referral_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credits_ledger"
    ADD CONSTRAINT "credits_ledger_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credits_ledger"
    ADD CONSTRAINT "credits_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "fk_notifications_actor_profiles" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "fk_notifications_recipient_profiles" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "fk_push_tokens_profiles" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."referral_half_credit_accumulator"
    ADD CONSTRAINT "referral_half_credit_accumulator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage all invitation codes" ON "public"."invitation_codes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can read all submissions" ON "public"."submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Admins can update notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



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



CREATE POLICY "Users can read own credits ledger" ON "public"."credits_ledger" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own half-credit accumulator" ON "public"."referral_half_credit_accumulator" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own submissions" ON "public"."submissions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own vouchers" ON "public"."vouchers" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credits_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_half_credit_accumulator" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."badges";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."_credits_active_cycle_id"("p_user_id" "uuid", "p_category" "public"."store_category") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_active_cycle_id"("p_user_id" "uuid", "p_category" "public"."store_category") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_active_cycle_id"("p_user_id" "uuid", "p_category" "public"."store_category") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_apply_delta"("p_user_id" "uuid", "p_category" "public"."store_category", "p_reason" "text", "p_submission_id" bigint, "p_referral_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_apply_delta"("p_user_id" "uuid", "p_category" "public"."store_category", "p_reason" "text", "p_submission_id" bigint, "p_referral_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_apply_delta"("p_user_id" "uuid", "p_category" "public"."store_category", "p_reason" "text", "p_submission_id" bigint, "p_referral_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_award_tier_badge"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_award_tier_badge"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_award_tier_badge"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_completed_task_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_completed_task_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_completed_task_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_pick_referral_target"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_pick_referral_target"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_pick_referral_target"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_reward_kind_for_tier"("p_tier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_reward_kind_for_tier"("p_tier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_reward_kind_for_tier"("p_tier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_credits_tier_for_task_count"("p_tasks" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_credits_tier_for_task_count"("p_tasks" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_credits_tier_for_task_count"("p_tasks" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_to_base62"("input" "bytea", OUT "txt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_badge_earned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_submission_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_submission_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_submission_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_ai_review_submission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_review"("p_submission_id" bigint, "p_status" "text", "p_admin_notes" "text", "p_reviewed_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_daily_submission_count"("uid" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credits_ledger" TO "anon";
GRANT ALL ON TABLE "public"."credits_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."credits_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credits_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credits_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credits_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."pending_submissions_view" TO "anon";
GRANT ALL ON TABLE "public"."pending_submissions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_submissions_view" TO "service_role";



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



GRANT ALL ON TABLE "public"."referral_half_credit_accumulator" TO "anon";
GRANT ALL ON TABLE "public"."referral_half_credit_accumulator" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_half_credit_accumulator" TO "service_role";



GRANT ALL ON TABLE "public"."referral_tree" TO "anon";
GRANT ALL ON TABLE "public"."referral_tree" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_tree" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



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



  create policy "Allow authenticated multipart insert"
  on "storage"."s3_multipart_uploads"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = ANY (ARRAY['submitted-selfie'::text, 'submitted-receipt'::text])));



