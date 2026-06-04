import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * A single pulsing placeholder block. Compose several to build skeleton
 * layouts that mirror the real content while it loads.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.5, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * Skeleton that mirrors the recommendation store card (image + name + type +
 * rating + location). Keep dimensions in sync with the `storeCard` styles.
 */
export function StoreCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={90} borderRadius={0} />
      <View style={styles.cardInfo}>
        <Skeleton width="80%" height={14} style={styles.line} />
        <Skeleton width="55%" height={12} style={styles.line} />
        <Skeleton width="35%" height={12} style={styles.line} />
        <Skeleton width="60%" height={10} />
      </View>
    </View>
  );
}

/**
 * Skeleton that mirrors the partner-store category grid card (taller image +
 * name + meta line). Width matches the `storeCard` 2-up grid layout.
 */
export function StoreGridCardSkeleton() {
  return (
    <View style={styles.gridCard}>
      <Skeleton width="100%" height={120} borderRadius={0} />
      <View style={styles.gridInfo}>
        <Skeleton width="75%" height={16} style={styles.line} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E2E8F0',
  },
  gridCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  gridInfo: {
    padding: 12,
  },
  card: {
    width: 140,
    backgroundColor: 'white',
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardInfo: {
    padding: 12,
  },
  line: {
    marginBottom: 8,
  },
});
