import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Award, User } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useUser } from '@/context/UserContext';
import {
  useVisitBadge,
  type VisitBadgeTier as BadgeTier,
  type VisitBadgeLevel as BadgeLevel,
} from '@/hooks/useVisitBadge';
import { useCategoryStats, type StoreCategory } from '@/hooks/useCategoryStats';
import { BADGE_TIER_COLORS } from '@/config/badges';
import {
  getBadgeAsset,
  type CategoryAssetKey,
} from '@/lib/badgeAssets';

const BAR_GREEN = '#206E56';

const CATEGORY_LABELS: Record<string, { label: string; assetKey: string }> = {
  restaurant: { label: 'restaurant', assetKey: 'Restaurant' },
  cafe:       { label: 'cafe',       assetKey: 'Cafe' },
  bar:        { label: 'bar',        assetKey: 'Bar' },
  hotel:      { label: 'hotel',      assetKey: 'Hotel' },
};

const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

function tierAssetKey(tier: BadgeTier): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  return (tier[0].toUpperCase() + tier.slice(1)) as
    | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

function formatJoinedDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function BadgeShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category: string }>();
  const { userData } = useUser();
  const { tier, level, isLoading: badgeLoading } = useVisitBadge(userData?.id);
  const { counts, isLoading: statsLoading } = useCategoryStats(userData?.id);
  const isLoading = badgeLoading || statsLoading;

  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const categoryKey = (params.category ?? 'restaurant').toLowerCase();
  const categoryInfo = CATEGORY_LABELS[categoryKey] ?? CATEGORY_LABELS.restaurant;
  const totalVisits = counts[categoryKey as StoreCategory] ?? 0;
  const badgeSource = tier && level
    ? getBadgeAsset(categoryInfo.assetKey as CategoryAssetKey, tierAssetKey(tier), level)
    : null;

  const displayName = userData?.fullName || userData?.username || 'Member';
  const tierStyle = tier
    ? BADGE_TIER_COLORS[tierAssetKey(tier)]
    : BADGE_TIER_COLORS.Bronze;

  const handleShare = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available', 'This device does not support the native share sheet.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'My Badge Collection',
      });
    } catch (err: any) {
      console.error('[BadgeShareScreen] capture/share failed:', err);
      Alert.alert('Couldn’t share', err?.message ?? 'Unknown error');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Badge</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.collectionTitle}>My Badge Collection</Text>

        {isLoading ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.loader} />
        ) : (
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <View style={styles.cardArtFrame}>
              {badgeSource ? (
                <Image
                  source={badgeSource}
                  style={styles.cardArt}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    styles.cardArtFallback,
                    { backgroundColor: tier ? tierStyle.bg : '#F1F5F9' },
                  ]}
                >
                  <Award
                    size={120}
                    color={tier ? tierStyle.primary : '#CBD5E1'}
                  />
                </View>
              )}
            </View>

            {tier && level ? (
              <>
                <Text style={[styles.cardTier, { color: BAR_GREEN }]}>
                  {TIER_LABEL[tier]}
                </Text>
                <Text style={styles.cardLevel}>Level {level}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.cardTier, { color: '#94A3B8' }]}>
                  No badge yet
                </Text>
                <Text style={styles.cardLevel}>Start submitting to earn one</Text>
              </>
            )}

            <Text style={styles.cardVisits}>
              <Text style={styles.cardVisitsBold}>{totalVisits}</Text>
              {' '}total visit(s) {categoryInfo.label}
            </Text>

            <View style={styles.profileChip}>
              {userData?.avatarUrl ? (
                <Image
                  source={{ uri: userData.avatarUrl }}
                  style={styles.profileAvatar}
                />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <User size={20} color="#94A3B8" />
                </View>
              )}
              <View style={styles.profileText}>
                <Text style={styles.profileName}>{displayName}</Text>
                {userData?.createdAt && (
                  <Text style={styles.profileJoined}>
                    Joined since {formatJoinedDate(userData.createdAt)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
          onPress={handleShare}
          disabled={isSharing || isLoading}
        >
          <Text style={styles.shareButtonText}>
            {isSharing ? 'Preparing…' : 'Share'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  loader: {
    paddingVertical: 64,
  },

  // Shareable card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  cardArtFrame: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardArt: {
    width: '100%',
    height: '100%',
  },
  cardArtFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTier: {
    fontSize: 28,
    fontWeight: '800',
  },
  cardLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: BAR_GREEN,
    marginBottom: 8,
  },
  cardVisits: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 16,
  },
  cardVisitsBold: {
    fontWeight: '700',
    color: '#0F172A',
  },

  // Profile chip
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  profileAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileJoined: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Bottom CTA
  shareButton: {
    marginTop: 24,
    backgroundColor: BAR_GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
