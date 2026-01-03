// Badge System Configuration
// Defines badge tiers, requirements, and Supabase storage URLs

// Supabase storage base URL for badges bucket
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const BADGES_BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/badges`;

// Badge tiers in order of progression
export const BADGE_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
export type BadgeTier = typeof BADGE_TIERS[number];

// Badge ranks within each tier
export const BADGE_RANKS = [1, 2, 3] as const;
export type BadgeRank = typeof BADGE_RANKS[number];

// Badge categories
export const BADGE_CATEGORIES = ['Bar', 'Cafe', 'Restaurant', 'Hotel'] as const;
export type BadgeCategoryType = typeof BADGE_CATEGORIES[number];

// Badge requirement thresholds
export const BADGE_REQUIREMENTS: Record<string, number> = {
  'Bronze_1': 5,
  'Bronze_2': 10,
  'Bronze_3': 20,
  'Silver_1': 30,
  'Silver_2': 40,
  'Silver_3': 50,
  'Gold_1': 60,
  'Gold_2': 70,
  'Gold_3': 80,
  'Platinum_1': 90,
  'Platinum_2': 100,
  'Platinum_3': 120,
};

// Get all badge keys in order of progression
export const BADGE_PROGRESSION = Object.keys(BADGE_REQUIREMENTS);

// Badge display colors per tier
export const BADGE_TIER_COLORS: Record<BadgeTier, { primary: string; bg: string; text: string }> = {
  Bronze: { primary: '#CD7F32', bg: '#FDF4E7', text: '#8B5A2B' },
  Silver: { primary: '#C0C0C0', bg: '#F5F5F5', text: '#71717A' },
  Gold: { primary: '#FFD700', bg: '#FFFBEB', text: '#B8860B' },
  Platinum: { primary: '#E5E4E2', bg: '#F0F0F0', text: '#4A4A4A' },
};

// Category display info
export const BADGE_CATEGORY_INFO: Record<BadgeCategoryType, { displayName: string; color: string; bgColor: string }> = {
  Bar: { displayName: 'Bar Explorer', color: '#8B5CF6', bgColor: '#F3E8FF' },
  Cafe: { displayName: 'Coffee Lover', color: '#F59E0B', bgColor: '#FEF3C7' },
  Restaurant: { displayName: 'Foodie', color: '#EF4444', bgColor: '#FEE2E2' },
  Hotel: { displayName: 'Hotel Explorer', color: '#3B82F6', bgColor: '#EFF6FF' },
};

/**
 * Get the badge image URL from Supabase storage
 * @param category - Badge category (Bar, Cafe, Restaurant)
 * @param tier - Badge tier (Bronze, Silver, Gold, Platinum)
 * @param rank - Badge rank (1, 2, 3)
 * @returns The full URL to the badge image
 */
export function getBadgeImageUrl(category: BadgeCategoryType, tier: BadgeTier, rank: BadgeRank): string {
  const filename = `${category}_${tier}_${rank}-min.webp`;
  return `${BADGES_BUCKET_URL}/${filename}`;
}

/**
 * Get badge key from tier and rank
 * @param tier - Badge tier
 * @param rank - Badge rank
 * @returns Badge key like "Bronze_1"
 */
export function getBadgeKey(tier: BadgeTier, rank: BadgeRank): string {
  return `${tier}_${rank}`;
}

/**
 * Get the requirement for a specific badge
 * @param tier - Badge tier
 * @param rank - Badge rank
 * @returns Number of approved submissions required
 */
export function getBadgeRequirement(tier: BadgeTier, rank: BadgeRank): number {
  const key = getBadgeKey(tier, rank);
  return BADGE_REQUIREMENTS[key] || 0;
}

/**
 * Get the current badge earned based on approved count
 * @param approvedCount - Number of approved submissions for a category
 * @returns Object with tier, rank, and next badge info, or null if no badge earned
 */
export function getCurrentBadge(approvedCount: number): {
  tier: BadgeTier;
  rank: BadgeRank;
  nextTier?: BadgeTier;
  nextRank?: BadgeRank;
  nextRequirement?: number;
  progress: number;
} | null {
  let currentBadge: { tier: BadgeTier; rank: BadgeRank } | null = null;
  let nextBadgeKey: string | null = null;

  // Find the highest badge earned
  for (const tier of BADGE_TIERS) {
    for (const rank of BADGE_RANKS) {
      const requirement = getBadgeRequirement(tier, rank);
      if (approvedCount >= requirement) {
        currentBadge = { tier, rank };
      } else {
        // This is the next badge to earn
        if (!nextBadgeKey) {
          nextBadgeKey = getBadgeKey(tier, rank);
        }
        break;
      }
    }
  }

  if (!currentBadge) {
    // No badge earned yet, show progress to first badge
    const firstRequirement = BADGE_REQUIREMENTS['Bronze_1'];
    return {
      tier: 'Bronze' as BadgeTier,
      rank: 1 as BadgeRank,
      nextTier: 'Bronze',
      nextRank: 1,
      nextRequirement: firstRequirement,
      progress: (approvedCount / firstRequirement) * 100,
    };
  }

  // Find next badge info
  const currentIndex = BADGE_PROGRESSION.indexOf(getBadgeKey(currentBadge.tier, currentBadge.rank));
  const nextIndex = currentIndex + 1;

  if (nextIndex < BADGE_PROGRESSION.length) {
    const nextKey = BADGE_PROGRESSION[nextIndex];
    const [nextTierStr, nextRankStr] = nextKey.split('_');
    const nextRequirement = BADGE_REQUIREMENTS[nextKey];
    const currentRequirement = getBadgeRequirement(currentBadge.tier, currentBadge.rank);
    const progressRange = nextRequirement - currentRequirement;
    const progressMade = approvedCount - currentRequirement;

    return {
      ...currentBadge,
      nextTier: nextTierStr as BadgeTier,
      nextRank: parseInt(nextRankStr) as BadgeRank,
      nextRequirement,
      progress: Math.min((progressMade / progressRange) * 100, 100),
    };
  }

  // Max badge achieved
  return {
    ...currentBadge,
    progress: 100,
  };
}

/**
 * Get all badges for a category with their unlock status
 * @param category - Badge category
 * @param approvedCount - Number of approved submissions
 * @returns Array of all badges with unlock status
 */
export function getAllBadgesForCategory(category: BadgeCategoryType, approvedCount: number): Array<{
  tier: BadgeTier;
  rank: BadgeRank;
  requirement: number;
  imageUrl: string;
  unlocked: boolean;
  current: boolean;
}> {
  const badges: Array<{
    tier: BadgeTier;
    rank: BadgeRank;
    requirement: number;
    imageUrl: string;
    unlocked: boolean;
    current: boolean;
  }> = [];

  const currentBadge = getCurrentBadge(approvedCount);
  
  for (const tier of BADGE_TIERS) {
    for (const rank of BADGE_RANKS) {
      const requirement = getBadgeRequirement(tier, rank);
      const unlocked = approvedCount >= requirement;
      const isCurrent = currentBadge && 
        currentBadge.tier === tier && 
        currentBadge.rank === rank &&
        approvedCount >= requirement;
      
      badges.push({
        tier,
        rank,
        requirement,
        imageUrl: getBadgeImageUrl(category, tier, rank),
        unlocked,
        current: isCurrent || false,
      });
    }
  }

  return badges;
}

/**
 * Get the maximum requirement (for progress display)
 */
export const MAX_BADGE_REQUIREMENT = 120;
