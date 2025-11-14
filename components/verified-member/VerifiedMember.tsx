import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Upload, Gift } from 'lucide-react-native';
import Submission from './submission';
import Badges from './badges';
import { useUserSubmissions } from '@/hooks/useSubmissions';
import type { PartnerStore } from '@/types';

interface VerifiedMemberProps {
  userData: any;
  selectedStore: PartnerStore | null;
  setSelectedStore: (store: PartnerStore | null) => void;
  setShowStoreDropdown: (show: boolean) => void;
  partnerStores: PartnerStore[];
}

export default function VerifiedMember({
  userData,
  selectedStore,
  setSelectedStore,
  setShowStoreDropdown,
  partnerStores
}: VerifiedMemberProps) {
  const [activeTab, setActiveTab] = useState<'submit' | 'rewards'>('submit');
  // Removed insets usage

  // Use the custom hook for fetching user submissions
  const {
    submissions,
    approvedCounts,
    stats,
    isLoading: isLoadingSubmissions,
    refetch: fetchSubmissions
  } = useUserSubmissions(userData?.id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Travel Proof</Text>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'submit' && styles.activeTab]}
          onPress={() => setActiveTab('submit')}
        >
          <Upload size={20} color={activeTab === 'submit' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'submit' && styles.activeTabText]}>
            Submit Proof
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'rewards' && styles.activeTab]}
          onPress={() => setActiveTab('rewards')}
        >
          <Gift size={20} color={activeTab === 'rewards' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
            View Rewards
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'submit' ? (
          <Submission
            userData={userData}
            selectedStore={selectedStore}
            setSelectedStore={setSelectedStore}
            setShowStoreDropdown={setShowStoreDropdown}
            partnerStores={partnerStores}
            submissions={submissions}
            isLoadingSubmissions={isLoadingSubmissions}
            fetchSubmissions={fetchSubmissions}
          />
        ) : (
          <Badges
            userData={userData}
            submissions={submissions}
            approvedCounts={approvedCounts}
            isLoadingSubmissions={isLoadingSubmissions}
            fetchSubmissions={fetchSubmissions}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#206E56',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#CBEED2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#206E56',
  },
  content: {
    flex: 1,
  },
});