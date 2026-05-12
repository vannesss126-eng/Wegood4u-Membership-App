import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { User as UserIcon } from 'lucide-react-native';
import { getTierFrameAsset } from '@/lib/voucherAssets';
import type { CategoryTier } from '@/lib/categoryBadgeTiers';

interface ProfileFrameProps {
  /** Avatar image URI. Falls back to a User icon if null/undefined. */
  avatarUri?: string | null;
  /** Visit Badge tier driving the frame. null = no frame (user hasn't earned one yet). */
  tier: CategoryTier | null;
  /** Outer size of the framed avatar in px. */
  size?: number;
}

// Composites a user avatar inside the tier frame from assets/images/tier_frame/.
// The frame swaps automatically as the Visit Badge tier crosses (Bronze → Silver
// → Gold → Platinum). When `tier` is null we render a plain circle so verified
// members who haven't completed a cycle yet still see their avatar.
export default function ProfileFrame({ avatarUri, tier, size = 96 }: ProfileFrameProps) {
  const innerSize = Math.round(size * 0.72);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {tier && (
        <Image
          source={getTierFrameAsset(tier)}
          style={[styles.frame, { width: size, height: size }]}
          resizeMode="contain"
        />
      )}
      <View
        style={[
          styles.avatarSlot,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={[styles.avatar, { borderRadius: innerSize / 2 }]}
          />
        ) : (
          <UserIcon size={Math.round(innerSize * 0.5)} color="#94A3B8" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarSlot: {
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
