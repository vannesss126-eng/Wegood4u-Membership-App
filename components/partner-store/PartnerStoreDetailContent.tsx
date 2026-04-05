import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  Phone,
  MapPin,
  Navigation,
  Clock3,
  CalendarDays,
  Wallet,
} from 'lucide-react-native';
import type { PartnerStore } from '@/types';

type PartnerStoreDetailContentProps = {
  categoryLabel: 'Restaurant' | 'Cafe';
  store: PartnerStore | null;
  isLoading: boolean;
  errorMessage: string | null;
  onBack: () => void;
  distanceLabel?: string;
};

export default function PartnerStoreDetailContent({
  categoryLabel,
  store,
  isLoading,
  errorMessage,
  onBack,
  distanceLabel = 'Distance unavailable',
}: PartnerStoreDetailContentProps) {
  const formatRating = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return '—';
    }
    return value.toFixed(1);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.stateContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#206E56" />
        <Text style={styles.stateText}>Loading store details...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage || !store) {
    return (
      <SafeAreaView style={styles.stateContainer} edges={['top']}>
        <TouchableOpacity onPress={onBack} style={styles.backTextButton}>
          <ArrowLeft size={18} color="#1e293b" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.stateTitle}>Store unavailable</Text>
        <Text style={styles.stateText}>{errorMessage || 'Unable to load this store.'}</Text>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    const locationLine = store.address?.trim() || store.city || '';
    const message = [store.name, locationLine, store.phone].filter(Boolean).join('\n');
    try {
      await Share.share({ title: store.name, message });
    } catch {
      // Share cancelled or unavailable
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: store.image }}
            style={styles.bannerImage}
            resizeMode="cover"
          />

          <View style={styles.topActionsRow}>
            <TouchableOpacity onPress={onBack} style={styles.circleButton} accessibilityRole="button" accessibilityLabel="Go back">
              <ArrowLeft size={18} color="#1e293b" />
            </TouchableOpacity>

            <View style={styles.actionPill}>
              <TouchableOpacity
                style={styles.actionPillButton}
                accessibilityRole="button"
                accessibilityLabel="Add to favorites"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Heart size={18} color="#F43F5E" />
              </TouchableOpacity>
              <View style={styles.actionPillDivider} />
              <TouchableOpacity
                style={styles.actionPillButton}
                accessibilityRole="button"
                accessibilityLabel="Share store"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleShare}
              >
                <Share2 size={18} color="#1e293b" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.categoryLabel}>{categoryLabel}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.ratingWrap}>
              <Star size={18} color="#FACC15" fill="#FACC15" />
              <Text style={styles.ratingText}>{formatRating(store.rating)}</Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>
            {store.description || 'No description available.'}
          </Text>

          <View style={styles.infoGroup}>
            <InfoRow icon={<Phone size={16} color="#64748b" />} text={store.phone || 'No phone'} />
            <InfoRow icon={<MapPin size={16} color="#64748b" />} text={store.address || store.city} />
            <InfoRow icon={<Navigation size={16} color="#64748b" />} text={distanceLabel} />
            <InfoRow icon={<Clock3 size={16} color="#64748b" />} text={store.hours || 'Hours unavailable'} />
            <InfoRow icon={<CalendarDays size={16} color="#64748b" />} text="Mon - Sun" />
            <InfoRow icon={<Wallet size={16} color="#64748b" />} text="$$$" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bannerContainer: {
    height: 280,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  topActionsRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  actionPillButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  storeName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#525252',
    marginBottom: 16,
  },
  infoGroup: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 22,
    alignItems: 'center',
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    color: '#525252',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    gap: 10,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  stateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  backTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
});
