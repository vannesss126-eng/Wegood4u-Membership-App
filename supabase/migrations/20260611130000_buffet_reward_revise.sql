-- Revise the buffet reward (supersedes Phase 3 / 20260611110000).
--
-- NEW model (Kasey/Shi En, 2026-06-11): a buffet approved submission rewards the SAME
-- +1 Visit-10 point as any restaurant, PLUS 100 stars ('buffet_bonus'). The 100 stars
-- feed the existing "100 stars -> +1 bonus progress" conversion (convert_stars_to_progress),
-- which is already capped at 4 per Visit-10 cycle. So we REVERT the "+2 visit points with
-- carry-over" logic from migration 20260611110000.
--
-- Schema cleanup: the single buffet switch is now `is_buffet` (renamed from
-- enforce_diner_limit — it still drives the per-receipt diner cap AND now the 100-star
-- bonus). visit_points and pending_carryover_visits are no longer used and are dropped.
--
-- ⚠️ DEPLOY ORDER: after `supabase db push`, immediately redeploy the edge function
-- (`supabase functions deploy review-submission`) — it now reads `is_buffet`. Between the
-- push and the redeploy the old function reads the now-renamed `enforce_diner_limit`, so
-- buffet diner-cap/address checks are briefly skipped (flag-only, harmless).


-- ── 1. Schema: is_buffet replaces enforce_diner_limit; drop unused columns ──────
ALTER TABLE "public"."partner_stores" RENAME COLUMN "enforce_diner_limit" TO "is_buffet";

COMMENT ON COLUMN "public"."partner_stores"."is_buffet" IS
  'Buffet outlet flag. Drives BOTH the per-receipt diner cap (AI reviewer) and the +100 star buffet bonus on approval. Category stays Restaurant.';

-- Flag the 8 Thai Geng outlets (inserted by the companion store migration that runs first).
UPDATE "public"."partner_stores" SET "is_buffet" = true WHERE "name" ILIKE 'Thai Geng%';

-- visit_points: unused now (all restaurants give +1). Its CHECK drops with the column.
ALTER TABLE "public"."partner_stores" DROP COLUMN IF EXISTS "visit_points";

-- pending_carryover_visits: unused now (no +2 overflow to bank). CHECK drops with it.
ALTER TABLE "public"."profiles" DROP COLUMN IF EXISTS "pending_carryover_visits";


-- ── 2. Allow the new star reason 'buffet_bonus' ────────────────────────────────
ALTER TABLE "public"."star_ledger" DROP CONSTRAINT IF EXISTS "star_ledger_reason_check";
ALTER TABLE "public"."star_ledger" ADD CONSTRAINT "star_ledger_reason_check" CHECK (
  "reason" = ANY (ARRAY[
    'share_facebook'::"text", 'share_instagram'::"text", 'share_tiktok'::"text",
    'share_all_three_bonus'::"text", 'daily_streak_14'::"text", 'l1_referral'::"text",
    'l1_referral_self_bonus'::"text", 'l2_referral'::"text", 'conversion_to_progress'::"text",
    'buffet_bonus'::"text"
  ])
);
-- Idempotency of the per-submission bonus is already covered by the existing
-- "star_ledger_unique_share" index on (user_id, reason, source_submission_id).


-- ── 3. Revert _get_or_open_active_cycle (remove the carry-over drain) ───────────
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

  -- The unique partial index "visit_progress_one_open_per_user" prevents races.
  INSERT INTO public.visit_progress (user_id)
  VALUES (p_user_id)
  RETURNING cycle_id INTO v_cycle_id;

  RETURN v_cycle_id;
END;
$$;


-- ── 4. Revert _apply_real_visit to the simple +1 (uuid) signature ──────────────
DROP FUNCTION IF EXISTS "public"."_apply_real_visit"("p_user_id" "uuid", "p_points" integer);

CREATE OR REPLACE FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cycle_id uuid;
BEGIN
  v_cycle_id := public._get_or_open_active_cycle(p_user_id);

  -- Cap at 10 — defensive.
  UPDATE public.visit_progress
  SET real_visits = LEAST(real_visits + 1, 10)
  WHERE cycle_id = v_cycle_id;
END;
$$;

ALTER FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_apply_real_visit"("p_user_id" "uuid") TO "service_role";


-- ── 5. on_submission_approved: +1 visit for R/C/B, +100 stars when is_buffet ────
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
  v_is_buffet boolean;
BEGIN
  -- Only act on transitions to 'approved'.
  IF NEW.status != 'approved' OR (OLD.status IS NOT DISTINCT FROM 'approved') THEN
    RETURN NEW;
  END IF;

  -- 1. Backfill profiles.first_approved_submission_at if not set.
  UPDATE public.profiles
  SET first_approved_submission_at = now()
  WHERE id = v_user_id AND first_approved_submission_at IS NULL;

  v_was_first_approval := FOUND;  -- true iff the UPDATE actually wrote a row

  -- 2. R/C/B submissions advance the active Visit 10 cycle by 1 (buffet included —
  --    a buffet now counts the SAME as any restaurant for visit progress). Hotel does not.
  IF v_category IN ('restaurant', 'cafe', 'bar') THEN
    PERFORM public._apply_real_visit(v_user_id);
  END IF;

  -- 2b. Buffet bonus: +100 stars per approved buffet submission. The user MANUALLY
  --     converts 100 stars -> +1 bonus Visit-10 progress (convert_stars_to_progress,
  --     capped at 4/cycle). Idempotent per submission via star_ledger_unique_share.
  --
  --     PROMOTION window: July–September 2026. Auto-expires after 30 Sep 2026 (MYT).
  --     No start gate, so it can be TESTED now (before July); the end gate guarantees
  --     it stops on its own on 1 Oct 2026 without anyone remembering to switch it off.
  --     (is_buffet itself stays true permanently — it also drives the diner cap.)
  SELECT COALESCE(ps.is_buffet, false) INTO v_is_buffet
  FROM public.partner_stores ps
  WHERE ps.id = NEW.partner_store_id;

  IF v_is_buffet AND now() < timestamptz '2026-10-01 00:00:00+08' THEN
    PERFORM public._award_stars(
      p_user_id := v_user_id,
      p_delta := 100,
      p_reason := 'buffet_bonus',
      p_source_submission_id := NEW.id
    );
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
    PERFORM public._award_stars(
      p_user_id := v_user_id,
      p_delta := 100,
      p_reason := 'l1_referral_self_bonus',
      p_source_referral_user_id := v_user_id
    );

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
