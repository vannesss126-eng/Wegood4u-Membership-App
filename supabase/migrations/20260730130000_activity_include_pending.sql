-- Include PENDING submissions in the member activity feed.
--
-- Previously get_user_activity only surfaced approved/rejected submissions, so a
-- member had no way to see a proof they'd just submitted — confusing ("did it go
-- through?"). This adds 'pending' to the submissions branch so a just-submitted
-- proof appears in History as event_type = 'submission_pending'. Everything else
-- (event_at = updated_at/created_at for pending, ordering, pagination) is
-- unchanged. Grants are preserved by CREATE OR REPLACE.

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
    -- 1. Submissions approved / rejected / pending
    SELECT
      ('submission_' || s.status)::text                   AS event_type,
      COALESCE(s.reviewed_at, s.updated_at, s.created_at) AS event_at,
      s.partner_store_name                                AS target,
      jsonb_build_object(
        'submission_id',         s.id,
        'status',                s.status,
        'category',              s.partner_store_category,
        'counts_for_visit_10',
          (s.status = 'approved'
           AND s.partner_store_category IN ('restaurant','cafe','bar'))
      )                                                   AS metadata
    FROM public.submissions s
    WHERE s.user_id = v_user_id
      AND s.status IN ('approved','rejected','pending')

    UNION ALL

    -- 2a. Per-platform verified social shares (+15 stars each)
    SELECT
      'share_verified'::text                              AS event_type,
      ss.verified_at                                      AS event_at,
      ('Shared ' || COALESCE(s.partner_store_name, 'visit')
                 || ' on ' || INITCAP(ss.platform))::text AS target,
      jsonb_build_object(
        'share_id',           ss.id,
        'submission_id',      ss.submission_id,
        'platform',           ss.platform,
        'partner_store_name', s.partner_store_name,
        'stars_awarded',      15,
        'bonus',              false
      )                                                   AS metadata
    FROM public.submission_shares ss
    JOIN public.submissions s ON s.id = ss.submission_id
    WHERE ss.user_id = v_user_id
      AND ss.status  = 'verified'

    UNION ALL

    -- 2b. All-three platforms bonus (+5 stars), surfaced as its own row
    SELECT
      'share_verified'::text                              AS event_type,
      sl.created_at                                       AS event_at,
      'All-three platform bonus'::text                    AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'submission_id', sl.source_submission_id,
        'stars_awarded', sl.delta_stars,
        'bonus',         true
      )                                                   AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'share_all_three_bonus'

    UNION ALL

    -- 3. Daily streak milestone (every 14-day boundary)
    SELECT
      'daily_streak_milestone'::text                                            AS event_type,
      sl.created_at                                                             AS event_at,
      ((ROW_NUMBER() OVER (PARTITION BY sl.user_id ORDER BY sl.id)) * 14
        || '-day streak completed')::text                                       AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'streak_days',   (ROW_NUMBER() OVER (PARTITION BY sl.user_id ORDER BY sl.id)) * 14,
        'stars_awarded', sl.delta_stars
      )                                                                         AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'daily_streak_14'

    UNION ALL

    -- 4. Referral qualified (L1/L2 inviter-side awards only — self-bonus excluded)
    SELECT
      'referral_qualified'::text                                                AS event_type,
      sl.created_at                                                             AS event_at,
      (COALESCE(NULLIF(p.full_name, ''), 'Invitee')
        || ' qualified ('
        || CASE sl.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END
        || ')')::text                                                           AS target,
      jsonb_build_object(
        'ledger_id',     sl.id,
        'level',         CASE sl.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END,
        'invitee_id',    sl.source_referral_user_id,
        'invitee_name',  p.full_name,
        'stars_awarded', sl.delta_stars
      )                                                                         AS metadata
    FROM public.star_ledger sl
    LEFT JOIN public.profiles p ON p.id = sl.source_referral_user_id
    WHERE sl.user_id = v_user_id
      AND sl.reason IN ('l1_referral','l2_referral')

    UNION ALL

    -- 5. Manual stars → Visit 10 progress trade
    SELECT
      'stars_converted'::text                             AS event_type,
      sl.created_at                                       AS event_at,
      'Stars → Visit 10 progress'::text                   AS target,
      jsonb_build_object(
        'ledger_id',      sl.id,
        'cycle_id',       sl.cycle_id,
        'stars_consumed', ABS(sl.delta_stars),
        'progress_added', 1
      )                                                   AS metadata
    FROM public.star_ledger sl
    WHERE sl.user_id = v_user_id
      AND sl.reason  = 'conversion_to_progress'

    UNION ALL

    -- 6. Cycle completed (10/10 → user tapped Complete Tasks → voucher minted)
    SELECT
      'cycle_completed'::text                             AS event_type,
      vp.closed_at                                        AS event_at,
      'Visit 10 Task completed'::text                     AS target,
      jsonb_build_object(
        'cycle_id',       vp.cycle_id,
        'opened_at',      vp.opened_at,
        'closed_at',      vp.closed_at,
        'real_visits',    vp.real_visits,
        'extras_applied', vp.extras_applied
      )                                                   AS metadata
    FROM public.visit_progress vp
    WHERE vp.user_id  = v_user_id
      AND vp.closed_at IS NOT NULL

    UNION ALL

    -- 7. Visit Badge earned (driven by completed cycles)
    SELECT
      'visit_badge_earned'::text                                                AS event_type,
      ub.earned_at                                                              AS event_at,
      ('Visit Badge — ' || INITCAP(b.tier) || ' L' || b.level)::text            AS target,
      jsonb_build_object(
        'badge_id',   ub.badge_id,
        'tier',       b.tier,
        'level',      b.level,
        'badge_kind', 'visit'
      )                                                                         AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id   = v_user_id
      AND b.badge_kind = 'visit'

    UNION ALL

    -- 8. Category Badge earned (per-category R/C/B/H)
    SELECT
      'category_badge_earned'::text                                             AS event_type,
      ub.earned_at                                                              AS event_at,
      (INITCAP(b.badge_kind) || ' Badge — ' || INITCAP(b.tier)
        || ' L' || b.level)::text                                               AS target,
      jsonb_build_object(
        'badge_id',       ub.badge_id,
        'badge_kind',     b.badge_kind,
        'tier',           b.tier,
        'level',          b.level,
        'required_count', b.required_count
      )                                                                         AS metadata
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id    = v_user_id
      AND b.badge_kind IN ('cafe','bar','restaurant','hotel')

    UNION ALL

    -- 9. Voucher redemption requested (admin fulfills out-of-band in v1)
    SELECT
      'voucher_redemption_requested'::text                                      AS event_type,
      v.redeemed_at                                                             AS event_at,
      ('Requested ' || replace(v.reward_kind, '_', ' ') || ' voucher')::text    AS target,
      jsonb_build_object(
        'voucher_id',  v.id,
        'badge_kind',  v.badge_kind,
        'tier',        v.tier,
        'level',       v.level,
        'reward_kind', v.reward_kind
      )                                                                         AS metadata
    FROM public.vouchers v
    WHERE v.user_id     = v_user_id
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
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;
