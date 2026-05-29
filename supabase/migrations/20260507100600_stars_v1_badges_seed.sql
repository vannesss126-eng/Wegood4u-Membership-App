-- Stars + Visit 10 v1 — Seed badges
--
-- Seeds 60 new rows in public.badges:
--   12 Visit Badge rows  (4 tiers × 3 levels)
--   48 Category Badge rows  (4 categories × 4 tiers × 3 levels)
--
-- Visit Badge thresholds (cumulative completed Visit 10 cycles):
--   Bronze L1=1, L2=2, L3=3 (range 3-4 → required_count=3, badge unlocks at 3)
--   Silver L1=5, L2=7, L3=10
--   Gold   L1=15, L2=20, L3=27
--   Platinum L1=35, L2=40, L3=45
--
-- Category Badge thresholds (cumulative real approved submissions in that category):
--   Bronze L1=5, L2=10, L3=20
--   Silver L1=30, L2=40, L3=50
--   Gold   L1=60, L2=70, L3=80
--   Platinum L1=90, L2=100, L3=120
--
-- Same threshold table for all four categories: cafe / bar / restaurant / hotel.
-- (Experience deferred for v1.)
--
-- Legacy 'category' column requires a value (NOT NULL). For Visit Badge rows we
-- use 'activity' (the legacy global-tier marker). For category badges we use
-- the matching enum value.

BEGIN;

-- ============================================================
-- Visit Badge — 12 rows
-- ============================================================

INSERT INTO "public"."badges" (
  "name", "category", "badge_kind", "tier", "level", "required_count",
  "is_active", "selfie_url", "receipt_url"
) VALUES
  ('Visit Bronze L1',   'activity', 'visit', 'bronze',   1,   1, true, '', ''),
  ('Visit Bronze L2',   'activity', 'visit', 'bronze',   2,   2, true, '', ''),
  ('Visit Bronze L3',   'activity', 'visit', 'bronze',   3,   3, true, '', ''),
  ('Visit Silver L1',   'activity', 'visit', 'silver',   1,   5, true, '', ''),
  ('Visit Silver L2',   'activity', 'visit', 'silver',   2,   7, true, '', ''),
  ('Visit Silver L3',   'activity', 'visit', 'silver',   3,  10, true, '', ''),
  ('Visit Gold L1',     'activity', 'visit', 'gold',     1,  15, true, '', ''),
  ('Visit Gold L2',     'activity', 'visit', 'gold',     2,  20, true, '', ''),
  ('Visit Gold L3',     'activity', 'visit', 'gold',     3,  27, true, '', ''),
  ('Visit Platinum L1', 'activity', 'visit', 'platinum', 1,  35, true, '', ''),
  ('Visit Platinum L2', 'activity', 'visit', 'platinum', 2,  40, true, '', ''),
  ('Visit Platinum L3', 'activity', 'visit', 'platinum', 3,  45, true, '', '');

-- ============================================================
-- Category Badges — 48 rows
-- ============================================================
-- Generated programmatically: cross-join 4 categories × the 12-row tier-level template.

INSERT INTO "public"."badges" (
  "name", "category", "badge_kind", "tier", "level", "required_count",
  "is_active", "selfie_url", "receipt_url"
)
SELECT
  -- "Cafe Bronze L1" / "Bar Silver L3" etc.
  initcap(c.cat) || ' ' || initcap(t.tier) || ' L' || t.level::text AS name,
  c.cat::badge_category AS category,
  c.cat AS badge_kind,
  t.tier,
  t.level,
  t.required_count,
  true,
  '',
  ''
FROM (VALUES
  ('cafe'),
  ('bar'),
  ('restaurant'),
  ('hotel')
) AS c(cat)
CROSS JOIN (VALUES
  ('bronze',   1,   5),
  ('bronze',   2,  10),
  ('bronze',   3,  20),
  ('silver',   1,  30),
  ('silver',   2,  40),
  ('silver',   3,  50),
  ('gold',     1,  60),
  ('gold',     2,  70),
  ('gold',     3,  80),
  ('platinum', 1,  90),
  ('platinum', 2, 100),
  ('platinum', 3, 120)
) AS t(tier, level, required_count);


-- ============================================================
-- Sanity check
-- ============================================================
-- Verify counts. RAISE EXCEPTION if seeding produced wrong totals.

DO $$
DECLARE
  v_visit_count int;
  v_category_count int;
BEGIN
  SELECT count(*) INTO v_visit_count
  FROM public.badges
  WHERE is_active = true AND badge_kind = 'visit';

  IF v_visit_count != 12 THEN
    RAISE EXCEPTION 'Expected 12 Visit Badge rows, got %', v_visit_count;
  END IF;

  SELECT count(*) INTO v_category_count
  FROM public.badges
  WHERE is_active = true AND badge_kind IN ('cafe', 'bar', 'restaurant', 'hotel');

  IF v_category_count != 48 THEN
    RAISE EXCEPTION 'Expected 48 Category Badge rows, got %', v_category_count;
  END IF;
END $$;

COMMIT;
