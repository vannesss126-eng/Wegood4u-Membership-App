-- Stars + Visit 10 v1 — In-app notifications for new event types (Phase 6)
--
-- Adds notification-write triggers for the two new event types that the user
-- might miss otherwise:
--   • share_verified      — admin (or future AI) flipped a share to verified
--                           AFTER the user submitted; user sees the +15 ★
--   • referral_qualified  — someone the user invited got their first approval;
--                           user might be away from the app entirely
--
-- Skipped on purpose:
--   • daily_streak_milestone   — toast on the check-in tap covers it
--   • stars_converted          — user just clicked Trade
--   • cycle_completed          — user just clicked Complete Tasks
--   • voucher_redemption_*     — already covered by 100700 migration
--   • visit_badge_earned       — already covered by notify_on_badge_earned
--   • category_badge_earned    — already covered by notify_on_badge_earned
--
-- Notification schema (existing):
--   recipient_id, actor_id?, action, object_type, object_id, data jsonb

BEGIN;

-- ============================================================
-- notify_on_share_verified
-- ============================================================
-- Fires when submission_shares.status flips to 'verified'. Note this is
-- separate from on_submission_share_verified (which awards stars); both fire
-- on the same UPDATE but write to different tables. Errors are swallowed so
-- a notification failure can't block the star award.

CREATE OR REPLACE FUNCTION "public"."notify_on_share_verified"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_store_name text;
BEGIN
  IF NEW.status != 'verified' OR (OLD.status IS NOT DISTINCT FROM 'verified') THEN
    RETURN NEW;
  END IF;

  SELECT partner_store_name INTO v_store_name
  FROM public.submissions
  WHERE id = NEW.submission_id;

  INSERT INTO public.notifications (recipient_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    'share_verified',
    'share',
    NEW.id::text,
    jsonb_build_object(
      'platform',           NEW.platform,
      'submission_id',      NEW.submission_id,
      'partner_store_name', v_store_name,
      'stars_awarded',      15
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'share-verified notification failed for share %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."notify_on_share_verified"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_notify_on_share_verified" ON "public"."submission_shares";
CREATE TRIGGER "trg_notify_on_share_verified"
AFTER UPDATE OF "status" ON "public"."submission_shares"
FOR EACH ROW
WHEN (
  NEW.status = 'verified'
  AND (OLD.status IS DISTINCT FROM 'verified')
)
EXECUTE FUNCTION "public"."notify_on_share_verified"();


-- ============================================================
-- notify_on_referral_qualified
-- ============================================================
-- Fires when an L1 or L2 referral award row lands in star_ledger. The
-- recipient is the inviter (sl.user_id); source_referral_user_id is the
-- invitee whose first approval triggered the chain. We surface the invitee's
-- name in the data payload so the UI can render "{name} qualified".
--
-- Self-bonus (l1_referral_self_bonus) is intentionally skipped — that one
-- targets the user who just got approved, who already saw the approval toast.

CREATE OR REPLACE FUNCTION "public"."notify_on_referral_qualified"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_invitee_name text;
BEGIN
  IF NEW.reason NOT IN ('l1_referral','l2_referral') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Invitee')
    INTO v_invitee_name
  FROM public.profiles
  WHERE id = NEW.source_referral_user_id;

  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    NEW.source_referral_user_id,
    'referral_qualified',
    'referral',
    NEW.id::text,
    jsonb_build_object(
      'level',         CASE NEW.reason WHEN 'l1_referral' THEN 'L1' ELSE 'L2' END,
      'invitee_id',    NEW.source_referral_user_id,
      'invitee_name',  v_invitee_name,
      'stars_awarded', NEW.delta_stars
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'referral-qualified notification failed for ledger %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."notify_on_referral_qualified"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_notify_on_referral_qualified" ON "public"."star_ledger";
CREATE TRIGGER "trg_notify_on_referral_qualified"
AFTER INSERT ON "public"."star_ledger"
FOR EACH ROW
WHEN (NEW.reason IN ('l1_referral','l2_referral'))
EXECUTE FUNCTION "public"."notify_on_referral_qualified"();

COMMIT;
