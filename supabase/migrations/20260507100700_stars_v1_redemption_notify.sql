-- Stars + Visit 10 v1 — Voucher redemption notification trigger
--
-- Fires when vouchers.redeemed_at transitions NULL → NOT NULL (the user
-- tapped Redeem in the app). v1 is admin-fulfilled out-of-band via
-- WhatsApp/email; this trigger writes the audit notifications that drive
-- both surfaces:
--
--   1. Receipt to the requesting user
--      action = 'voucher_redemption_requested'
--   2. Alert to every admin (drives the manual fulfillment queue)
--      action = 'voucher_redemption_admin_alert'
--
-- Both rows reference the voucher via object_type='voucher', object_id=id::text.
-- See documentation/notifications.md for the action vocabulary.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."notify_on_voucher_redemption_request"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_data jsonb;
BEGIN
  v_data := jsonb_build_object(
    'voucher_id',  NEW.id,
    'badge_kind',  NEW.badge_kind,
    'tier',        NEW.tier,
    'level',       NEW.level,
    'reward_kind', NEW.reward_kind,
    'redeemed_at', NEW.redeemed_at
  );

  -- 1. Receipt to the requesting user.
  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    'voucher_redemption_requested',
    'voucher',
    NEW.id::text,
    v_data
  );

  -- 2. Admin alert — one row per admin, drives manual fulfillment queue.
  INSERT INTO public.notifications (recipient_id, actor_id, action, object_type, object_id, data)
  SELECT p.id,
         NEW.user_id,
         'voucher_redemption_admin_alert',
         'voucher',
         NEW.id::text,
         v_data
  FROM public.profiles p
  WHERE p.role = 'admin';

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."notify_on_voucher_redemption_request"() OWNER TO "postgres";

-- Strict NULL → NOT NULL transition only. Re-redeeming should not fan out
-- duplicate notifications; the UI hides the Redeem control once redeemed_at
-- is set, but defense in depth.
CREATE OR REPLACE TRIGGER "notify_on_voucher_redemption_request"
AFTER UPDATE OF "redeemed_at" ON "public"."vouchers"
FOR EACH ROW
WHEN (
  OLD.redeemed_at IS NULL
  AND NEW.redeemed_at IS NOT NULL
)
EXECUTE FUNCTION "public"."notify_on_voucher_redemption_request"();

COMMIT;
