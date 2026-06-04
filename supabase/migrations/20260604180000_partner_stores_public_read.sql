-- Allow guests (anon role) to read partner stores.
-- The home/discovery screen renders for signed-out users ("Start Exploring!"),
-- but the original SELECT policy was scoped TO authenticated only, so RLS
-- returned zero rows for the anon role (recommendations appeared empty on
-- signed-out clients while working for signed-in users).
-- Partner listings (name, rating, city, etc.) are public discovery data.

DROP POLICY IF EXISTS "all users read partner stores" ON "public"."partner_stores";

CREATE POLICY "public read partner stores"
  ON "public"."partner_stores"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);
