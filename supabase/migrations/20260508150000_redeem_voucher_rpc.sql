-- Stars + Visit 10 v1 — redeem_voucher RPC (Phase 7)
--
-- Vouchers are RLS-locked to SELECT-only for the owner; all writes flow
-- through SECURITY DEFINER RPCs. This adds the user-callable redemption.
--
-- Behaviour (per Kasey's 2026-05-07 lock):
--   • idempotent: re-tapping Redeem is a no-op
--   • flips redeemed_at; the existing notify_on_voucher_redemption_request
--     trigger fires the admin notification
--   • admin fulfills out-of-band via WhatsApp (no in-app fulfillment in v1)

BEGIN;

CREATE OR REPLACE FUNCTION "public"."redeem_voucher"("p_voucher_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_voucher record;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, redeemed_at
  INTO v_voucher
  FROM public.vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_voucher.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF v_voucher.redeemed_at IS NOT NULL THEN
    -- Idempotent: already requested — return current state without touching it.
    RETURN jsonb_build_object(
      'success', true,
      'already_redeemed', true,
      'redeemed_at', v_voucher.redeemed_at
    );
  END IF;

  UPDATE public.vouchers
  SET redeemed_at = now()
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_redeemed', false,
    'redeemed_at', now()
  );
END;
$$;

ALTER FUNCTION "public"."redeem_voucher"("uuid") OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_voucher"("uuid") TO "authenticated";

COMMIT;
