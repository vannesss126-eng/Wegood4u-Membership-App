import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { ArrowRight, Check, Gift } from 'lucide-react-native';
import Star from '@/components/icons/Star';
import StarTradeButton from './StarTradeButton';

interface VisitProgressCardProps {
  realVisits: number;
  extrasApplied: number;
  total: number;
  isClaimable: boolean;
  walletBalance: number;
  projectedTier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  onTrade: () => Promise<{ newBalance: number; newExtrasApplied: number }>;
  onClaim: () => Promise<{ voucherId: string }>;
}

const TIER_LABEL: Record<'bronze' | 'silver' | 'gold' | 'platinum', string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const TICKS = [0, 2, 4, 6, 8, 10] as const;

export default function VisitProgressCard({
  realVisits,
  extrasApplied,
  total,
  isClaimable,
  walletBalance,
  projectedTier,
  onTrade,
  onClaim,
}: VisitProgressCardProps) {
  const realPct = Math.min(realVisits, 10) * 10;
  const extrasPct = Math.min(extrasApplied, 10 - Math.min(realVisits, 10)) * 10;
  const tierLabel = projectedTier ? TIER_LABEL[projectedTier] : 'Bronze';

  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimErrorMsg, setClaimErrorMsg] = useState<string | null>(null);
  const [claimSuccessOpen, setClaimSuccessOpen] = useState(false);
  const [claimMintedVoucher, setClaimMintedVoucher] = useState(false);

  const handleClaim = async () => {
    if (claimSubmitting) return;
    setClaimSubmitting(true);
    setClaimErrorMsg(null);
    try {
      const result = await onClaim();
      setClaimMintedVoucher(Boolean(result?.voucherId));
      setClaimSuccessOpen(true);
    } catch (err: any) {
      console.error('[VisitProgressCard] claim failed:', err);
      setClaimErrorMsg(err?.message ?? 'Could not complete the task. Please try again.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, isClaimable && styles.cardClaimable]}>
      <Text style={styles.label}>{isClaimable ? 'Main Tasks · ready' : 'Main Tasks'}</Text>
      <Text style={styles.title}>Submit 10 Proof of Travels</Text>

      {/* Centered numerator with invisible spacer when extras > 0 */}
      <View style={styles.numRow}>
        {extrasApplied > 0 && (
          <View style={[styles.extrasPill, styles.extrasPillSpacer]}>
            <Star size={13} color="#E5A93D" />
            <Text style={styles.extrasText}>+{extrasApplied}</Text>
          </View>
        )}
        <Text style={styles.realNumber}>{realVisits}</Text>
        {extrasApplied > 0 && (
          <View style={styles.extrasPill}>
            <Star size={13} color="#E5A93D" />
            <Text style={styles.extrasText}>+{extrasApplied}</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {realPct > 0 && (
          <View
            style={[
              styles.progressReal,
              {
                width: `${realPct}%`,
                borderTopRightRadius: realPct === 100 ? 99 : 0,
                borderBottomRightRadius: realPct === 100 ? 99 : 0,
              },
            ]}
          />
        )}
        {extrasPct > 0 && (
          <View
            style={[
              styles.progressExtras,
              {
                left: `${realPct}%`,
                width: `${extrasPct}%`,
                borderTopRightRadius: realPct + extrasPct === 100 ? 99 : 0,
                borderBottomRightRadius: realPct + extrasPct === 100 ? 99 : 0,
              },
            ]}
          />
        )}
      </View>

      {/* Tick row */}
      <View style={styles.tickRow}>
        {TICKS.map((t, i) => (
          <View key={t} style={[styles.tickCol, { left: `${i * 20}%` }]}>
            <View style={styles.tick} />
            <Text style={styles.tickLabel}>{t}</Text>
          </View>
        ))}
      </View>

      {isClaimable ? (
        <>
          <View style={styles.readyCallout}>
            <View style={styles.readyCheck}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.readyText}>
              <Text style={styles.readyTextBold}>Cycle complete!</Text> Tap below to mint a {tierLabel} voucher.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.claimBtn}
            onPress={handleClaim}
            disabled={claimSubmitting}
            activeOpacity={0.85}
          >
            {claimSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Gift size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.claimBtnText}>Complete Tasks &amp; Claim</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {claimErrorMsg && <Text style={styles.claimError}>{claimErrorMsg}</Text>}
          <Text style={styles.claimHelp}>
            Mints <Text style={styles.claimHelpBold}>1 {tierLabel} voucher</Text> · Cycle resets to 0/10
          </Text>
        </>
      ) : (
        <View style={styles.tradeRow}>
          <StarTradeButton
            balance={walletBalance}
            extrasApplied={extrasApplied}
            onTrade={onTrade}
          />
        </View>
      )}

      <Modal
        visible={claimSuccessOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClaimSuccessOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <Gift size={28} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitle}>
              {claimMintedVoucher ? 'Voucher unlocked!' : 'Cycle complete!'}
            </Text>
            <Text style={styles.modalBody}>
              {claimMintedVoucher
                ? `Your ${tierLabel} voucher is waiting in the Rewards tab.`
                : 'Nice work — keep going to reach the next Visit Badge level and earn another voucher.'}
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setClaimSuccessOpen(false)}
            >
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    borderRadius: 18,
    padding: 22,
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: 'rgba(32,110,86,0.16)',
    overflow: 'hidden',
  },
  cardClaimable: {
    borderColor: '#206E56',
    borderWidth: 1.5,
    backgroundColor: '#EFFAF3',
    shadowColor: '#206E56',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
  },
  label: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#206E56',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#0E1410',
    letterSpacing: -0.2,
    marginTop: 6,
    marginBottom: 22,
  },

  // Numerator
  numRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 18,
  },
  realNumber: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 64,
    color: '#16513F',
    letterSpacing: -2.5,
  },
  extrasPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF4DD',
    borderWidth: 1,
    borderColor: '#F2D177',
    shadowColor: '#E5A93D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  extrasPillSpacer: {
    opacity: 0,
  },
  extrasText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9C6F1A',
    letterSpacing: -0.2,
  },

  // Progress bar
  progressBar: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#D7E1DA',
    borderWidth: 1,
    borderColor: '#D9DDD8',
    position: 'relative',
    overflow: 'hidden',
  },
  progressReal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#206E56',
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  progressExtras: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#E5A93D',
    shadowColor: '#E5A93D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },

  // Tick row
  tickRow: {
    position: 'relative',
    height: 22,
    marginTop: 8,
  },
  tickCol: {
    position: 'absolute',
    top: 0,
    width: 24,
    marginLeft: -12,
    alignItems: 'center',
  },
  tick: {
    width: 1.5,
    height: 5,
    backgroundColor: '#9CA39E',
    opacity: 0.45,
  },
  tickLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA39E',
    letterSpacing: 0.2,
  },

  // Trade row
  tradeRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D9DDD8',
  },

  // Ready callout
  readyCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    padding: 12,
    backgroundColor: 'rgba(32,110,86,0.08)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#206E56',
    borderRadius: 12,
  },
  readyCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#206E56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyText: {
    flex: 1,
    fontSize: 13,
    color: '#16513F',
    fontWeight: '600',
    lineHeight: 18,
  },
  readyTextBold: {
    fontWeight: '800',
  },

  // Claim button
  claimBtn: {
    marginTop: 14,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#206E56',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#206E56',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 6,
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.05,
  },
  claimError: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  claimHelp: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA39E',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  claimHelpBold: {
    color: '#206E56',
    fontWeight: '700',
  },

  // Success modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#206E56',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0E1410',
  },
  modalBody: {
    fontSize: 14,
    color: '#5A615C',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: '#206E56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
