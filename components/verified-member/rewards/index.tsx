import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Star, Lock } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useVouchers, type VoucherRewardKind } from '@/hooks/useVouchers';
import { getVoucherAsset } from '@/lib/voucherAssets';
import type { CategoryTier } from '@/lib/categoryBadgeTiers';

const BAR_GREEN = '#206E56';
const BAR_GREEN_DEEP = '#16513F';

const REWARD_LABEL: Record<VoucherRewardKind, string> = {
  airbnb_3star:           '3-star or Airbnb voucher',
  hotel_3_4star:          '3–4 star hotel or Airbnb voucher',
  hotel_4_5star:          '4–5 star hotel or Airbnb voucher',
  specialty_5star_resort: 'Specialty / 5★ resort voucher',
};

const TIER_REWARD: Record<CategoryTier, VoucherRewardKind> = {
  bronze:   'airbnb_3star',
  silver:   'hotel_3_4star',
  gold:     'hotel_4_5star',
  platinum: 'specialty_5star_resort',
};

const TIER_TEXT: Record<CategoryTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const TIER_ACCENT: Record<CategoryTier, { bg: string; ink: string }> = {
  bronze:   { bg: '#F4E4D5', ink: '#8B5A2B' },
  silver:   { bg: '#EDF1F3', ink: '#475569' },
  gold:     { bg: '#FFF1C8', ink: '#9C6F1A' },
  platinum: { bg: '#DEEDFB', ink: '#0F62B0' },
};

