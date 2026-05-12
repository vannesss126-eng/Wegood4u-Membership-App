import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList, Upload, Ticket } from 'lucide-react-native';
import Submission from './submission';
import Rewards from './rewards';
import MyTasks from './my-tasks';
import { useUserSubmissions } from '@/hooks/useSubmissions';
import { useStarWallet } from '@/hooks/useStarWallet';
import StarWalletPill from './my-tasks/StarWalletPill';
import type { PartnerStore } from '@/types';

interface VerifiedMemberProps {
  userData: any;
  selectedStore: PartnerStore | null;
  setSelectedStore: (store: PartnerStore | null) => void;
  setShowStoreDropdown: (show: boolean) => void;
  partnerStores: PartnerStore[];
}

type TabKey = 'my-tasks' | 'submit' | 'rewards';

export default function VerifiedMember({
  userData,
  selectedStore,
  setSelectedStore,
  setShowStoreDropdown,
  partnerStores
}: VerifiedMemberProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('my-tasks');

  const { refetch: fetchSubmissions } = useUserSubmissions(userData?.id);
  const { balance: starBalance } = useStarWallet(userData?.id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Tasks</Text>
        <StarWalletPill balance={starBalance} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-tasks' && styles.activeTab]}
          onPress={() => setActiveTab('my-tasks')}
        >
          <ClipboardList size={18} color={activeTab === 'my-tasks' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'my-tasks' && styles.activeTabText]}>
            My Tasks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'submit' && styles.activeTab]}
          onPress={() => setActiveTab('submit')}
        >
          <Upload size={18} color={activeTab === 'submit' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'submit' && styles.activeTabText]}>
            Submit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'rewards' && styles.activeTab]}
          onPress={() => setActiveTab('rewards')}
        >
          <Ticket size={18} color={activeTab === 'rewards' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
            Rewards
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'my-tasks' && (
          <MyTasks userData={userData} />
        )}
        {activeTab === 'submit' && (
          <Submission
            userData={userData}
            selectedStore={selectedStore}
            setSelectedStore={setSelectedStore}
            setShowStoreDropdown={setShowStoreDropdown}
            partnerStores={partnerStores}
            fetchSubmissions={fetchSubmissions}
            onSubmitSuccess={() => setActiveTab('my-tasks')}
          />
        )}
        {activeTab === 'rewards' && (
          <Rewards />
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
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0E1410',
    letterSpacing: -0.4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
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
