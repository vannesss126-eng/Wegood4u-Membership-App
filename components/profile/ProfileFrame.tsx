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
// → Gold → Platinum). When `tier` is null (no rank yet) we render a full-size
// avatar with a neutral default ring, so it reads as an intentional frame
// instead of a small avatar floating inside an empty frame.
export default function ProfileFrame({ avatarUri, tier, size = 96 }: ProfileFrameProps) {
  // Ranked: avatar is inset so the tier frame shows around it.
  // Unranked: avatar fills the whole footprint (the ring is its "frame").
  const innerSize = tier ? Math.round(size * 0.72) : size;

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
          !tier && styles.defaultRing,
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
  // Neutral default frame for users who haven't earned a Visit Badge tier yet,
  // so the avatar never appears inside an empty frame.
  defaultRing: {
    borderWidth: 3,
    borderColor: '#CBEED2',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
