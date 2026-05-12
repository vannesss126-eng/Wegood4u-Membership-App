// Bundled Visit Badge art (single 12-piece progression: Bronze L1 → Platinum L3).
// Mapping per stars-and-extra-progress.plan.md asset section: each tier folder
// has 4 source files; the numeric ones map to L1/L2/L3 and the 4th (master)
// is omitted from the level grid.
//
// Folder names contain spaces — that's fine for require().

import type { ImageSourcePropType } from 'react-native';
import type { TierAssetKey, LevelAssetKey } from './badgeAssets';

const VISIT_RANK_ASSETS: Record<string, ImageSourcePropType> = {
  Bronze_1: require('@/assets/images/badges/visit rank/Pre-visit Bronze/B1.webp'),
  Bronze_2: require('@/assets/images/badges/visit rank/Pre-visit Bronze/B2.webp'),
  Bronze_3: require('@/assets/images/badges/visit rank/Pre-visit Bronze/B3.webp'),

  Silver_1: require('@/assets/images/badges/visit rank/Pre-Visit Silver/31.webp'),
  Silver_2: require('@/assets/images/badges/visit rank/Pre-Visit Silver/32.webp'),
  Silver_3: require('@/assets/images/badges/visit rank/Pre-Visit Silver/33.webp'),

  Gold_1: require('@/assets/images/badges/visit rank/Pre-Visit Gold/38.webp'),
  Gold_2: require('@/assets/images/badges/visit rank/Pre-Visit Gold/39.webp'),
  Gold_3: require('@/assets/images/badges/visit rank/Pre-Visit Gold/40.webp'),

  // "Diamond" folder ships the Platinum tier — accessory naming only.
  Platinum_1: require('@/assets/images/badges/visit rank/Pre-visit Diamond/48.webp'),
  Platinum_2: require('@/assets/images/badges/visit rank/Pre-visit Diamond/49.webp'),
  Platinum_3: require('@/assets/images/badges/visit rank/Pre-visit Diamond/50.webp'),
};

export function getVisitRankAsset(
  tier: TierAssetKey,
  level: LevelAssetKey,
): ImageSourcePropType | null {
  return VISIT_RANK_ASSETS[`${tier}_${level}`] ?? null;
}
