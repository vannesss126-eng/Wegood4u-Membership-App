-- Phase 4 prep — extend get_user_activity to return total_count alongside rows.
--
-- The History page (Phase 4 of tasks-redesign.plan.md) needs numbered
-- pagination, which requires knowing the total event count for the user.
-- A separate count RPC would mean two round-trips per page; cheaper to use
-- a window function inside the existing RPC.
--
-- We DROP and recreate because RETURNS TABLE signature is changing
-- (added total_count column).

DROP FUNCTION IF EXISTS public.get_user_activity(int, int);

CREATE OR REPLACE FUNCTION public.get_user_activity(
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  event_type   text,
  event_at     timestamptz,
  target       text,
  metadata     jsonb,
  total_count  bigint
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

    -- Task completions (cycle closures).
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
  ),
  filtered AS (
    SELECT * FROM events WHERE event_at IS NOT NULL
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

ALTER FUNCTION public.get_user_activity(int, int) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_activity(int, int) IS
  'Paginated unified activity feed for the calling user. Returns total_count via window function so the UI can render numbered pagination.';

REVOKE ALL ON FUNCTION public.get_user_activity(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_activity(int, int) TO authenticated;
