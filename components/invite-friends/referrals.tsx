import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserPlus } from 'lucide-react-native';

export default function Referrals() {
  const hasReferrals = false;

  if (!hasReferrals) {
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
    <View style={styles.container}>
      <Text style={styles.title}>Your Referrals</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
});
