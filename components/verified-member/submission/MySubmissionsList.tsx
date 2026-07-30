import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import { Clock, CheckCircle2, XCircle, ChevronRight, X } from 'lucide-react-native';
import { signSubmissionImagesOnDemand } from '@/hooks/useSubmissions';
import { friendlyRejectReason } from '@/lib/rejectReason';
import type { TransformedSubmission } from '@/types';

const BAR_GREEN = '#206E56';
// Cap the inline list; the full paginated record lives in History.
const MAX_ROWS = 12;

const STATUS_META = {
  pending: { label: 'Pending', bg: '#FEF3C7', fg: '#B45309', Icon: Clock },
  approved: { label: 'Approved', bg: '#DCFCE7', fg: '#166534', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: '#FEE2E2', fg: '#B91C1C', Icon: XCircle },
} as const;

interface MySubmissionsListProps {
  submissions: TransformedSubmission[];
  isLoading?: boolean;
}

/**
 * Text-only list of the member's own submissions (Pending / Approved / Rejected).
 * Follows the architecture brief's Pattern B: NO images are loaded in the list —
 * tapping a row signs that one submission's receipt + selfie on demand (60s TTL)
 * and shows them in a modal, so browsing history costs ~zero image egress.
 */
export default function MySubmissionsList({ submissions, isLoading }: MySubmissionsListProps) {
  const [viewing, setViewing] = useState<TransformedSubmission | null>(null);
  const [signing, setSigning] = useState(false);
  const [images, setImages] = useState<{ receipt: string; selfie: string } | null>(null);

  const rows = useMemo(() => submissions.slice(0, MAX_ROWS), [submissions]);
  const extraCount = submissions.length - rows.length;

  // Sign the tapped submission's images only when the modal opens.
  useEffect(() => {
    if (!viewing) {
      setImages(null);
      return;
    }
    let active = true;
    setSigning(true);
    setImages(null);
    signSubmissionImagesOnDemand(viewing.receiptPhoto, viewing.selfiePhoto)
      .then((imgs) => active && setImages(imgs))
      .catch(() => active && setImages({ receipt: '', selfie: '' }))
      .finally(() => active && setSigning(false));
    return () => {
      active = false;
    };
  }, [viewing]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your Submissions</Text>

      {isLoading && submissions.length === 0 ? (
        <ActivityIndicator color={BAR_GREEN} style={styles.loader} />
      ) : submissions.length === 0 ? (
        <Text style={styles.empty}>
          You haven&apos;t submitted any proof yet. Anything you submit will show up here.
        </Text>
      ) : (
        <>
          {rows.map((s) => {
            const meta = STATUS_META[s.status] ?? STATUS_META.pending;
            const Icon = meta.Icon;
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => setViewing(s)}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.store} numberOfLines={1}>
                    {s.restaurantName}
                  </Text>
                  <Text style={styles.date}>{s.submissionDate}</Text>
                  {s.status === 'rejected' && (
                    <Text style={styles.reason} numberOfLines={2}>
                      {friendlyRejectReason(s.adminNotes)}
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Icon size={12} color={meta.fg} />
                  <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
                <ChevronRight size={16} color="#CBD5E1" />
              </TouchableOpacity>
            );
          })}
          {extraCount > 0 && (
            <Text style={styles.more}>+{extraCount} more in History</Text>
          )}
        </>
      )}

      {/* On-demand image viewer (Pattern B) */}
      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {viewing?.restaurantName}
                </Text>
                <Text style={styles.modalSub}>{viewing?.submissionDate}</Text>
              </View>
              <TouchableOpacity onPress={() => setViewing(null)} style={styles.closeBtn}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {signing || !images ? (
              <ActivityIndicator color={BAR_GREEN} style={styles.modalLoader} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.imgLabel}>Receipt</Text>
                {images.receipt ? (
                  <Image source={{ uri: images.receipt }} style={styles.img} resizeMode="contain" />
                ) : (
                  <Text style={styles.imgMissing}>Receipt image unavailable.</Text>
                )}

                <Text style={styles.imgLabel}>Selfie</Text>
                {images.selfie ? (
                  <Image source={{ uri: images.selfie }} style={styles.img} resizeMode="contain" />
                ) : (
                  <Text style={styles.imgMissing}>Selfie image unavailable.</Text>
                )}

                {viewing?.status === 'rejected' && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonBoxTitle}>Why it was rejected</Text>
                    <Text style={styles.reasonBoxText}>
                      {friendlyRejectReason(viewing?.adminNotes)}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  loader: {
    paddingVertical: 20,
  },
  empty: {
    fontSize: 13,
    color: '#94A3B8',
    paddingVertical: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  rowMain: {
    flex: 1,
  },
  store: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  date: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  reason: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 4,
    lineHeight: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  more: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingTop: 12,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoader: {
    paddingVertical: 48,
  },
  imgLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 6,
  },
  img: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  imgMissing: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  reasonBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  reasonBoxText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
});
