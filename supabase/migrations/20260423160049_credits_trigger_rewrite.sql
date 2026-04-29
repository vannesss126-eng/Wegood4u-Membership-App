-- Phase 1.4 — on_submission_approved trigger rewrite.
--
-- Replaces the credit/badge logic of check_and_award_badges with a trigger
-- that writes to credits_ledger, closes cycles, mints vouchers, runs referral
-- placement, and awards tier badges. The old check_and_award_badges function
-- is intentionally left on disk for manual rollback.
--
-- Sources:
--   .agent/documentation/credits-overview.md
--   .agent/documentation/referral-system.md
--   .agent/documentation/badge-rewards.md
--
-- Concurrency:
--   Each user's ledger writes are serialised via pg_advisory_xact_lock keyed
--   on user_id, so concurrent approvals for the same user never race on
--   cycle_id or the half-credit accumulator.

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- Returns the active cycle_id for (user, category) if one is open (numerator
-- < 10), otherwise mints a new uuid. Callers always use the returned value
-- when inserting a ledger row.
CREATE OR REPLACE FUNCTION public._credits_active_cycle_id(
  p_user_id uuid,
  p_category public.store_category
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
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

ALTER FUNCTION public._credits_active_cycle_id(uuid, public.store_category) OWNER TO postgres;


-- Pick the target category for a referral credit:
--   - nearest-complete in its active cycle (highest numerator/10 ratio)
--   - tie-break: restaurant > cafe > bar
--   - skip categories already carrying 4 referral rows this cycle
--   - NULL if all three categories are capped (caller should no-op)
CREATE OR REPLACE FUNCTION public._credits_pick_referral_target(
  p_user_id uuid
) RETURNS public.store_category
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
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

ALTER FUNCTION public._credits_pick_referral_target(uuid) OWNER TO postgres;


-- Tier from cumulative completed-task count, per Kasey's 5/15/35 thresholds.
CREATE OR REPLACE FUNCTION public._credits_tier_for_task_count(
  p_tasks int
) RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tasks >= 35 THEN 'platinum'
    WHEN p_tasks >= 15 THEN 'gold'
    WHEN p_tasks >= 5  THEN 'silver'
    ELSE 'bronze'
  END;
$$;

ALTER FUNCTION public._credits_tier_for_task_count(int) OWNER TO postgres;


-- Reward kind for a given tier, per badge-rewards.md.
CREATE OR REPLACE FUNCTION public._credits_reward_kind_for_tier(
  p_tier text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'bronze'   THEN 'airbnb'
    WHEN 'silver'   THEN '3_star_hotel'
    WHEN 'gold'     THEN '4_star_hotel'
    WHEN 'platinum' THEN 'specialty'
  END;
$$;

ALTER FUNCTION public._credits_reward_kind_for_tier(text) OWNER TO postgres;


-- Count of completed cycles across eligible categories for a user.
CREATE OR REPLACE FUNCTION public._credits_completed_task_count(
  p_user_id uuid
) RETURNS int
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
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

ALTER FUNCTION public._credits_completed_task_count(uuid) OWNER TO postgres;


-- Apply a +1 credit for (user, category, reason). If the write closes the
-- cycle (numerator == 10), mint a voucher at the user's current tier.
-- Returns true if the cycle closed on this call.
CREATE OR REPLACE FUNCTION public._credits_apply_delta(
  p_user_id uuid,
  p_category public.store_category,
  p_reason text,
  p_submission_id bigint,
  p_referral_id uuid
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
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

ALTER FUNCTION public._credits_apply_delta(uuid, public.store_category, text, bigint, uuid) OWNER TO postgres;


-- Award every badge whose required_count <= user's task count. No-op when no
-- matching badge row exists (e.g. before the new tier badges are seeded —
-- Phase 5 blocker). Existing legacy activity-category badges with
-- required_count like 1/5/10 will still award, which is acceptable during
-- the transition.
CREATE OR REPLACE FUNCTION public._credits_award_tier_badge(
  p_user_id uuid
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
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

ALTER FUNCTION public._credits_award_tier_badge(uuid) OWNER TO postgres;


-- ===========================================================================
-- Main trigger function
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.on_submission_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.on_submission_approved() OWNER TO postgres;

COMMENT ON FUNCTION public.on_submission_approved() IS
  'Handles approved submissions: credits_ledger writes, cycle closure + voucher minting, referral auto-placement (L1 + L2 pair), and tier badge promotion.';


-- ===========================================================================
-- Re-point the existing trigger at the new function. Old check_and_award_badges
-- function is left on disk; nothing calls it now.
-- ===========================================================================

DROP TRIGGER IF EXISTS on_submission_approved ON public.submissions;

CREATE TRIGGER on_submission_approved
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_submission_approved();


-- ===========================================================================
-- Notify on badge earned — closes the "Badges are silent" gap in
-- .agent/documentation/notifications.md.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.notify_on_badge_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.notify_on_badge_earned() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_notify_on_badge_earned ON public.user_badges;

CREATE TRIGGER trg_notify_on_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_badge_earned();
