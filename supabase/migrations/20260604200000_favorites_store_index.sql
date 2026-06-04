-- Index favorites by partner_store_id for fast per-store counts.
--
-- The PK is (user_id, partner_store_id), so "how many users favorited store X"
-- can't use it efficiently (user_id is the leading column). The vendor
-- analytics dashboard will want that count, so we add a dedicated index now.
-- This keeps counts computed on-demand (always accurate, zero drift) instead of
-- a denormalized favorited_count column — the right trade-off at this scale.

CREATE INDEX IF NOT EXISTS "user_favorite_stores_store_idx"
  ON "public"."user_favorite_stores" USING "btree" ("partner_store_id");
