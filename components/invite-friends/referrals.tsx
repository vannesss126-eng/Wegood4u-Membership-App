import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { UserPlus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useReferrals } from '@/hooks/useReferrals';

// Utility function to truncate text to ~30 characters
const truncateName = (name: string | null | undefined, maxLength: number = 30): string => {
  if (!name) return 'Unknown User';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength).trim() + '...';
};

export default function Referrals() {
  const { userData } = useUser();
  const { level1Referrals, isLoading, error } = useReferrals(userData?.id);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (userId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.loadingText}>Loading referrals...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  // Empty state
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
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Your Referrals</Text>
      
      {level1Referrals.map(({ referral, level2Referrals }) => {
        const isExpanded = expandedCards.has(referral.user_id);
        const hasLevel2 = level2Referrals.length > 0;
        const displayName = truncateName(referral.full_name || referral.username);

        return (
          <View key={referral.user_id} style={styles.referralCard}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => hasLevel2 && toggleCard(referral.user_id)}
              disabled={!hasLevel2}
            >
              <View style={styles.cardHeaderLeft}>
                <View style={styles.greenCircle} />
                <Text style={styles.referralName}>{displayName}</Text>
              </View>
              {hasLevel2 && (
                isExpanded ? (
                  <ChevronUp size={20} color="#64748b" />
                ) : (
                  <ChevronDown size={20} color="#64748b" />
                )
              )}
            </TouchableOpacity>

            {isExpanded && hasLevel2 && (
              <View style={styles.level2Container}>
                {level2Referrals.map((level2Referral) => {
                  const level2DisplayName = truncateName(level2Referral.full_name || level2Referral.username);
                  return (
                    <View key={level2Referral.user_id} style={styles.level2Item}>
                      <View style={styles.greenCircle} />
                      <Text style={styles.level2Name}>{level2DisplayName}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
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
  greenCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#206E56',
    marginRight: 12,
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
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
});
