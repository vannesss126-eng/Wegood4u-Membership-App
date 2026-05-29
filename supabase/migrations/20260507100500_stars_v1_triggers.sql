-- Stars + Visit 10 v1 — Triggers
--
-- Two trigger functions:
--   on_submission_approved      — fires on submissions.status: → 'approved'
--                                  Handles: real visit cycle progress (R/C/B),
--                                  Category Badge threshold awards (R/C/B/H),
--                                  first-approval referral chain (L1 self/inviter, L2 grandparent),
--                                  profiles.first_approved_submission_at backfill.
--   on_submission_share_verified — fires on submission_shares.status: → 'verified'
--                                  Handles: per-platform 15-star award + all-3 bonus.
--
-- The Visit Badge tier crossing on cycle close is handled inside the
-- complete_visit_task() RPC (stars_v1_rpcs.sql), not as a separate trigger.
-- The notify_on_badge_earned trigger on user_badges (existing) stays as-is.

BEGIN;

-- ============================================================
-- on_submission_approved
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."on_submission_approved"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
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

CREATE OR REPLACE TRIGGER "on_submission_approved"
AFTER UPDATE OF "status" ON "public"."submissions"
FOR EACH ROW
WHEN (
  NEW.status = 'approved'::public.submission_status
  AND (OLD.status IS DISTINCT FROM 'approved'::public.submission_status)
)
EXECUTE FUNCTION "public"."on_submission_approved"();


-- ============================================================
-- on_submission_share_verified
-- ============================================================
-- Awards 15 stars per verified share. After the 3rd platform verifies for a
-- given submission, awards an additional +5 bonus.

CREATE OR REPLACE FUNCTION "public"."on_submission_share_verified"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
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

CREATE OR REPLACE TRIGGER "on_submission_share_verified"
AFTER UPDATE OF "status" ON "public"."submission_shares"
FOR EACH ROW
WHEN (
  NEW.status = 'verified'
  AND (OLD.status IS DISTINCT FROM 'verified')
)
EXECUTE FUNCTION "public"."on_submission_share_verified"();


COMMIT;
