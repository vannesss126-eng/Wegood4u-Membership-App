-- Stars + Visit 10 v1 — Badges table evolution
--
-- Hides legacy seed rows (First Visit, Coffee Lover, etc.) and adds the columns
-- needed by the new badge model: badge_kind, tier, level.
--
-- Legacy rows stay in the table (still referenced by existing user_badges rows)
-- but is_active = false so the new logic ignores them. The legacy 'category'
-- column stays for now; deletion deferred to Phase 8 cleanup.
--
-- Seed rows for the new model are inserted in stars_v1_badges_seed.sql.

BEGIN;

-- 1. Hide all existing rows. Anything we INSERT below sets is_active=true explicitly.
UPDATE "public"."badges" SET "is_active" = false;

-- 2. Add new columns. Nullable for now since legacy rows don't have values; the
--    seed migration sets them on new rows. Future cleanup in Phase 8 may
--    NOT NULL them after legacy rows are deleted.
ALTER TABLE "public"."badges"
  ADD COLUMN IF NOT EXISTS "badge_kind" "text",
  ADD COLUMN IF NOT EXISTS "tier" "text",
  ADD COLUMN IF NOT EXISTS "level" integer;

-- 3. CHECK constraints. Use IF NOT EXISTS via DO block since ALTER TABLE doesn't
--    support IF NOT EXISTS on constraints in all Postgres versions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'badges_badge_kind_check'
  ) THEN
    ALTER TABLE "public"."badges"
      ADD CONSTRAINT "badges_badge_kind_check"
      CHECK ("badge_kind" IS NULL OR "badge_kind" = ANY (ARRAY[
        'visit'::"text",
        'cafe'::"text",
        'bar'::"text",
        'restaurant'::"text",
        'hotel'::"text"
      ]));
    -- 'experience' added when the category lands in v2+
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'badges_tier_check'
  ) THEN
    ALTER TABLE "public"."badges"
      ADD CONSTRAINT "badges_tier_check"
      CHECK ("tier" IS NULL OR "tier" = ANY (ARRAY[
        'bronze'::"text",
        'silver'::"text",
        'gold'::"text",
        'platinum'::"text"
      ]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'badges_level_range'
  ) THEN
    ALTER TABLE "public"."badges"
      ADD CONSTRAINT "badges_level_range"
      CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 3);
  END IF;
END $$;

-- 4. Index for the trigger lookups (on submission approval, find Category Badge
--    rows where badge_kind = '<category>' to evaluate threshold crossings).
CREATE INDEX IF NOT EXISTS "badges_active_kind_required_idx"
  ON "public"."badges" ("badge_kind", "required_count")
  WHERE "is_active" = true AND "badge_kind" IS NOT NULL;

COMMENT ON COLUMN "public"."badges"."badge_kind" IS 'visit | cafe | bar | restaurant | hotel. NULL for legacy rows. Drives which trigger evaluates threshold crossings.';
COMMENT ON COLUMN "public"."badges"."tier" IS 'bronze | silver | gold | platinum. NULL for legacy rows.';
COMMENT ON COLUMN "public"."badges"."level" IS 'Sub-level within a tier: 1 | 2 | 3. NULL for legacy rows.';

COMMIT;
