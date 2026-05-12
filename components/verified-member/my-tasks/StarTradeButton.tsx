import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import Star from '@/components/icons/Star';

interface StarTradeButtonProps {
  balance: number;
  extrasApplied: number;
  onTrade: () => Promise<{ newBalance: number; newExtrasApplied: number }>;
}

const STARS_PER_TRADE = 100;
const EXTRAS_CAP = 4;

export default function StarTradeButton({
  balance,
  extrasApplied,
  onTrade,
}: StarTradeButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enoughStars = balance >= STARS_PER_TRADE;
  const underCap = extrasApplied < EXTRAS_CAP;
  const canTrade = enoughStars && underCap;

  const remainingStarsAfter = balance - STARS_PER_TRADE;

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onTrade();
      setConfirmOpen(false);
    } catch (err: any) {
      console.error('[StarTradeButton] trade failed:', err);
      setErrorMsg(err?.message ?? 'Trade failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, !canTrade && styles.buttonDisabled]}
        onPress={() => setConfirmOpen(true)}
        disabled={!canTrade}
        activeOpacity={0.85}
      >
        <Star size={14} color={canTrade ? '#E5A93D' : '#9CA39E'} />
        <Text style={[styles.buttonText, !canTrade && styles.buttonTextDisabled]}>
          Use 100 ★ for +1 Progress
        </Text>
        <ArrowRight size={14} color={canTrade ? '#9C6F1A' : '#9CA39E'} />
      </TouchableOpacity>

      <Text style={styles.walletStatus}>
        <Text style={styles.walletStatusBold}>{balance} ★</Text> in wallet ·{' '}
        <Text style={styles.walletStatusBold}>
          {extrasApplied} of {EXTRAS_CAP}
        </Text>{' '}
        extras used this cycle
      </Text>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Trade 100 stars?</Text>
            <Text style={styles.modalBody}>
              Add{' '}
              <Text style={styles.modalBodyBold}>+1 progress</Text> to your Visit
              10 Task. You&apos;ll have{' '}
              <Text style={styles.modalBodyBold}>{remainingStarsAfter} ★</Text>{' '}
              left in your wallet.
            </Text>
            <Text style={styles.modalNote}>
              {extrasApplied + 1} of {EXTRAS_CAP} extras used after this trade.
            </Text>

            {errorMsg && <Text style={styles.modalError}>{errorMsg}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Confirm trade</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2D177',
    backgroundColor: '#FFE9B5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#E5A93D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#F7F8F7',
    borderColor: '#EAECE9',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#9C6F1A',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  buttonTextDisabled: {
    color: '#9CA39E',
  },
  walletStatus: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA39E',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  walletStatusBold: {
    color: '#9C6F1A',
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0E1410',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5A615C',
  },
  modalBodyBold: {
    color: '#0E1410',
    fontWeight: '700',
  },
  modalNote: {
    fontSize: 12,
    color: '#9CA39E',
    fontStyle: 'italic',
  },
  modalError: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#F1F5F4',
  },
  modalBtnGhostText: {
    color: '#5A615C',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnPrimary: {
    backgroundColor: '#206E56',
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
