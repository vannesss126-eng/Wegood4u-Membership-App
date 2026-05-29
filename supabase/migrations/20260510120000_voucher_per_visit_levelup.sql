-- Stars + Visit 10 v1 — Voucher mint moves from per-cycle to per-Visit-Badge-level-up
--
-- Replaces the original "1 voucher per closed cycle" rule with "1 voucher per
-- Visit Badge level achieved" — capping lifetime mints at 12 (Bronze L1 → Platinum L3).
-- Reasoning: per-cycle minting overproduces vouchers (45 cycles → 45 vouchers vs the
-- new 12 max), per Wegood4u 2026-05-10. Category Badges still mint nothing — the
-- 60-credit broader scheme is parked pending Kasey's input (see project memory).
--
-- Changes in order:
--   1. ADD vouchers.fulfilled_at  — admin "Mark fulfilled" flag (Redeem Req tab)
--   2. ADD vouchers.earned_from_badge_id — FK to badges.id, the level entered
--   3. CREATE mint_voucher_on_visit_levelup() trigger function
--   4. CREATE TRIGGER on user_badges AFTER INSERT, filtered to visit-kind badges
--   5. REWRITE complete_visit_task() — close + level-eval + open new; voucher mint
--      now happens via the trigger. Returns the voucher_id if a level crossed,
--      otherwise NULL.

BEGIN;

-- ============================================================
-- 1 + 2. Voucher columns
-- ============================================================

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "earned_from_badge_id" bigint
    REFERENCES public.badges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "vouchers_fulfilled_at_idx"
  ON public.vouchers (fulfilled_at);

COMMENT ON COLUMN public.vouchers.fulfilled_at IS
  'Set by admin in Tasks → Redeem Req tab once they have contacted the user via WhatsApp / email to deliver the voucher. Sibling of redeemed_at.';
COMMENT ON COLUMN public.vouchers.earned_from_badge_id IS
  'The badges.id of the Visit Badge level that minted this voucher. NULL for legacy rows minted by the pre-2026-05-10 per-cycle logic.';


-- ============================================================
-- 3. mint_voucher_on_visit_levelup
-- ============================================================
-- Fires after a user_badges row is inserted. Filtered to badge_kind='visit'
-- via the trigger WHEN clause so we don't pay the function-call cost for
-- Category Badge inserts. Joins to `badges` to read tier+level+reward_kind,
-- writes a vouchers row of that tier.
--
-- Idempotency: user_badges has UNIQUE (user_id, badge_id) so the same level
-- can never insert twice. No need for ON CONFLICT here.

-- The badge_kind='visit' filter is enforced inside the function, not in a
-- trigger WHEN clause — Postgres doesn't allow subqueries in WHEN.

CREATE OR REPLACE FUNCTION "public"."mint_voucher_on_visit_levelup"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
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


-- ============================================================
-- 4. Trigger on user_badges
-- ============================================================

DROP TRIGGER IF EXISTS "trg_mint_voucher_on_visit_levelup" ON "public"."user_badges";

CREATE TRIGGER "trg_mint_voucher_on_visit_levelup"
AFTER INSERT ON "public"."user_badges"
FOR EACH ROW
EXECUTE FUNCTION "public"."mint_voucher_on_visit_levelup"();


-- ============================================================
-- 5. Rewrite complete_visit_task
-- ============================================================
-- Closes the active cycle, evaluates Visit Badge level crossings, opens a
-- new cycle. Voucher minting is now handled by trg_mint_voucher_on_visit_levelup
-- on the user_badges INSERT below.
--
-- Returns: the newly-minted voucher_id (uuid) if the close crossed a level,
-- otherwise NULL. Each call mints AT MOST one voucher because Visit Badge
-- thresholds are spaced ≥ 1 cycle apart.

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

GRANT EXECUTE ON FUNCTION "public"."complete_visit_task"() TO "authenticated";

COMMIT;
