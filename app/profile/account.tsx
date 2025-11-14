import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Mail, Calendar, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';

export default function AccountProfileScreen() {
  const { userData, isLoading, error, refreshUserData } = useUser();

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (err) {
      console.error('Date formatting error:', err);
      return 'Invalid date';
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshUserData();
    } catch (err: any) {
      console.error('Refresh error:', err);
      Alert.alert('Error', err?.message || 'Failed to refresh user data. Please try again.');
    }
  };

  const renderInfoItem = (icon: React.ReactNode, label: string, value: string | null | undefined) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIcon}>
        {icon}
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not set'}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Profile</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <RefreshCw size={20} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personal Information Section */}
        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          {renderInfoItem(
            <User size={20} color="#64748B" />,
            'Full Name',
            userData?.fullName
          )}
          
          {renderInfoItem(
            <User size={20} color="#64748B" />,
            'Username',
            userData?.username
          )}
          
          {renderInfoItem(
            <Mail size={20} color="#64748B" />,
            'Email Address',
            userData?.email
          )}
          
          {renderInfoItem(
            <Calendar size={20} color="#64748B" />,
            'Date of Birth',
            userData?.dob ? formatDate(userData.dob) : 'Not set'
          )}
          
          {renderInfoItem(
            <User size={20} color="#64748B" />,
            'Gender',
            userData?.gender
          )}
        </View>

        {/* Account Status Section */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Role</Text>
            <View style={[styles.statusBadge, styles.roleBadge]}>
              <Text style={styles.statusBadgeText}>
                {userData?.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Unknown'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Email Status</Text>
            <View style={[
              styles.statusBadge,
              userData?.emailConfirmedAt ? styles.verifiedBadge : styles.unverifiedBadge
            ]}>
              <Text style={[
                styles.statusBadgeText,
                userData?.emailConfirmedAt ? styles.verifiedText : styles.unverifiedText
              ]}>
                {userData?.emailConfirmedAt ? 'Verified' : 'Unverified'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Verification Status</Text>
            <View style={[
              styles.statusBadge,
              userData?.verificationCompleted ? styles.verifiedBadge : styles.unverifiedBadge
            ]}>
              <Text style={[
                styles.statusBadgeText,
                userData?.verificationCompleted ? styles.verifiedText : styles.unverifiedText
              ]}>
                {userData?.verificationCompleted ? 'Completed' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Debug Information (remove in production)
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.sectionTitle}>Debug Info</Text>
            <Text style={styles.debugText}>
              {JSON.stringify(userData, null, 2)}
            </Text>
          </View>
        )}
        */}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 16,
    flex: 1,
  },
  refreshButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accountSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debugSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadge: {
    backgroundColor: '#f0f9ff',
  },
  verifiedBadge: {
    backgroundColor: '#f0fdf4',
  },
  unverifiedBadge: {
    backgroundColor: '#fef2f2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#3b82f6',
  },
  verifiedText: {
    color: '#22C55E',
  },
  unverifiedText: {
    color: '#EF4444',
  },
  pendingText: {
    color: '#F59E0B',
  },
  rejectedText: {
    color: '#EF4444',
  },
});