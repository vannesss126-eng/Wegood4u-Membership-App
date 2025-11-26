import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Users } from 'lucide-react-native';
import InviteFriends from './invite-friends';
import Referrals from './referrals';

export default function InviteFriendsPage() {
  const [activeTab, setActiveTab] = useState<'invite' | 'referrals'>('invite');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invite' && styles.activeTab]}
          onPress={() => setActiveTab('invite')}
        >
          <UserPlus size={20} color={activeTab === 'invite' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'invite' && styles.activeTabText]}>
            Invite Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'referrals' && styles.activeTab]}
          onPress={() => setActiveTab('referrals')}
        >
          <Users size={20} color={activeTab === 'referrals' ? '#206E56' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'referrals' && styles.activeTabText]}>
            Referrals
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'invite' ? <InviteFriends /> : <Referrals />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 5,
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
