// Bundled voucher art (4 tier files received 2026-05-08).
// File names: bronze_voucher.webp / silver_voucher.webp / gold_voucher.webp / plat_voucher.webp
// (Note: "plat" not "platinum" — file naming convention.)

import type { ImageSourcePropType } from 'react-native';
import type { CategoryTier } from './categoryBadgeTiers';

const VOUCHER_ASSETS: Record<CategoryTier, ImageSourcePropType> = {
  bronze:   require('@/assets/images/voucher/bronze_voucher.webp'),
  silver:   require('@/assets/images/voucher/silver_voucher.webp'),
  gold:     require('@/assets/images/voucher/gold_voucher.webp'),
  platinum: require('@/assets/images/voucher/plat_voucher.webp'),
};

export function getVoucherAsset(tier: CategoryTier): ImageSourcePropType {
  return VOUCHER_ASSETS[tier];
}

// Bundled tier-frame assets for the profile picture.
// Filenames: Bronze.webp / Silver.webp / Goldd.webp (typo) / Diamond.webp.
// Diamond → Platinum tier per asset-strategy lock.
const TIER_FRAME_ASSETS: Record<CategoryTier, ImageSourcePropType> = {
  bronze:   require('@/assets/images/tier_frame/Bronze.webp'),
  silver:   require('@/assets/images/tier_frame/Silver.webp'),
  gold:     require('@/assets/images/tier_frame/Goldd.webp'),
  platinum: require('@/assets/images/tier_frame/Diamond.webp'),
};

export function getTierFrameAsset(tier: CategoryTier): ImageSourcePropType {
  return TIER_FRAME_ASSETS[tier];
}
