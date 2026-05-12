import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, ChevronRight, Star } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';

const BAR_GREEN = '#206E56';
const STAR_GOLD = '#E5A93D';
const FLAME_AMBER = '#F59E0B';

export default function DailyCheckinTile() {
  const router = useRouter();
  const { userData } = useUser();
  const {
    currentStreak,
    progressInWindow,
    canCheckinToday,
    isLoading,
  } = useDailyCheckin(userData?.id);

  if (isLoading) {
    return (
      <View style={styles.tile}>
        <ActivityIndicator color={BAR_GREEN} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.85}
      onPress={() => router.push('/tasks/streak' as never)}
    >
      <View style={styles.iconWrap}>
        <Flame size={28} color={FLAME_AMBER} fill={FLAME_AMBER} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Daily Log-in Streak</Text>
        <Text style={styles.subtitle}>
          {currentStreak === 0
            ? 'Start your streak today'
            : `${currentStreak}-day streak · ${progressInWindow}/14 to next reward`}
        </Text>
      </View>

      {canCheckinToday ? (
        <View style={styles.cta}>
          <Star size={14} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.ctaText}>Check in</Text>
        </View>
      ) : (
        <View style={styles.checked}>
          <Text style={styles.checkedText}>Done today</Text>
          <ChevronRight size={16} color="#94A3B8" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAECE9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: STAR_GOLD,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  checked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
