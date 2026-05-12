import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flame, Star, Check } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';

const BAR_GREEN = '#206E56';
const STAR_GOLD = '#E5A93D';
const FLAME_AMBER = '#F59E0B';

const DAYS_PER_WINDOW = 14;
const MILESTONE_REWARD = 50;

// Grid math: 2 rows × 7 columns regardless of phone width.
// scrollContent padding (24 each side) + 6 gaps of 10px between cells.
const COLS = 7;
const GRID_GAP = 10;
const SCREEN_PADDING = 24;
function cellSizeFor(screenWidth: number): number {
  const usable = screenWidth - SCREEN_PADDING * 2 - GRID_GAP * (COLS - 1);
  return Math.max(28, Math.floor(usable / COLS));
}

export default function StreakScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = cellSizeFor(screenWidth);
  const {
    currentStreak,
    progressInWindow,
    canCheckinToday,
    isLoading,
    isCheckingIn,
    error,
    checkin,
  } = useDailyCheckin(userData?.id);

  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  const handleCheckin = async () => {
    const result = await checkin();
    if (!result) return;
    if (result.awardedStars > 0) {
      setMilestoneToast(`+${result.awardedStars} ★ — 14-day streak unlocked!`);
      setTimeout(() => setMilestoneToast(null), 4000);
    }
  };

  // Index of "today" in the grid (0-based). When a check-in is pending, today
  // is the next empty cell (progressInWindow). When already checked in, today
  // is the most recently filled cell (progressInWindow - 1).
  const todayIdx = canCheckinToday ? progressInWindow : Math.max(0, progressInWindow - 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Streak</Text>
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
          {/* Hero */}
          <View style={styles.hero}>
            <Flame size={48} color={FLAME_AMBER} fill={FLAME_AMBER} />
            <Text style={styles.heroNumber}>{currentStreak}</Text>
            <Text style={styles.heroLabel}>
              {currentStreak === 1 ? 'day streak' : 'day streak'}
            </Text>
          </View>

          {/* Milestone card */}
          <View style={styles.milestone}>
            <View style={styles.milestoneIcon}>
              <Star size={20} color={STAR_GOLD} fill={STAR_GOLD} />
            </View>
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneTitle}>
                +{MILESTONE_REWARD} ★ at day 14
              </Text>
              <Text style={styles.milestoneSubtitle}>
                {progressInWindow >= DAYS_PER_WINDOW
                  ? 'Milestone reached — keep going!'
                  : `${DAYS_PER_WINDOW - progressInWindow} day${DAYS_PER_WINDOW - progressInWindow === 1 ? '' : 's'} away`}
              </Text>
            </View>
          </View>

          {/* 14-day grid — locked to 2 rows × 7 columns, cell size scales with screen */}
          <Text style={styles.gridLabel}>This 14-day window</Text>
          <View style={styles.grid}>
            {Array.from({ length: DAYS_PER_WINDOW }).map((_, i) => {
              const filled = i < progressInWindow;
              const isToday = i === todayIdx && (canCheckinToday || filled);
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    { width: cellSize, height: cellSize },
                    filled && styles.cellFilled,
                    isToday && !filled && styles.cellToday,
                  ]}
                >
                  {filled ? (
                    <Check size={Math.round(cellSize * 0.4)} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.cellNumber,
                        isToday && styles.cellNumberToday,
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[
              styles.cta,
              (!canCheckinToday || isCheckingIn) && styles.ctaDisabled,
            ]}
            disabled={!canCheckinToday || isCheckingIn}
            onPress={handleCheckin}
          >
            {isCheckingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>
                {canCheckinToday ? 'Check In Now' : 'Already checked in today'}
              </Text>
            )}
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Rules */}
          <View style={styles.rules}>
            <Text style={styles.ruleItem}>• One check-in per day, KL time</Text>
            <Text style={styles.ruleItem}>• Miss a day → streak resets to 0</Text>
            <Text style={styles.ruleItem}>• {MILESTONE_REWARD} ★ awarded every 14 consecutive days</Text>
          </View>
        </ScrollView>
      )}

      {milestoneToast && (
        <View style={styles.toast} pointerEvents="none">
          <Star size={18} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.toastText}>{milestoneToast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: { width: 36 },
  loader: { paddingVertical: 64 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },

  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: -4,
  },

  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F2D177',
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneBody: { flex: 1 },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9C6F1A',
  },
  milestoneSubtitle: {
    fontSize: 12,
    color: '#9C6F1A',
    opacity: 0.8,
    marginTop: 2,
  },

  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  cell: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cellFilled: {
    backgroundColor: BAR_GREEN,
  },
  cellToday: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: STAR_GOLD,
  },
  cellNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cellNumberToday: {
    color: STAR_GOLD,
  },

  cta: {
    backgroundColor: BAR_GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },

  rules: {
    marginTop: 24,
    gap: 6,
  },
  ruleItem: {
    fontSize: 12,
    color: '#94A3B8',
  },

  toast: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: STAR_GOLD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
