// Category Badge tier+level lookup. Mirrors the seeded thresholds in
// supabase/migrations/20260507100600_stars_v1_badges_seed.sql.

import type { TierAssetKey, LevelAssetKey } from './badgeAssets';

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
type Level = 1 | 2 | 3;

const TIER_TABLE: Array<{ min: number; tier: Tier; level: Level }> = [
  { min: 5,   tier: 'bronze',   level: 1 },
  { min: 10,  tier: 'bronze',   level: 2 },
  { min: 20,  tier: 'bronze',   level: 3 },
  { min: 30,  tier: 'silver',   level: 1 },
  { min: 40,  tier: 'silver',   level: 2 },
  { min: 50,  tier: 'silver',   level: 3 },
  { min: 60,  tier: 'gold',     level: 1 },
  { min: 70,  tier: 'gold',     level: 2 },
  { min: 80,  tier: 'gold',     level: 3 },
  { min: 90,  tier: 'platinum', level: 1 },
  { min: 100, tier: 'platinum', level: 2 },
  { min: 120, tier: 'platinum', level: 3 },
];

export interface CategoryBadgeProgress {
  tier: Tier | null;
  level: Level | null;
  /** Index 0..11 in the linear tier-level order; -1 when not yet reached L1. */
  currentIdx: number;
  /** Approved-submission count needed to reach the next level. null at max. */
  countToNextLevel: number | null;
  /** Count threshold of the next level — for "X of Y" display. null at max. */
  nextLevelMin: number | null;
}

export function categoryBadgeFor(count: number): CategoryBadgeProgress {
  let tier: Tier | null = null;
  let level: Level | null = null;
  let currentIdx = -1;
  let nextLevelMin: number | null = null;
  let countToNextLevel: number | null = null;

  for (let i = 0; i < TIER_TABLE.length; i += 1) {
    const row = TIER_TABLE[i];
    if (count >= row.min) {
      tier = row.tier;
      level = row.level;
      currentIdx = i;
    } else if (nextLevelMin === null) {
      nextLevelMin = row.min;
      countToNextLevel = row.min - count;
    }
  }

  return { tier, level, currentIdx, countToNextLevel, nextLevelMin };
}

export type { Tier as CategoryTier, Level as CategoryLevel };
export type { TierAssetKey, LevelAssetKey };
