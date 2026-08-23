-- Tell a user their Name is taken WHILE THEY TYPE, not after they submit.
--
-- profiles.username carries a UNIQUE constraint (profiles_username_key) and
-- handle_new_user() writes the signup "Name" straight into it. A name someone
-- already used therefore aborts the whole INSERT, and GoTrue reports the trigger
-- exception as the opaque "Database error saving new user" — which blames the
-- database for what is really "pick a different name".
--
-- Why an RPC instead of a plain SELECT from the client: signup happens while the
-- caller is still `anon`, and security_hardening_phase2a dropped the
-- "Anon can manage profiles at signup" policy. An anon SELECT on profiles now
-- returns ZERO ROWS rather than an error, so a client-side check would report
-- every name as available — worse than no check at all, because it would promise
-- success and then fail.
--
-- SECURITY DEFINER + locked search_path, same shape as resolve_referral_code: it
-- returns only a boolean, never a list of names, so it cannot be used to harvest
-- the user table. Comparison is case-insensitive and trimmed so the answer here
-- matches what the UNIQUE constraint will actually do to a padded/odd-cased name.
CREATE OR REPLACE FUNCTION "public"."username_available"("p_username" "text")
RETURNS boolean
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(btrim(p.username)) = lower(btrim(p_username))
  );
$$;

ALTER FUNCTION "public"."username_available"("p_username" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."username_available"("p_username" "text") IS
  'True when no profile already uses this username (case-insensitive, trimmed). Returns only a boolean so it cannot enumerate the user list. Used by the signup screen to warn before submit, since profiles_username_key would otherwise fail the whole signup with an opaque database error.';

-- Callable during signup: the client is anon at that point. Authenticated users
-- may also need it if a future screen lets them rename. Not granted to PUBLIC.
REVOKE ALL ON FUNCTION "public"."username_available"("p_username" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."username_available"("p_username" "text") TO "anon";
GRANT EXECUTE ON FUNCTION "public"."username_available"("p_username" "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."username_available"("p_username" "text") TO "service_role";
