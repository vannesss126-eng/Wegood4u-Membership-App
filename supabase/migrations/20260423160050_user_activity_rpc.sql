-- Phase 1.5 — unified user activity feed.
--
-- Drives the My Tasks "last 5 history" snippet and the standalone History
-- page (Phase 4). Returns a paginated, newest-first union of four event
-- types: submissions (approved/rejected), badges earned, task completions,
-- and voucher redemptions.
--
-- Auth model: SECURITY DEFINER + explicit auth.uid() check. Callers cannot
-- request another user's activity. Admins querying other users should hit
-- the underlying tables directly via dashboard.
--
-- Source: .agent/documentation/credits-overview.md "History feed — event types"

CREATE OR REPLACE FUNCTION public.get_user_activity(
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  event_type text,
  event_at   timestamptz,
  target     text,
  metadata   jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Approved / rejected submissions
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

    -- Badges earned
    SELECT
      'badge_earned'::text              AS event_type,
      ub.earned_at                       AS event_at,
      COALESCE(b.name, 'Badge')          AS target,
      jsonb_build_object(
        'badge_id',       ub.badge_id,
        'badge_category', b.category,
        'required_count', b.required_count
      )                                   AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id = v_user_id

    UNION ALL

    -- Task completions (cycle closures). The "closing row" of a cycle is the
    -- row that brought the cycle's numerator to >= 10 — i.e. the highest id
    -- among rows in that cycle. Its created_at is used as the event time.
    SELECT
      'task_completed'::text     AS event_type,
      closing.created_at          AS event_at,
      closing.category::text      AS target,
      jsonb_build_object(
        'category', closing.category,
        'cycle_id', closing.cycle_id
      )                           AS metadata
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

    -- Vouchers redeemed
    SELECT
      'voucher_redeemed'::text   AS event_type,
      v.redeemed_at               AS event_at,
      v.reward_kind               AS target,
      jsonb_build_object(
        'voucher_id',  v.id,
        'tier',        v.tier,
        'reward_kind', v.reward_kind
      )                           AS metadata
    FROM public.vouchers v
    WHERE v.user_id = v_user_id
      AND v.redeemed_at IS NOT NULL
  )
  SELECT e.event_type, e.event_at, e.target, e.metadata
  FROM events e
  WHERE e.event_at IS NOT NULL
  ORDER BY e.event_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

ALTER FUNCTION public.get_user_activity(int, int) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_activity(int, int) IS
  'Paginated unified activity feed for the calling user. Drives My Tasks history snippet and the standalone History page. Event types: submission_approved, submission_rejected, badge_earned, task_completed, voucher_redeemed.';

-- Authenticated users only; anon cannot call.
REVOKE ALL ON FUNCTION public.get_user_activity(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_activity(int, int) TO authenticated;
