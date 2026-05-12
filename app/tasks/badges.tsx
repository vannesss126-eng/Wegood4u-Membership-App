import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Share2, Award } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import {
  useVisitBadge,
  type VisitBadgeTier as BadgeTier,
  type VisitBadgeLevel as BadgeLevel,
} from '@/hooks/useVisitBadge';
import { BADGE_TIER_COLORS } from '@/config/badges';
import {
  getBadgeAsset,
  type CategoryAssetKey,
} from '@/lib/badgeAssets';
import { getVisitRankAsset } from '@/lib/visitRankAssets';
import { useCategoryStats, type StoreCategory } from '@/hooks/useCategoryStats';
import { categoryBadgeFor } from '@/lib/categoryBadgeTiers';

const BAR_GREEN = '#206E56';

// Categories rendered as separate scrollable rows. Filename casing matches
// the bucket convention from config/badges.ts (PascalCase).
const CATEGORIES: Array<{ key: string; label: string; assetKey: string }> = [
  { key: 'restaurant', label: 'Restaurant', assetKey: 'Restaurant' },
  { key: 'cafe',       label: 'Cafe',       assetKey: 'Cafe' },
  { key: 'bar',        label: 'Bar',        assetKey: 'Bar' },
  { key: 'hotel',      label: 'Hotel',      assetKey: 'Hotel' },
];

const TIER_ORDER: BadgeTier[] = ['bronze', 'silver', 'gold', 'platinum'];
const LEVEL_ORDER: BadgeLevel[] = [1, 2, 3];

const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// Linear order Bronze L1 → Bronze L2 → … → Platinum L3.
const TIER_LEVEL_ORDER: Array<{ tier: BadgeTier; level: BadgeLevel }> =
  TIER_ORDER.flatMap((tier) => LEVEL_ORDER.map((level) => ({ tier, level })));

function linearIndex(tier: BadgeTier | null, level: BadgeLevel | null): number {
  if (tier === null || level === null) return -1;
  return TIER_LEVEL_ORDER.findIndex((t) => t.tier === tier && t.level === level);
}

function tierAssetKey(tier: BadgeTier): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  return (tier[0].toUpperCase() + tier.slice(1)) as
    | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

export default function BadgeDetailScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const { tier, level, cyclesToNextLevel, isLoading: visitLoading } = useVisitBadge(userData?.id);
  const { counts, isLoading: statsLoading } = useCategoryStats(userData?.id);
  const isLoading = visitLoading || statsLoading;

  const visitIdx = linearIndex(tier, level);
  const visitProgressLine = cyclesToNextLevel === null
    ? 'Max tier reached — Platinum L3'
    : `${cyclesToNextLevel} cycle${cyclesToNextLevel === 1 ? '' : 's'} to next level`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Badge</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={BAR_GREEN} style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <BadgeSection
            label="Visit Badge"
            currentIdx={visitIdx}
            progressLine={visitProgressLine}
            resolveSource={(t, l) => getVisitRankAsset(tierAssetKey(t), l)}
          />
          {CATEGORIES.map((cat) => {
            const count = counts[cat.key as StoreCategory] ?? 0;
            const cb = categoryBadgeFor(count);
            const progressLine = cb.countToNextLevel === null
              ? 'Max tier reached — Platinum L3'
              : `${count} / ${cb.nextLevelMin} approved visit${count === 1 ? '' : 's'} to next level`;
            return (
              <BadgeSection
                key={cat.key}
                label={cat.label}
                currentIdx={cb.currentIdx}
                progressLine={progressLine}
                resolveSource={(t, l) =>
                  getBadgeAsset(cat.assetKey as CategoryAssetKey, tierAssetKey(t), l)
                }
                onShare={() =>
                  router.push({
                    pathname: '/tasks/badges/share/[category]' as never,
                    params: { category: cat.key } as never,
                  })
                }
              />
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

interface BadgeSectionProps {
  label: string;
  currentIdx: number;
  progressLine?: string;
  resolveSource: (tier: BadgeTier, level: BadgeLevel) => ImageSourcePropType | null;
  onShare?: () => void;
}

function BadgeSection({
  label,
  currentIdx,
  progressLine,
  resolveSource,
  onShare,
}: BadgeSectionProps) {
  const railFillPct =
    currentIdx < 0 ? 0 : ((currentIdx + 1) / TIER_LEVEL_ORDER.length) * 100;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {onShare && (
          <TouchableOpacity style={styles.shareButton} onPress={onShare}>
            <Share2 size={18} color={BAR_GREEN} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tilesRow}
      >
        {TIER_LEVEL_ORDER.map((entry, i) => {
          const earned = i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <BadgeTile
              key={`${entry.tier}-${entry.level}`}
              tier={entry.tier}
              level={entry.level}
              source={resolveSource(entry.tier, entry.level)}
              earned={earned}
              isCurrent={isCurrent}
            />
          );
        })}
      </ScrollView>

      <View style={styles.rail}>
        <View style={[styles.railFill, { width: `${railFillPct}%` }]} />
      </View>

      {progressLine && (
        <Text style={styles.progressLine}>{progressLine}</Text>
      )}
    </View>
  );
}

interface BadgeTileProps {
  tier: BadgeTier;
  level: BadgeLevel;
  source: ImageSourcePropType | null;
  earned: boolean;
  isCurrent: boolean;
}

function BadgeTile({ tier, level, source, earned, isCurrent }: BadgeTileProps) {
  const tierColors = BADGE_TIER_COLORS[tierAssetKey(tier)];

  return (
    <View style={styles.tileCol}>
      <View
        style={[
          styles.tileFrame,
          isCurrent && styles.tileFrameCurrent,
          !earned && styles.tileFrameLocked,
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={[styles.tileImage, !earned && styles.tileImageLocked]}
            resizeMode="contain"
          />
        ) : (
          <View
            style={[
              styles.tileFallback,
              { backgroundColor: earned ? tierColors.bg : '#F1F5F9' },
            ]}
          >
            <Award
              size={48}
              color={earned ? tierColors.primary : '#CBD5E1'}
            />
          </View>
        )}
      </View>
      <Text style={[styles.tileLevel, !earned && styles.tileTextLocked]}>
        Level {level}
      </Text>
      <Text style={[styles.tileTier, !earned && styles.tileTextLocked]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: {
    width: 36,
  },
  loader: {
    paddingVertical: 64,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 24,
  },

  // Per-category section
  section: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilesRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 12,
  },

  // Tiles
  tileCol: {
    width: 96,
    alignItems: 'center',
  },
  tileFrame: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFrameCurrent: {
    borderColor: BAR_GREEN,
  },
  tileFrameLocked: {
    backgroundColor: '#F1F5F9',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileImageLocked: {
    opacity: 0.3,
  },
  tileFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLevel: {
    fontSize: 13,
    fontWeight: '700',
    color: BAR_GREEN,
    marginTop: 8,
  },
  tileTier: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  tileTextLocked: {
    color: '#94A3B8',
  },

  // Progress rail under each row
  rail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  railFill: {
    height: 4,
    backgroundColor: BAR_GREEN,
  },
  progressLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
    marginHorizontal: 4,
  },
});
