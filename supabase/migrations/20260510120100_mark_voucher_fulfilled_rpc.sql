-- Stars + Visit 10 v1 — mark_voucher_fulfilled RPC (Phase 7 admin queue)
--
-- Admin sets vouchers.fulfilled_at after handing the user their voucher
-- via WhatsApp / email. RLS on vouchers is SELECT-only for owners + admins,
-- so writes flow through this SECURITY DEFINER RPC.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."mark_voucher_fulfilled"("p_voucher_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_voucher record;
BEGIN
  v_admin_id := (SELECT auth.uid());
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  SELECT id, redeemed_at, fulfilled_at
    INTO v_voucher
  FROM public.vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_voucher.redeemed_at IS NULL THEN
    -- Can't fulfill what hasn't been requested.
    RETURN jsonb_build_object('success', false, 'reason', 'not_redeemed');
  END IF;

  IF v_voucher.fulfilled_at IS NOT NULL THEN
    -- Idempotent.
    RETURN jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'fulfilled_at', v_voucher.fulfilled_at
    );
  END IF;

  UPDATE public.vouchers
  SET fulfilled_at = now()
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_fulfilled', false,
    'fulfilled_at', now()
  );
END;
$$;

ALTER FUNCTION "public"."mark_voucher_fulfilled"("uuid") OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."mark_voucher_fulfilled"("uuid") TO "authenticated";

COMMIT;
