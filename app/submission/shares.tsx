import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, ChevronRight, Check, Clock } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabase';
import {
  SHARE_PLATFORMS,
  STARS_MAX,
  type SharePlatform,
} from '@/lib/shareConfig';

const BAR_GREEN = '#206E56';
const STAR_GOLD = '#E5A93D';

interface Row {
  id: number;
  partner_store_name: string | null;
  partner_store_category: string | null;
  created_at: string;
  share_status: Partial<Record<SharePlatform, 'pending' | 'verified' | 'rejected'>>;
  verified_count: number;
}

export default function SharesListScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userData?.id) return;
      try {
        const [{ data: subs }, { data: shares }] = await Promise.all([
          supabase
            .from('submissions')
            .select('id, partner_store_name, partner_store_category, created_at')
            .eq('user_id', userData.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false }),
          supabase
            .from('submission_shares')
            .select('submission_id, platform, status')
            .eq('user_id', userData.id),
        ]);

        const sharesBySubmission = new Map<number, Map<SharePlatform, 'pending' | 'verified' | 'rejected'>>();
        for (const s of shares ?? []) {
          const m = sharesBySubmission.get(s.submission_id) ?? new Map();
          m.set(s.platform as SharePlatform, s.status as 'pending' | 'verified' | 'rejected');
          sharesBySubmission.set(s.submission_id, m);
        }

        const list: Row[] = (subs ?? []).map((s) => {
          const m = sharesBySubmission.get(s.id) ?? new Map();
          const share_status: Row['share_status'] = {};
          let verified_count = 0;
          for (const p of SHARE_PLATFORMS) {
            const st = m.get(p.key);
            if (st) share_status[p.key] = st;
            if (st === 'verified') verified_count += 1;
          }
          return { ...s, share_status, verified_count };
        });

        if (!cancelled) {
          setRows(list);
          setLoading(false);
        }
      } catch (err) {
        console.error('[shares] load failed:', err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userData?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share & Earn</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator color={BAR_GREEN} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.intro}>
            <Star size={20} color={STAR_GOLD} fill={STAR_GOLD} />
            <Text style={styles.introText}>
              Pick an approved trip — earn up to {STARS_MAX} ★ per trip across the 3 platforms.
            </Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No approved trips yet. Submit a proof of travel to unlock sharing.</Text>
          ) : (
            rows.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.row}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/submission/[id]/share',
                    params: { id: String(r.id) },
                  } as never)
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowPlace} numberOfLines={1}>
                    {r.partner_store_name ?? 'Approved trip'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {(r.partner_store_category ?? '').toUpperCase()} · {' '}
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <View style={styles.platformIndicators}>
                    {SHARE_PLATFORMS.map((p) => {
                      const st = r.share_status[p.key];
                      return (
                        <View
                          key={p.key}
                          style={[
                            styles.indicator,
                            st === 'verified' && styles.indicatorVerified,
                            st === 'pending' && styles.indicatorPending,
                            st === 'rejected' && styles.indicatorRejected,
                          ]}
                        >
                          {st === 'verified' && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                          {st === 'pending' && <Clock size={11} color="#9C6F1A" />}
                          <Text
                            style={[
                              styles.indicatorText,
                              st === 'verified' && { color: '#FFFFFF' },
                              st === 'pending' && { color: '#9C6F1A' },
                              st === 'rejected' && { color: '#FFFFFF' },
                            ]}
                          >
                            {p.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <ChevronRight size={20} color="#94A3B8" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF4DD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2D177',
  },
  introText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#9C6F1A', lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECE9',
    padding: 14,
    marginBottom: 10,
  },
  rowMain: { flex: 1 },
  rowPlace: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 0.4 },
  platformIndicators: { flexDirection: 'row', gap: 6, marginTop: 8 },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  indicatorVerified: { backgroundColor: BAR_GREEN },
  indicatorPending: { backgroundColor: '#FFF4DD' },
  indicatorRejected: { backgroundColor: '#EF4444' },
  indicatorText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
});
