// Bundled badge art lookup. Per the asset-strategy lock (2026-05-08),
// badge images ship inside the app rather than from Supabase Storage.
//
// The map is keyed by `${assetKey}_${Tier}_${level}` (matching the on-disk
// filename), so callers continue to pass PascalCase category + lowercase tier
// + numeric level, just like the previous URL builder.
//
// React Native's Metro bundler requires literal string arguments to
// `require()` — that's why every entry is enumerated.

import type { ImageSourcePropType } from 'react-native';

export type CategoryAssetKey = 'Restaurant' | 'Cafe' | 'Bar' | 'Hotel';
export type TierAssetKey = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
export type LevelAssetKey = 1 | 2 | 3;

const BADGE_ASSETS: Record<string, ImageSourcePropType> = {
  Restaurant_Bronze_1: require('@/assets/images/badges/Restaurant_Bronze_1-min.webp'),
  Restaurant_Bronze_2: require('@/assets/images/badges/Restaurant_Bronze_2-min.webp'),
  Restaurant_Bronze_3: require('@/assets/images/badges/Restaurant_Bronze_3-min.webp'),
  Restaurant_Silver_1: require('@/assets/images/badges/Restaurant_Silver_1-min.webp'),
  Restaurant_Silver_2: require('@/assets/images/badges/Restaurant_Silver_2-min.webp'),
  Restaurant_Silver_3: require('@/assets/images/badges/Restaurant_Silver_3-min.webp'),
  Restaurant_Gold_1: require('@/assets/images/badges/Restaurant_Gold_1-min.webp'),
  Restaurant_Gold_2: require('@/assets/images/badges/Restaurant_Gold_2-min.webp'),
  Restaurant_Gold_3: require('@/assets/images/badges/Restaurant_Gold_3-min.webp'),
  Restaurant_Platinum_1: require('@/assets/images/badges/Restaurant_Platinum_1-min.webp'),
  Restaurant_Platinum_2: require('@/assets/images/badges/Restaurant_Platinum_2-min.webp'),
  Restaurant_Platinum_3: require('@/assets/images/badges/Restaurant_Platinum_3-min.webp'),

  Cafe_Bronze_1: require('@/assets/images/badges/Cafe_Bronze_1-min.webp'),
  Cafe_Bronze_2: require('@/assets/images/badges/Cafe_Bronze_2-min.webp'),
  Cafe_Bronze_3: require('@/assets/images/badges/Cafe_Bronze_3-min.webp'),
  Cafe_Silver_1: require('@/assets/images/badges/Cafe_Silver_1-min.webp'),
  Cafe_Silver_2: require('@/assets/images/badges/Cafe_Silver_2-min.webp'),
  Cafe_Silver_3: require('@/assets/images/badges/Cafe_Silver_3-min.webp'),
  Cafe_Gold_1: require('@/assets/images/badges/Cafe_Gold_1-min.webp'),
  Cafe_Gold_2: require('@/assets/images/badges/Cafe_Gold_2-min.webp'),
  Cafe_Gold_3: require('@/assets/images/badges/Cafe_Gold_3-min.webp'),
  Cafe_Platinum_1: require('@/assets/images/badges/Cafe_Platinum_1-min.webp'),
  Cafe_Platinum_2: require('@/assets/images/badges/Cafe_Platinum_2-min.webp'),
  Cafe_Platinum_3: require('@/assets/images/badges/Cafe_Platinum_3-min.webp'),

  Bar_Bronze_1: require('@/assets/images/badges/Bar_Bronze_1-min.webp'),
  Bar_Bronze_2: require('@/assets/images/badges/Bar_Bronze_2-min.webp'),
  Bar_Bronze_3: require('@/assets/images/badges/Bar_Bronze_3-min.webp'),
  Bar_Silver_1: require('@/assets/images/badges/Bar_Silver_1-min.webp'),
  Bar_Silver_2: require('@/assets/images/badges/Bar_Silver_2-min.webp'),
  Bar_Silver_3: require('@/assets/images/badges/Bar_Silver_3-min.webp'),
  Bar_Gold_1: require('@/assets/images/badges/Bar_Gold_1-min.webp'),
  Bar_Gold_2: require('@/assets/images/badges/Bar_Gold_2-min.webp'),
  Bar_Gold_3: require('@/assets/images/badges/Bar_Gold_3-min.webp'),
  Bar_Platinum_1: require('@/assets/images/badges/Bar_Platinum_1-min.webp'),
  Bar_Platinum_2: require('@/assets/images/badges/Bar_Platinum_2-min.webp'),
  Bar_Platinum_3: require('@/assets/images/badges/Bar_Platinum_3-min.webp'),

  Hotel_Bronze_1: require('@/assets/images/badges/Hotel_Bronze_1-min.webp'),
  Hotel_Bronze_2: require('@/assets/images/badges/Hotel_Bronze_2-min.webp'),
  Hotel_Bronze_3: require('@/assets/images/badges/Hotel_Bronze_3-min.webp'),
  Hotel_Silver_1: require('@/assets/images/badges/Hotel_Silver_1-min.webp'),
  Hotel_Silver_2: require('@/assets/images/badges/Hotel_Silver_2-min.webp'),
  Hotel_Silver_3: require('@/assets/images/badges/Hotel_Silver_3-min.webp'),
  Hotel_Gold_1: require('@/assets/images/badges/Hotel_Gold_1-min.webp'),
  Hotel_Gold_2: require('@/assets/images/badges/Hotel_Gold_2-min.webp'),
  Hotel_Gold_3: require('@/assets/images/badges/Hotel_Gold_3-min.webp'),
  Hotel_Platinum_1: require('@/assets/images/badges/Hotel_Platinum_1-min.webp'),
  Hotel_Platinum_2: require('@/assets/images/badges/Hotel_Platinum_2-min.webp'),
  Hotel_Platinum_3: require('@/assets/images/badges/Hotel_Platinum_3-min.webp'),
};

export function getBadgeAsset(
  assetKey: CategoryAssetKey,
  tier: TierAssetKey,
  level: LevelAssetKey,
): ImageSourcePropType | null {
  return BADGE_ASSETS[`${assetKey}_${tier}_${level}`] ?? null;
}
