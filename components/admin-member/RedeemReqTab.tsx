import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { CheckCircle, Ticket, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getVoucherAsset } from '@/lib/voucherAssets';
import type { CategoryTier } from '@/lib/categoryBadgeTiers';
import type { VoucherRewardKind } from '@/hooks/useVouchers';

const BAR_GREEN = '#206E56';

const REWARD_LABEL: Record<VoucherRewardKind, string> = {
  airbnb_3star:           '3-star or Airbnb voucher',
  hotel_3_4star:          '3–4 star hotel or Airbnb voucher',
  hotel_4_5star:          '4–5 star hotel or Airbnb voucher',
  specialty_5star_resort: 'Specialty / 5★ resort voucher',
};

const TIER_TEXT: Record<CategoryTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

interface PendingRow {
  id: string;
  user_id: string;
  tier: CategoryTier;
  reward_kind: VoucherRewardKind;
  redeemed_at: string;
  profile: {
    username: string | null;
    full_name: string | null;
    preferred_communication_channel: string | null;
    communication_contact_details: string | null;
  } | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function RedeemReqTab() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          id, user_id, tier, reward_kind, redeemed_at,
          profile:user_id (username, full_name, preferred_communication_channel, communication_contact_details)
        `)
        .not('redeemed_at', 'is', null)
        .is('fulfilled_at', null)
        .order('redeemed_at', { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as unknown as PendingRow[]);
    } catch (err: any) {
      console.error('[RedeemReqTab] load failed:', err);
      Alert.alert('Error', err.message ?? 'Failed to load redemption requests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: vouchers is in the publication. Refresh on any change in scope.
  useEffect(() => {
    const channel = supabase
      .channel('admin_redeem_req')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers' },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleMarkFulfilled = (row: PendingRow) => {
    Alert.alert(
      'Mark as fulfilled',
      `Confirm you've delivered the ${TIER_TEXT[row.tier]} voucher to ${row.profile?.full_name ?? row.profile?.username ?? 'this user'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark fulfilled',
          onPress: async () => {
            setBusyId(row.id);
            try {
              const { data, error } = await supabase.rpc('mark_voucher_fulfilled', {
                p_voucher_id: row.id,
              });
              if (error) throw error;
              const result = data as { success: boolean; reason?: string };
              if (!result?.success) {
                throw new Error(result?.reason ?? 'Could not mark fulfilled');
              }
              await load();
            } catch (err: any) {
              console.error('[RedeemReqTab] mark fulfilled failed:', err);
              Alert.alert('Error', err.message ?? 'Failed to mark fulfilled');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const renderRow = ({ item }: { item: PendingRow }) => {
    const userName = item.profile?.full_name || item.profile?.username || 'Unknown user';
    const contact = item.profile?.communication_contact_details
      ? `${item.profile.preferred_communication_channel ?? 'contact'}: ${item.profile.communication_contact_details}`
      : null;
    return (
      <View style={styles.card}>
        <Image source={getVoucherAsset(item.tier)} style={styles.art} resizeMode="contain" />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.tierTag}>{TIER_TEXT[item.tier]}</Text>
          </View>
          <Text style={styles.rewardLabel}>{REWARD_LABEL[item.reward_kind]}</Text>
          {contact && <Text style={styles.contact}>{contact}</Text>}
          <Text style={styles.requested}>Requested {formatDate(item.redeemed_at)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.fulfillBtn, busyId === item.id && { opacity: 0.6 }]}
          onPress={() => handleMarkFulfilled(item)}
          disabled={busyId === item.id}
        >
          {busyId === item.id ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CheckCircle size={14} color="#FFFFFF" />
              <Text style={styles.fulfillBtnText}>Mark fulfilled</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={BAR_GREEN} size="large" />
        <Text style={styles.loadingText}>Loading redemption requests...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={rows}
      keyExtractor={(r) => r.id}
      renderItem={renderRow}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => { setIsRefreshing(true); load(); }}
          colors={[BAR_GREEN]}
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ticket size={40} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySub}>All voucher requests have been fulfilled.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { setIsRefreshing(true); load(); }}>
            <RefreshCw size={14} color={BAR_GREEN} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { padding: 16, paddingBottom: 32 },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#F8FAFC',
  },
  loadingText: { color: '#64748B', fontSize: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAECE9',
  },
  art: { width: 56, height: 56 },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
  tierTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#475569',
  },
  rewardLabel: { fontSize: 13, color: '#0F172A', marginTop: 2 },
  contact: { fontSize: 11, color: BAR_GREEN, marginTop: 2 },
  requested: { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  fulfillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BAR_GREEN,
  },
  fulfillBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 80, paddingHorizontal: 24, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  refreshBtn: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  refreshBtnText: { color: BAR_GREEN, fontWeight: '600', fontSize: 13 },
});
