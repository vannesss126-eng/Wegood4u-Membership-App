// Visual styling shared by Visit-Badge and Category-Badge surfaces.
//
// The legacy per-category threshold model (BADGE_REQUIREMENTS, getCurrentBadge,
// getAllBadgesForCategory, getBadgeImageUrl, MAX_BADGE_REQUIREMENT) was
// retired in Phase 8 cleanup once the Visit Badge cycle model + bundled assets
// shipped. Tier+level lookups now live in:
//   • hooks/useVisitBadge.ts       — Visit Badge tier table
//   • lib/categoryBadgeTiers.ts    — Category Badge tier table
//   • lib/badgeAssets.ts           — Category Badge art map
//   • lib/visitRankAssets.ts       — Visit Badge art map

export const BADGE_TIER_COLORS: Record<
  'Bronze' | 'Silver' | 'Gold' | 'Platinum',
  { primary: string; bg: string; text: string }
> = {
  Bronze:   { primary: '#CD7F32', bg: '#FDF4E7', text: '#8B5A2B' },
  Silver:   { primary: '#C0C0C0', bg: '#F5F5F5', text: '#71717A' },
  Gold:     { primary: '#FFD700', bg: '#FFFBEB', text: '#B8860B' },
  Platinum: { primary: '#E5E4E2', bg: '#F0F0F0', text: '#4A4A4A' },
};
