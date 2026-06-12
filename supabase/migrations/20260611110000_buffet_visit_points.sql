-- Buffet outlets — Phase 3: 2 Visit-10 points per approved submission (vs 1), with carry-over.
--
-- See .agent/plans/buffet-outlets-and-outlet-referral.plan.md (Phase 3).
--
-- Today every approved restaurant/cafe/bar submission adds exactly 1 to the active
-- Visit-10 cycle. Buffet outlets (partner_stores.visit_points = 2) should add 2.
-- A cycle is capped at 10 (real_visits + extras_applied <= 10) and is completed by
-- the user tapping "Complete Tasks", so a +2 that would overflow a near-full cycle
-- is banked in profiles.pending_carryover_visits and drained into the next cycle.
--
-- Three function changes, all within this one transaction (the trigger does not fire
-- during a migration, so the brief intermediate state is harmless):
--   A. _get_or_open_active_cycle  — seed a freshly opened cycle from the carry-over bank.
--   B. _apply_real_visit          — take a points arg; fill cycle to cap, bank remainder.
--   C. on_submission_approved     — read the store's visit_points and pass it in.


-- ── A. Drain carry-over into a newly opened cycle ──────────────────────────────
-- Single chokepoint: every new cycle (submission flow, completion flow, stars-trade
-- flow) is created here, so seeding here makes the carried point appear immediately.
CREATE OR REPLACE FUNCTION "public"."_get_or_open_active_cycle"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
  v_carry int;
  v_seed int;
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

  -- Drain any banked carry-over (Visit-10 points that overflowed a previous full
  -- cycle) into this fresh cycle so the carried progress is visible right away.
  -- New cycle has extras_applied = 0, so seeding real_visits up to 10 is safe.
  SELECT pending_carryover_visits INTO v_carry
  FROM public.profiles WHERE id = p_user_id;

  IF COALESCE(v_carry, 0) > 0 THEN
    v_seed := LEAST(v_carry, 10);
    UPDATE public.visit_progress
    SET real_visits = v_seed
    WHERE cycle_id = v_cycle_id;

    UPDATE public.profiles
    SET pending_carryover_visits = pending_carryover_visits - v_seed
    WHERE id = p_user_id;
  END IF;

  RETURN v_cycle_id;
END;
$$;


-- ── B. Points-aware real-visit application with carry-over banking ─────────────
-- Old signature was _apply_real_visit(uuid) (+1, hardcoded). Only on_submission_approved
-- called it, so we drop it and create a (uuid, int) version. DEFAULT 1 keeps any
-- bare 1-arg call behaving as before.
DROP FUNCTION IF EXISTS "public"."_apply_real_visit"("p_user_id" "uuid");

CREATE OR REPLACE FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
  v_real_visits int;
  v_extras_applied int;
  v_room int;
  v_applied int;
  v_remainder int;
BEGIN
  IF p_points <= 0 THEN
    RETURN;  -- nothing to apply (defensive)
  END IF;

  -- Opens a cycle if none; also drains any carry-over into it (see function A).
  v_cycle_id := public._get_or_open_active_cycle(p_user_id);

  -- Read state AFTER any carry-over seeding so the room calc is accurate.
  SELECT real_visits, extras_applied
    INTO v_real_visits, v_extras_applied
  FROM public.visit_progress
  WHERE cycle_id = v_cycle_id;

  -- Fill the current cycle up to the 10-cap (respecting real_visits + extras <= 10),
  -- bank any remainder as carry-over for the next cycle.
  v_room := 10 - (v_real_visits + v_extras_applied);
  v_applied := LEAST(p_points, GREATEST(v_room, 0));
  v_remainder := p_points - v_applied;

  IF v_applied > 0 THEN
    UPDATE public.visit_progress
    SET real_visits = real_visits + v_applied
    WHERE cycle_id = v_cycle_id;
  END IF;

  IF v_remainder > 0 THEN
    UPDATE public.profiles
    SET pending_carryover_visits = pending_carryover_visits + v_remainder
    WHERE id = p_user_id;
  END IF;
END;
$$;

ALTER FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer) TO "service_role";


-- ── C. Award the store's visit_points on approval ──────────────────────────────
-- Identical to the existing trigger except: step 2 now reads partner_stores.visit_points
-- (default 1; buffet = 2) and passes it to _apply_real_visit. Added v_points to DECLARE.
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
  v_points int;
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
  --    Points per approved submission come from the store (buffet outlets = 2,
  --    everything else = 1). Falls back to 1 if the store row / id is missing.
  IF v_category IN ('restaurant', 'cafe', 'bar') THEN
    SELECT COALESCE(ps.visit_points, 1) INTO v_points
    FROM public.partner_stores ps
    WHERE ps.id = NEW.partner_store_id;

    PERFORM public._apply_real_visit(v_user_id, COALESCE(v_points, 1));
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
