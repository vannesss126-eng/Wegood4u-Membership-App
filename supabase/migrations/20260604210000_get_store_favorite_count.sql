-- Per-store favorite count for the Vendors analytics dashboard.
--
-- user_favorite_stores RLS only exposes a member's own rows (+ admin read-all),
-- so a partner can't read the count via a plain SELECT. This SECURITY DEFINER
-- RPC authorizes the caller as the store's linked partner (or an admin), then
-- returns the on-demand count. Uses user_favorite_stores_store_idx — fast and
-- always accurate, no denormalized counter to drift.

CREATE OR REPLACE FUNCTION "public"."get_store_favorite_count"("p_partner_store_id" "text")
  RETURNS bigint
  LANGUAGE "plpgsql" STABLE SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
DECLARE
  v_count bigint;
BEGIN
  -- Only the linked partner (or an admin) may read a store's favorite count.
  IF NOT (
    public.is_partner_for_store(p_partner_store_id)
    OR public.is_admin((SELECT auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Not authorized for this store';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_favorite_stores
  WHERE partner_store_id = p_partner_store_id;

  RETURN v_count;
END;
$$;

ALTER FUNCTION "public"."get_store_favorite_count"("p_partner_store_id" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_store_favorite_count"("p_partner_store_id" "text") IS
  'Returns how many members have favorited the given partner store. Authorizes the caller via is_partner_for_store / is_admin. For the Vendors analytics dashboard.';

GRANT ALL ON FUNCTION "public"."get_store_favorite_count"("p_partner_store_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_store_favorite_count"("p_partner_store_id" "text") TO "service_role";
