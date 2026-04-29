import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Award } from 'lucide-react-native';
import { useTasks, type BadgeTier } from '@/hooks/useTasks';
import { useActivity, type ActivityEvent } from '@/hooks/useActivity';
import { BADGE_TIER_COLORS } from '@/config/badges';

const CATEGORY_KEYS = ['restaurant', 'cafe', 'bar', 'hotel'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  bar: 'Bar',
  hotel: 'Hotel',
};

const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// Cumulative-task threshold for the next tier; null = max tier reached.
const NEXT_TIER_THRESHOLD: Record<BadgeTier, number | null> = {
  bronze: 5,
  silver: 15,
  gold: 35,
  platinum: null,
};

const PROGRESS_TICKS = [0, 2, 4, 6, 8, 10] as const;
const BAR_GREEN = '#206E56';
const BAR_GOLD = '#D4A017';

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

function tierStyleFor(tier: BadgeTier) {
  // BADGE_TIER_COLORS keys are PascalCase (Bronze/Silver/Gold/Platinum).
  const key = (tier[0].toUpperCase() + tier.slice(1)) as keyof typeof BADGE_TIER_COLORS;
  return BADGE_TIER_COLORS[key];
}

export default function MyTasks({ userData }: MyTasksProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('restaurant');

  const { categories, completedTasks, tier, level, isLoading: tasksLoading } = useTasks(userData?.id);
  const { events, isLoading: activityLoading } = useActivity({ pageSize: 5 });

  const cat = categories[activeCategory];
  const subSum = cat.numeratorFromSubmissions;
  const refSum = cat.numeratorFromReferrals;
  const totalNumerator = cat.numeratorTotal;

  // Worst-case approved submissions still needed to reach the next tier.
  // Sums what's already in-flight across R/C/B active cycles plus completed tasks.
  const sumActive = (['restaurant', 'cafe', 'bar'] as const).reduce(
    (acc, c) => acc + categories[c].numeratorTotal,
    0
  );
  // Falls back to bronze visual when there's no tier yet — only used inside
  // the earned-state branch, so the value doesn't leak into the empty card.
  const tierStyle = tierStyleFor(tier ?? 'bronze');
  const nextThreshold = tier ? NEXT_TIER_THRESHOLD[tier] : 5;
  const proofsToNextTier =
    nextThreshold !== null
      ? Math.max(0, nextThreshold * 10 - completedTasks * 10 - sumActive)
      : 0;

  // Progress-bar fills (0-100%).
  const submissionFillPct = Math.min(subSum, 10) * 10;
  const referralFillPct = Math.min(refSum, 10 - subSum) * 10;

  // Animate the gold portion's width whenever it grows — gives the user a
  // visible cue when an inviter credit lands. Stays instant on shrink/reset
  // (e.g. cycle rollover) so the bar snaps to the new state.
  const referralAnim = useRef(new Animated.Value(referralFillPct)).current;
  const prevReferralPct = useRef(referralFillPct);
  useEffect(() => {
    if (referralFillPct > prevReferralPct.current) {
      Animated.timing(referralAnim, {
        toValue: referralFillPct,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      referralAnim.setValue(referralFillPct);
    }
    prevReferralPct.current = referralFillPct;
  }, [referralFillPct, referralAnim]);

  const animatedWidth = referralAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const showLoading = tasksLoading && completedTasks === 0 && totalNumerator === 0;

  return (
    <View style={styles.root}>
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Task progress tracker                                   */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        <View style={styles.chipsRow}>
          {CATEGORY_KEYS.map((c) => {
            const isActive = activeCategory === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveCategory(c)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.counterBlock}>
          <View style={styles.counterRow}>
            <Text style={styles.counterNumber}>{totalNumerator}</Text>
            {refSum > 0 && (
              <Text style={styles.counterBonus}>(+{refSum})</Text>
            )}
          </View>
          <Text style={styles.counterLabel}>
            Total Visited {CATEGORY_LABELS[activeCategory]}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarTrack}>
            {submissionFillPct > 0 && (
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${submissionFillPct}%`,
                    backgroundColor: BAR_GREEN,
                    left: 0,
                  },
                ]}
              />
            )}
            {referralFillPct > 0 && (
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    left: `${submissionFillPct}%`,
                    width: animatedWidth,
                    backgroundColor: BAR_GOLD,
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.progressTicksRow}>
            {PROGRESS_TICKS.map((t) => {
              const lit = totalNumerator >= t;
              const isReferralLit = lit && t > subSum;
              const dotColor = !lit ? '#CBD5E1' : isReferralLit ? BAR_GOLD : BAR_GREEN;
              return (
                <View key={t} style={styles.progressTick}>
                  <View style={[styles.progressDot, { backgroundColor: dotColor }]} />
                  <Text style={styles.progressTickLabel}>{t}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.helpText}>Earn 1 credit for each approved submission!</Text>
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

        {showLoading ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.sectionLoader} />
        ) : completedTasks === 0 ? (
          <View style={styles.badgeEmptyCard}>
            <Award size={56} color="#CBD5E1" />
            <Text style={styles.badgeEmptyText}>
              Start submitting content now to earn your first badge!
            </Text>
          </View>
        ) : (
          <View style={styles.badgeCard}>
            <View style={[styles.badgeArt, { backgroundColor: tierStyle.bg }]}>
              <Award size={56} color={tierStyle.primary} />
            </View>
            <Text style={[styles.badgeTier, { color: BAR_GREEN }]}>
              {tier ? TIER_LABEL[tier] : ''}
            </Text>
            {level !== null && (
              <Text style={styles.badgeLevel}>Level {level}</Text>
            )}
            {nextThreshold === null ? (
              <Text style={styles.badgeSubcopy}>You&apos;ve reached the top tier!</Text>
            ) : (
              <Text style={styles.badgeSubcopy}>
                Upload {proofsToNextTier} proofs to reach the next level
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
            {events.map((e, i) => (
              <HistoryRow key={`${e.event_type}-${e.event_at}-${i}`} event={e} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function HistoryRow({ event }: { event: ActivityEvent }) {
  const date = formatDate(event.event_at);

  let target = event.target;
  let status: { text: string; tone: 'approved' | 'rejected' | 'neutral' } | null = null;
  let trailing: string | null = null;

  switch (event.event_type) {
    case 'submission_approved':
      status = { text: 'Approved', tone: 'approved' };
      trailing = '+1 credit';
      break;
    case 'submission_rejected':
      status = { text: 'Rejected', tone: 'rejected' };
      break;
    case 'badge_earned':
      target = `Earned ${event.target}`;
      break;
    case 'task_completed': {
      const cat = (event.metadata?.category as string | undefined) ?? '';
      const label = cat ? cat[0].toUpperCase() + cat.slice(1) : 'Task';
      target = `${label} Task Completed`;
      trailing = '+1 voucher';
      break;
    }
    case 'voucher_redeemed':
      target = `Redeemed ${event.target}`;
      break;
  }

  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyDate}>{date}</Text>
      <Text style={styles.historyTarget} numberOfLines={1}>
        {target}
      </Text>
      <View style={styles.historyTrailingCol}>
        {status && (
          <Text
            style={[
              styles.historyStatus,
              status.tone === 'approved' && { color: BAR_GREEN },
              status.tone === 'rejected' && { color: '#EF4444' },
              status.tone === 'neutral' && { color: '#64748B' },
            ]}
          >
            {status.text}
          </Text>
        )}
        {trailing && <Text style={styles.historyTrailing}>{trailing}</Text>}
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

  // Section 1 — chips + counter + bar
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: BAR_GREEN,
    borderColor: BAR_GREEN,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  counterBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  counterNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: BAR_GREEN,
    lineHeight: 64,
  },
  counterBonus: {
    fontSize: 16,
    fontWeight: '700',
    color: BAR_GOLD,
  },
  counterLabel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  progressBarWrapper: {
    marginTop: 8,
    marginBottom: 12,
  },
  progressBarTrack: {
    position: 'relative',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: 6,
  },
  progressTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  progressTick: {
    alignItems: 'center',
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  progressTickLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },

  // Section 2 — My Badge
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
    color: '#206E56',
    marginTop: -4,
  },
  badgeSubcopy: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // Section 3 — History snippet
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
    color: '#94A3B8',
    marginTop: 2,
  },
});