const CATALOG_ORDER: CategoryTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export default function Rewards() {
  const { userData } = useUser();
  const {
    unredeemedByTier,
    redeemed,
    isLoading,
    error,
    redeemByTier,
  } = useVouchers(userData?.id);

  const [confirming, setConfirming] = useState<CategoryTier | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const totalAvailable =
    unredeemedByTier.bronze +
    unredeemedByTier.silver +
    unredeemedByTier.gold +
    unredeemedByTier.platinum;

  const handleConfirmRedeem = async () => {
    if (!confirming || isRedeeming) return;
    setIsRedeeming(true);
    try {
      const result = await redeemByTier(confirming);
      if (result === null) {
        Alert.alert('Could not redeem', error ?? 'Please try again later.');
      }
    } finally {
      setIsRedeeming(false);
      setConfirming(null);
    }
  };

  const renderCatalogCard = (tier: CategoryTier) => {
    const accent = TIER_ACCENT[tier];
    const count = unredeemedByTier[tier];
    const enabled = count > 0;
    const rewardLabel = REWARD_LABEL[TIER_REWARD[tier]];

    return (
      <View key={tier} style={styles.card}>
        <Image
          source={getVoucherAsset(tier)}
          style={[styles.voucherArt, !enabled && styles.dimArt]}
          resizeMode="contain"
        />
        <View style={styles.cardBody}>
          <View style={[styles.tierChip, { backgroundColor: accent.bg }]}>
            <Text style={[styles.tierChipText, { color: accent.ink }]}>{TIER_TEXT[tier]}</Text>
          </View>
          <Text style={[styles.cardTitle, !enabled && styles.cardTitleDim]}>{rewardLabel}</Text>
          <Text style={styles.cardMeta}>
            {enabled
              ? `You have ${count} unredeemed`
              : 'Reach this tier on Visit Badge to unlock'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.redeemBtn, !enabled && styles.redeemBtnDisabled]}
          onPress={() => enabled && setConfirming(tier)}
          disabled={!enabled}
        >
          {enabled ? (
            <>
              <Text style={styles.redeemBtnText}>Redeem</Text>
              <View style={styles.redeemCountChip}>
                <Text style={styles.redeemCountText}>×{count}</Text>
              </View>
            </>
          ) : (
            <>
              <Lock size={12} color="#94A3B8" />
              <Text style={styles.redeemBtnTextDisabled}>Locked</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your Rewards</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{totalAvailable} Available</Text>
        </View>
      </View>

      <View style={styles.intro}>
        <Star size={16} color="#9C6F1A" fill="#E5A93D" />
        <Text style={styles.introText}>
          Each Visit Badge level mints a voucher of that tier. Reach Platinum L3 to claim all 4
          tiers — up to 12 lifetime rewards (3 of each).
        </Text>
      </View>

      {isLoading && <ActivityIndicator color={BAR_GREEN} style={{ marginTop: 16 }} />}

      {!isLoading && (
        <>
          <Text style={styles.sectionLabel}>Available vouchers</Text>
          <View style={styles.list}>{CATALOG_ORDER.map(renderCatalogCard)}</View>

          {redeemed.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Past redemptions</Text>
              <View style={styles.list}>
                {redeemed.map((v) => {
                  const accent = TIER_ACCENT[v.tier];
                  return (
                    <View key={v.id} style={[styles.card, styles.cardDimmed]}>
                      <Image source={getVoucherAsset(v.tier)} style={[styles.voucherArt, styles.dimArt]} resizeMode="contain" />
                      <View style={styles.cardBody}>
                        <View style={[styles.tierChip, { backgroundColor: accent.bg, opacity: 0.6 }]}>
                          <Text style={[styles.tierChipText, { color: accent.ink }]}>{TIER_TEXT[v.tier]}</Text>
                        </View>
                        <Text style={[styles.cardTitle, styles.cardTitleDim]}>{REWARD_LABEL[v.reward_kind]}</Text>
                        <Text style={styles.cardMeta}>
                          Requested {v.redeemed_at ? new Date(v.redeemed_at).toLocaleDateString() : ''}
                        </Text>
                      </View>
                      <View style={styles.usedTag}>
                        <Text style={styles.usedTagText}>
                          {v.fulfilled_at ? 'Fulfilled' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      <View style={styles.terms}>
        <Text style={styles.termsTitle}>Terms & Conditions</Text>
        <Text style={styles.termsText}>• Vouchers are minted automatically when you reach a Visit Badge level</Text>
        <Text style={styles.termsText}>• Each voucher can only be redeemed once</Text>
        <Text style={styles.termsText}>• Our team reaches out via WhatsApp to issue the reward</Text>
        <Text style={styles.termsText}>• Subject to availability at partner locations</Text>
      </View>

      {/* Confirm modal */}
      <Modal
        visible={confirming !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {confirming && (
              <Image
                source={getVoucherAsset(confirming)}
                style={styles.modalArt}
                resizeMode="contain"
              />
            )}
            <Text style={styles.modalTitle}>
              Request your {confirming ? TIER_TEXT[confirming] : ''} voucher?
            </Text>
            <Text style={styles.modalBody}>
              Our team will reach out via WhatsApp to issue it. This consumes one of your{' '}
              {confirming ? TIER_TEXT[confirming] : ''} vouchers.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirming(null)}
                disabled={isRedeeming}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, isRedeeming && { opacity: 0.6 }]}
                onPress={handleConfirmRedeem}
                disabled={isRedeeming}
              >
                {isRedeeming ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Star size={14} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.modalConfirmText}>Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  headerBadge: {
    backgroundColor: '#CBEED2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BAR_GREEN,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '600', color: BAR_GREEN },

  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F2D177',
  },
  introText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#9C6F1A',
    fontWeight: '500',
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  list: { paddingHorizontal: 20, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAECE9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDimmed: { backgroundColor: '#F8FAFC' },
  voucherArt: { width: 64, height: 64 },
  dimArt: { opacity: 0.4 },
  cardBody: { flex: 1 },
  tierChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  tierChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardTitleDim: { color: '#94A3B8' },
  cardMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: BAR_GREEN,
  },
  redeemBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  redeemBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  redeemBtnTextDisabled: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  redeemCountChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  redeemCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  usedTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  usedTagText: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.4 },

  terms: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECE9',
  },
  termsTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8 },
  termsText: { fontSize: 12, color: '#94A3B8', lineHeight: 18 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalArt: { width: 96, height: 96, marginBottom: 8 },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  modalConfirm: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: BAR_GREEN_DEEP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
