-- Unify referral-code lookup for the signup "Invitation Code" field.
--
-- The register screen has ONE input that may carry either:
--   • a user-to-user invitation code  (invitation_codes.code → user_id),  or
--   • an outlet/store referral code    (store_referral_codes.code → partner_store_id).
--
-- Instead of two sequential round trips from the client, this function answers
-- "what is this code?" in a single call and returns a discriminated result:
--   kind = 'user'  → user_id is set,           partner_store_id is null
--   kind = 'store' → partner_store_id is set,  user_id is null
--   (no row)       → the code matched neither  → the client treats it as invalid
--
-- Precedence: a user invitation code wins over a store code of the same text, so the
-- 'store' branch only fires when no ACTIVE invitation code matches. Both code columns
-- are UNIQUE, so at most one row is ever returned.
--
-- SECURITY DEFINER + locked search_path: the function only ever returns kind + the
-- resolved id (never the code list), so it is safe to expose to anon during signup,
-- and it does not depend on the underlying tables' SELECT policies.

CREATE OR REPLACE FUNCTION "public"."resolve_referral_code"("p_code" "text")
RETURNS TABLE ("kind" "text", "user_id" "uuid", "partner_store_id" "text")
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
  -- 1) User-to-user invitation code (active only).
  SELECT 'user'::text AS kind, ic.user_id, NULL::text AS partner_store_id
  FROM public.invitation_codes ic
  WHERE ic.code = btrim(p_code)
    AND ic.is_active = true

  UNION ALL

  -- 2) Outlet/store referral code — only if it is NOT an active user code.
  SELECT 'store'::text AS kind, NULL::uuid AS user_id, src.partner_store_id
  FROM public.store_referral_codes src
  WHERE src.code = btrim(p_code)
    AND NOT EXISTS (
      SELECT 1 FROM public.invitation_codes ic2
      WHERE ic2.code = btrim(p_code) AND ic2.is_active = true
    )

  LIMIT 1;
$$;

ALTER FUNCTION "public"."resolve_referral_code"("p_code" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."resolve_referral_code"("p_code" "text") IS
  'Resolves a signup referral code against both invitation_codes (kind=user) and store_referral_codes (kind=store) in one call. Returns no row if the code matches neither. User codes take precedence over store codes of the same text.';

-- Callable during signup: the client is anon at that point, and authenticated users
-- may also re-use it. Not granted to PUBLIC.
REVOKE ALL ON FUNCTION "public"."resolve_referral_code"("p_code" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."resolve_referral_code"("p_code" "text") TO "anon";
GRANT EXECUTE ON FUNCTION "public"."resolve_referral_code"("p_code" "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."resolve_referral_code"("p_code" "text") TO "service_role";
