-- Stars + Visit 10 v1 — RPCs / helper functions
--
-- Helper functions (internal, called by triggers and RPCs):
--   _award_stars         — append to star_ledger + update star_wallet, idempotent
--   _apply_real_visit    — increment real_visits on user's active cycle
--   _get_or_open_active_cycle — ensure user has an open visit_progress row
--   _visit_badge_tier_level   — derive (tier, level) from completed-cycle count
--   _voucher_kind_for_tier    — map Visit Badge tier → reward_kind
--
-- Client-facing RPCs (SECURITY DEFINER, callable from authenticated users):
--   trade_stars_for_progress  — manual trade button: 100 ★ → +1 progress
--   complete_visit_task       — manual claim: mint voucher, reset cycle
--   record_daily_checkin      — daily check-in button

BEGIN;

-- ============================================================
-- _visit_badge_tier_level: pure function, derives tier+level
-- ============================================================
-- Mirrors visitBadgeFor() in badges.md. Returns (tier, level) text/int pair.

CREATE OR REPLACE FUNCTION "public"."_visit_badge_tier_level"("p_completed_cycles" integer)
RETURNS TABLE("tier" "text", "level" integer)
LANGUAGE "plpgsql"
IMMUTABLE
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

ALTER FUNCTION "public"."_visit_badge_tier_level"(integer) OWNER TO "postgres";


-- ============================================================
-- _voucher_kind_for_tier: pure mapping
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."_voucher_kind_for_tier"("p_tier" "text")
RETURNS "text"
LANGUAGE "plpgsql"
IMMUTABLE
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

ALTER FUNCTION "public"."_voucher_kind_for_tier"("text") OWNER TO "postgres";


-- ============================================================
-- _award_stars: insert ledger row + update wallet (idempotent)
-- ============================================================
-- Idempotency comes from the unique partial indexes on star_ledger:
--   (user_id, reason, source_submission_id) WHERE source_submission_id NOT NULL
--   (user_id, reason, source_referral_user_id) WHERE source_referral_user_id NOT NULL
--   (user_id, reason, source_checkin_id) WHERE source_checkin_id NOT NULL
-- INSERT ... ON CONFLICT DO NOTHING relies on these.
--
-- Returns true if a new ledger row was written, false if conflict (idempotent skip).

CREATE OR REPLACE FUNCTION "public"."_award_stars"(
  "p_user_id" "uuid",
  "p_delta" integer,
  "p_reason" "text",
  "p_source_submission_id" bigint DEFAULT NULL,
  "p_source_referral_user_id" "uuid" DEFAULT NULL,
  "p_source_checkin_id" bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
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

ALTER FUNCTION "public"."_award_stars"("uuid", integer, "text", bigint, "uuid", bigint) OWNER TO "postgres";


-- ============================================================
-- _get_or_open_active_cycle: ensure the user has an open cycle
-- ============================================================
-- Returns the cycle_id of the user's open visit_progress row, opening one
-- if none exists. Idempotent — safe to call repeatedly.

CREATE OR REPLACE FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid")
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
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

ALTER FUNCTION "public"."_get_or_open_active_cycle"("uuid") OWNER TO "postgres";


-- ============================================================
-- _apply_real_visit: increment real_visits on active cycle
-- ============================================================
-- Called from on_submission_approved trigger when an R/C/B submission is
-- approved. Hotel approvals don't call this (Hotel doesn't earn cycle progress).

CREATE OR REPLACE FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql"
SECURITY DEFINER
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

ALTER FUNCTION "public"."_apply_real_visit"("uuid") OWNER TO "postgres";


-- ============================================================
-- trade_stars_for_progress: manual trade button RPC
-- ============================================================
-- Called from client when user taps "Use 100 ★ for +1 Progress".
-- Atomic: deducts 100 stars, adds +1 to active cycle's extras_applied,
-- writes ledger row. Returns new wallet + cycle state.

CREATE OR REPLACE FUNCTION "public"."trade_stars_for_progress"()
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
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


-- ============================================================
-- complete_visit_task: manual claim RPC
-- ============================================================
-- Called from client when user taps "Complete Tasks & Claim" at 10/10.
-- Mints 1 voucher at user's current Visit Badge tier, closes cycle, opens
-- a new one, evaluates Visit Badge tier crossing.
-- Returns the minted voucher_id.

CREATE OR REPLACE FUNCTION "public"."complete_visit_task"()
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_cycle_id uuid;
  v_real_visits int;
  v_extras_applied int;
  v_completed_cycles int;
  v_tier text;
  v_level int;
  v_reward_kind text;
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

  -- Count completed cycles INCLUDING this one (for tier snapshot).
  -- Close this cycle first so the count reflects the new state.
  UPDATE public.visit_progress
  SET closed_at = now()
  WHERE cycle_id = v_cycle_id;

  SELECT count(*) INTO v_completed_cycles
  FROM public.visit_progress
  WHERE user_id = v_user_id AND closed_at IS NOT NULL;

  -- Snapshot Visit Badge tier+level at mint time.
  SELECT tier, level INTO v_tier, v_level
  FROM public._visit_badge_tier_level(v_completed_cycles);

  IF v_tier IS NULL THEN
    -- Shouldn't happen since closing this cycle implies count >= 1.
    RAISE EXCEPTION 'Could not derive Visit Badge tier from cycle count %', v_completed_cycles;
  END IF;

  v_reward_kind := public._voucher_kind_for_tier(v_tier);

  -- Mint voucher.
  INSERT INTO public.vouchers (
    user_id, badge_kind, tier, level, reward_kind, earned_from_cycle_id
  )
  VALUES (
    v_user_id, 'visit', v_tier, v_level, v_reward_kind, v_cycle_id
  )
  RETURNING id INTO v_voucher_id;

  -- Open new cycle (idempotent; the unique partial index protects against races).
  PERFORM public._get_or_open_active_cycle(v_user_id);

  -- Visit Badge tier crossing: insert any newly-unlocked badges into user_badges.
  -- Walk active badges where badge_kind='visit' and required_count <= v_completed_cycles.
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id
  FROM public.badges b
  WHERE b.is_active = true
    AND b.badge_kind = 'visit'
    AND b.required_count <= v_completed_cycles
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN v_voucher_id;
END;
$$;

ALTER FUNCTION "public"."complete_visit_task"() OWNER TO "postgres";


-- ============================================================
-- record_daily_checkin: daily check-in button RPC
-- ============================================================
-- Called from client when user taps "Check in today".
-- - Day boundary in Asia/Kuala_Lumpur.
-- - Uniqueness on (user_id, checkin_date) blocks double-tap.
-- - If yesterday's checkin exists: streak++. Else: streak = 1.
-- - On streak % 14 == 0: award 50 stars via _award_stars.

CREATE OR REPLACE FUNCTION "public"."record_daily_checkin"()
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
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


-- ============================================================
-- Grants for client-callable RPCs
-- ============================================================

GRANT EXECUTE ON FUNCTION "public"."trade_stars_for_progress"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."complete_visit_task"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."record_daily_checkin"() TO "authenticated";

-- Internal helpers — only callable by SECURITY DEFINER functions and triggers.
-- Do NOT grant to authenticated.

COMMIT;
