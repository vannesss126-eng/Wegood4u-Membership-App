-- Wire up the member "favorite partner store" feature end to end.
--
-- The user_favorite_stores table already existed (PK, profiles FK, index, RLS,
-- realtime) but was built for the old Firestore world: partner_store_id was a
-- loose text id with no FK, and there were no RPCs, so the app's favorite
-- button had no backend to call. Now that partner_stores lives in Supabase
-- with the same text id, we can:
--   1. Foreign-key favorites to partner_stores (referential integrity + enables
--      nested selects / joins for "My Favorites" with store details).
--   2. Add toggle_favorite() — add/remove in one authenticated call.
--   3. Add get_user_favorites() — favorites joined to store details for the UI.
--   4. Default user_id to auth.uid() so plain client inserts don't pass the id.
--
-- Note: favorites require an authenticated user. Guests get "Not authenticated";
-- the client should catch that and prompt sign-in.


-- 1. Foreign key to partner_stores (table is empty, so no orphan backfill needed).
ALTER TABLE "public"."user_favorite_stores"
  ADD CONSTRAINT "user_favorite_stores_partner_store_id_fkey"
  FOREIGN KEY ("partner_store_id")
  REFERENCES "public"."partner_stores"("id")
  ON DELETE CASCADE;

COMMENT ON TABLE "public"."user_favorite_stores" IS
  'Per-user favorited partner stores. partner_store_id references partner_stores(id) (cascade on store delete).';


-- 4. Default user_id to the caller, so RLS-checked client inserts can omit it.
ALTER TABLE "public"."user_favorite_stores"
  ALTER COLUMN "user_id" SET DEFAULT "auth"."uid"();


-- 2. toggle_favorite — flips favorite state for the calling user, returns the
--    new state (true = now favorited, false = removed). The FK guarantees the
--    store exists; a bad id raises foreign_key_violation.
CREATE OR REPLACE FUNCTION "public"."toggle_favorite"("p_partner_store_id" "text")
  RETURNS boolean
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
DECLARE
  v_user_id uuid;
  v_deleted int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Already favorited? Remove it.
  DELETE FROM public.user_favorite_stores
  WHERE user_id = v_user_id AND partner_store_id = p_partner_store_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN false;  -- was favorited, now removed
  END IF;

  -- Not favorited yet — add it. ON CONFLICT guards against double-tap races.
  INSERT INTO public.user_favorite_stores (user_id, partner_store_id)
  VALUES (v_user_id, p_partner_store_id)
  ON CONFLICT (user_id, partner_store_id) DO NOTHING;

  RETURN true;  -- now favorited
END;
$$;

ALTER FUNCTION "public"."toggle_favorite"("p_partner_store_id" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."toggle_favorite"("p_partner_store_id" "text") IS
  'Toggles the calling user''s favorite for a partner store. Returns true if now favorited, false if removed. Raises if unauthenticated.';


-- 3. get_user_favorites — the calling user's favorites joined to store details,
--    newest first. Hides stores that have gone inactive. Uses the
--    (user_id, created_at DESC) index on user_favorite_stores.
CREATE OR REPLACE FUNCTION "public"."get_user_favorites"()
  RETURNS TABLE(
    "id" "text",
    "name" "text",
    "type" "text",
    "city" "text",
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "rating" numeric,
    "image" "text",
    "price_range" "text",
    "favorited_at" timestamp with time zone
  )
  LANGUAGE "plpgsql" STABLE SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.name,
    ps.type,
    ps.city,
    ps.address,
    ps.latitude,
    ps.longitude,
    ps.rating,
    ps.image,
    ps.price_range,
    f.created_at
  FROM public.user_favorite_stores f
  JOIN public.partner_stores ps ON ps.id = f.partner_store_id
  WHERE f.user_id = v_user_id
    AND ps.active = true
  ORDER BY f.created_at DESC;
END;
$$;

ALTER FUNCTION "public"."get_user_favorites"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_user_favorites"() IS
  'Returns the calling user''s favorited partner stores joined to store details, newest first. Excludes inactive stores. Raises if unauthenticated.';


-- Grants — match the table's authenticated/service_role access.
GRANT ALL ON FUNCTION "public"."toggle_favorite"("p_partner_store_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_favorite"("p_partner_store_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_favorites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_favorites"() TO "service_role";
