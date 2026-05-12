import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { UserPlus, ChevronDown, ChevronUp, Star } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import {
  useReferrals,
  type Level1Referral,
  type ReferralState,
} from '@/hooks/useReferrals';
import { supabase } from '@/lib/supabase';

const truncateName = (name: string | null | undefined, maxLength: number = 30): string => {
  if (!name) return 'Unknown User';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength).trim() + '...';
};

const BAR_GREEN = '#206E56';
const STAR_GOLD = '#E5A93D';
const BANNER_DURATION_MS = 4000;

type StarBannerKind = 'self_bonus' | 'l1' | 'l2';

interface StarBanner {
  kind: StarBannerKind;
  stars: number;
  inviteeName: string | null;
}

function StateDot({ state, size = 40 }: { state: ReferralState; size?: number }) {
  if (state === 'active') {
    return (
      <View
        style={[
          styles.dotBase,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: BAR_GREEN },
        ]}
      />
    );
  }
  if (state === 'verified') {
    return (
      <View
        style={[
          styles.dotBase,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: '#94A3B8' },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.dotBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: '#CBD5E1',
        },
      ]}
    />
  );
}

export default function Referrals() {
  const { userData } = useUser();
  const { level1Referrals, isLoading, error, refetch } = useReferrals(userData?.id);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<StarBanner | null>(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot the latest referrals list in a ref so the realtime callback can
  // resolve invitee names without forcing the subscription to be torn down on
  // every refetch.
  const referralsRef = useRef<Level1Referral[]>([]);
  useEffect(() => {
    referralsRef.current = level1Referrals;
  }, [level1Referrals]);

  const showBanner = (b: StarBanner) => {
    setBanner(b);
    Animated.timing(bannerOpacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setBanner(null));
    }, BANNER_DURATION_MS);
  };

  // Realtime subscription to star awards triggered by referral qualifications.
  // The on_submission_approved trigger writes three reasons we care about:
  //   l1_referral_self_bonus  → +100 to the invitee themselves (1st approval)
  //   l1_referral             → +100 to their direct inviter
  //   l2_referral             → +50  to the inviter's inviter (grandparent)
  // For l1/l2_referral rows targeting *us*, source_referral_user_id is the
  // invitee whose first approval triggered the chain.
  useEffect(() => {
    if (!userData?.id) return;

    const lookupInviteeName = (inviteeId: string | null | undefined): string | null => {
      if (!inviteeId) return null;
      for (const l1 of referralsRef.current) {
        if (l1.referral.user_id === inviteeId) {
          return l1.referral.full_name || l1.referral.username || null;
        }
        for (const l2 of l1.level2Referrals) {
          if (l2.user_id === inviteeId) {
            return l2.full_name || l2.username || null;
          }
        }
      }
      return null;
    };

    const channel = supabase
      .channel(`referral_banner:${userData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'star_ledger',
          filter: `user_id=eq.${userData.id}`,
        },
        (payload) => {
          const row = payload.new as {
            reason?: string;
            delta_stars?: number;
            source_referral_user_id?: string | null;
          };
          const stars = row.delta_stars ?? 0;
          if (row.reason === 'l1_referral_self_bonus') {
            showBanner({ kind: 'self_bonus', stars, inviteeName: null });
          } else if (row.reason === 'l1_referral') {
            showBanner({
              kind: 'l1',
              stars,
              inviteeName: lookupInviteeName(row.source_referral_user_id),
            });
          } else if (row.reason === 'l2_referral') {
            showBanner({
              kind: 'l2',
              stars,
              inviteeName: lookupInviteeName(row.source_referral_user_id),
            });
          }
        }
      )
      // Refresh the referral list when a member transitions state.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          refetch(true);
        }
      )
      .subscribe();

    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userData?.id, refetch]);

  const toggleCard = (userId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BAR_GREEN} />
          <Text style={styles.loadingText}>Loading referrals...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  if (level1Referrals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyIconContainer}>
            <UserPlus size={64} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No Friends Referred Yet</Text>
          <Text style={styles.emptyDescription}>
            Start inviting your friends to join Wegood4u and see them appear here!
          </Text>
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              💡 Go to the &quot;Invite Friends&quot; tab to share your referral code
            </Text>
          </View>
        </View>
        {renderBanner(banner, bannerOpacity)}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Referrals</Text>

        {level1Referrals.map(({ referral, level2Referrals }) => {
          const isExpanded = expandedCards.has(referral.user_id);
          const hasLevel2 = level2Referrals.length > 0;
          const state = referral.referral_state;
          const displayName =
            state === 'registered'
              ? 'Pending member'
              : truncateName(referral.full_name || referral.username);

          return (
            <View key={referral.user_id} style={styles.referralCard}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => hasLevel2 && toggleCard(referral.user_id)}
                disabled={!hasLevel2}
              >
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.dotSlot}>
                    <StateDot state={state} size={40} />
                  </View>
                  <Text
                    style={[
                      styles.referralName,
                      state === 'registered' && styles.pendingName,
                    ]}
                  >
                    {displayName}
                  </Text>
                </View>
                {hasLevel2 &&
                  (isExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  ))}
              </TouchableOpacity>

              {isExpanded && hasLevel2 && (
                <View style={styles.level2Container}>
                  {level2Referrals.map((l2) => {
                    const l2State = l2.referral_state;
                    const l2Name =
                      l2State === 'registered'
                        ? 'Pending member'
                        : truncateName(l2.full_name || l2.username);
                    return (
                      <View key={l2.user_id} style={styles.level2Item}>
                        <View style={styles.dotSlotSmall}>
                          <StateDot state={l2State} size={28} />
                        </View>
                        <Text
                          style={[
                            styles.level2Name,
                            l2State === 'registered' && styles.pendingName,
                          ]}
                        >
                          {l2Name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      {renderBanner(banner, bannerOpacity)}
    </View>
  );
}

function renderBanner(banner: StarBanner | null, opacity: Animated.Value) {
  if (!banner) return null;
  let label: string;
  if (banner.kind === 'self_bonus') {
    label = `+${banner.stars} ★ for your first approval!`;
  } else if (banner.inviteeName) {
    label = `+${banner.stars} ★ from ${truncateName(banner.inviteeName, 24)}`;
  } else {
    label = `+${banner.stars} ★ from a referral`;
  }
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { opacity }]}>
      <Star size={18} color="#FFFFFF" fill="#FFFFFF" />
      <Text style={styles.bannerText}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  emptyStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyHint: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  emptyHintText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  referralCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dotSlot: {
    marginRight: 12,
  },
  dotSlotSmall: {
    marginRight: 12,
  },
  dotBase: {
    // Common base; per-state styles applied inline.
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  pendingName: {
    color: '#94A3B8',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  level2Container: {
    marginTop: 12,
    paddingLeft: 24,
  },
  level2Item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  level2Name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    flex: 1,
  },

  // Realtime banner
  banner: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: STAR_GOLD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
