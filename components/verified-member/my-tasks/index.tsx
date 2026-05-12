import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Award } from 'lucide-react-native';
import { useVisitProgress } from '@/hooks/useVisitProgress';
import { useStarWallet } from '@/hooks/useStarWallet';
import {
  useVisitBadge,
  tierLevelFor,
  type VisitBadgeTier,
} from '@/hooks/useVisitBadge';
import { useActivity } from '@/hooks/useActivity';
import { describeActivityEvent } from '@/lib/activityEvent';
import { BADGE_TIER_COLORS } from '@/config/badges';
import VisitProgressCard from './VisitProgressCard';
import DailyCheckinTile from '@/components/verified-member/rewards/DailyCheckinTile';

const BAR_GREEN = '#206E56';
const BAR_GOLD = '#E5A93D';

const TIER_LABEL: Record<VisitBadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

interface MyTasksProps {
  userData: any;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function tierStyleFor(tier: VisitBadgeTier) {
  const key = (tier[0].toUpperCase() + tier.slice(1)) as keyof typeof BADGE_TIER_COLORS;
  return BADGE_TIER_COLORS[key];
}

export default function MyTasks({ userData }: MyTasksProps) {
  const router = useRouter();
  const userId = userData?.id as string | undefined;

  const {
    realVisits,
    extrasApplied,
    total,
    isClaimable,
    trade,
    claim,
    isLoading: progressLoading,
  } = useVisitProgress(userId);
  const { balance, isLoading: walletLoading } = useStarWallet(userId);
  const {
    tier,
    level,
    completedCycles,
    cyclesToNextLevel,
    isLoading: badgeLoading,
  } = useVisitBadge(userId);
  const { events, isLoading: activityLoading } = useActivity({ pageSize: 5 });

  // Projected tier for the in-flight cycle. complete_visit_task() snapshots
  // tier from completedCycles + 1, so the UI label should reflect that.
  const projectedTier =
    tierLevelFor(completedCycles + 1)?.tier ?? tier ?? 'bronze';

  const initialLoading = progressLoading && walletLoading && total === 0;

  return (
    <View style={styles.root}>
      {/* ------------------------------------------------------------------ */}
      {/* Section 0: Daily log-in streak tile                                */}
      {/* ------------------------------------------------------------------ */}
      <DailyCheckinTile />

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Visit 10 progress card                                  */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        {initialLoading ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.sectionLoader} />
        ) : (
          <VisitProgressCard
            realVisits={realVisits}
            extrasApplied={extrasApplied}
            total={total}
            isClaimable={isClaimable}
            walletBalance={balance}
            projectedTier={projectedTier}
            onTrade={trade}
            onClaim={claim}
          />
        )}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: My Badge                                                */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Badge</Text>
          <TouchableOpacity
            style={styles.headerArrowButton}
            onPress={() => router.push('/tasks/badges' as never)}
          >
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {badgeLoading && completedCycles === 0 ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.sectionLoader} />
        ) : tier === null ? (
          <View style={styles.badgeEmptyCard}>
            <Award size={56} color="#CBD5E1" />
            <Text style={styles.badgeEmptyText}>
              Complete your first Visit 10 cycle to earn a Visit Badge.
            </Text>
          </View>
        ) : (
          <View style={styles.badgeCard}>
            <View style={[styles.badgeArt, { backgroundColor: tierStyleFor(tier).bg }]}>
              <Award size={56} color={tierStyleFor(tier).primary} />
            </View>
            <Text style={[styles.badgeTier, { color: BAR_GREEN }]}>
              {TIER_LABEL[tier]}
            </Text>
            {level !== null && <Text style={styles.badgeLevel}>Level {level}</Text>}
            {cyclesToNextLevel === null ? (
              <Text style={styles.badgeSubcopy}>You&apos;ve reached the top tier!</Text>
            ) : (
              <Text style={styles.badgeSubcopy}>
                Complete {cyclesToNextLevel} more cycle
                {cyclesToNextLevel === 1 ? '' : 's'} to reach the next level
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: History snippet                                         */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          <TouchableOpacity
            style={styles.headerArrowButton}
            onPress={() => router.push('/tasks/history' as never)}
          >
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {activityLoading && events.length === 0 ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.sectionLoader} />
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet.</Text>
        ) : (
          <View style={styles.historyList}>
            {events.map((e, i) => {
              const row = describeActivityEvent(e);
              return (
                <View key={`${e.event_type}-${e.event_at}-${i}`} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{formatDate(e.event_at)}</Text>
                  <Text style={styles.historyTarget} numberOfLines={1}>
                    {row.target}
                  </Text>
                  <View style={styles.historyTrailingCol}>
                    {row.status && (
                      <Text
                        style={[
                          styles.historyStatus,
                          row.status.tone === 'approved' && { color: BAR_GREEN },
                          row.status.tone === 'rejected' && { color: '#EF4444' },
                          row.status.tone === 'neutral' && { color: '#64748B' },
                        ]}
                      >
                        {row.status.text}
                      </Text>
                    )}
                    {row.trailing && (
                      <Text
                        style={[
                          styles.historyTrailing,
                          row.trailing.tone === 'star' && { color: '#9C6F1A' },
                          row.trailing.tone === 'progress' && { color: '#915A11' },
                          row.trailing.tone === 'voucher' && { color: BAR_GREEN },
                          row.trailing.tone === 'visit' && { color: BAR_GREEN },
                        ]}
                      >
                        {row.trailing.text}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionLoader: {
    paddingVertical: 24,
  },
  headerArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BAR_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // My Badge
  badgeEmptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  badgeEmptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  badgeCard: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  badgeArt: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeTier: {
    fontSize: 22,
    fontWeight: '800',
  },
  badgeLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: BAR_GREEN,
    marginTop: -4,
  },
  badgeSubcopy: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // History snippet
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  historyDate: {
    width: 64,
    fontSize: 13,
    color: '#475569',
  },
  historyTarget: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  historyTrailingCol: {
    alignItems: 'flex-end',
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyTrailing: {
    fontSize: 11,
    color: BAR_GOLD,
    fontWeight: '700',
    marginTop: 2,
  },
});

