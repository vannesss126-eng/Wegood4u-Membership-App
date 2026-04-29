-- Fix: get_user_activity throws 42702 "column reference 'event_at' is
-- ambiguous" because `event_at` is both a RETURNS TABLE output column and
-- a column referenced inside the CTEs. PL/pgSQL treats the OUT column as
-- an in-scope variable during RETURN QUERY, which collides with the
-- unqualified `event_at` in the `filtered` CTE's WHERE clause.
--
-- Two-part fix:
--   1. Add `#variable_conflict use_column` so column references win when
--      they clash with OUT parameters.
--   2. Fully qualify `event_at` in the filtered CTE for readability.

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

ALTER FUNCTION public.get_user_activity(int, int) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_activity(int, int) IS
  'Paginated unified activity feed for the calling user. Returns total_count via window function so the UI can render numbered pagination.';

REVOKE ALL ON FUNCTION public.get_user_activity(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_activity(int, int) TO authenticated;
