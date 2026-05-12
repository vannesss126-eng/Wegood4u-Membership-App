import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Star, ChevronRight } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabase';
import { STARS_MAX } from '@/lib/shareConfig';

const BAR_GREEN_DEEP = '#16513F';
const STAR_GOLD = '#E5A93D';

export default function ShareEarnCard() {
  const router = useRouter();
  const { userData } = useUser();
  const [approvedCount, setApprovedCount] = useState(0);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userData?.id) return;
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userData.id)
        .eq('status', 'approved');
      if (!cancelled) {
        setApprovedCount(count ?? 0);
        setShouldRender((count ?? 0) > 0);
      }
    })();
    return () => { cancelled = true; };
  }, [userData?.id]);

  if (!shouldRender) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push('/submission/shares' as never)}
    >
      <View style={styles.iconWrap}>
        <Star size={22} color="#FFFFFF" fill="#FFFFFF" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Share & earn up to {STARS_MAX} ★</Text>
        <Text style={styles.subtitle}>
          {approvedCount} approved trip{approvedCount === 1 ? '' : 's'} ready to share
        </Text>
      </View>
      <ChevronRight size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BAR_GREEN_DEEP,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: STAR_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: '#C9E0D2', marginTop: 2 },
});
