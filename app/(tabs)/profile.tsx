import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Menu, Share2, Camera, SquareCheckBig, Trophy, SquareLibrary, Clock, ChevronRight, RefreshCw } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useUserSubmissions , usePendingSubmissions } from '@/hooks/useSubmissions';

import { uploadProfileImage, updateUserAvatar } from '@/services/imageUpload'
import { router } from 'expo-router';
import SettingsOverlay from '@/app/profile/SettingsOverlay';

export default function ProfileScreen() {
  const { userData, isLoading: userLoading, refreshUserData } = useUser();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  
  // Get user submissions data for members/affiliates
  const {
    approvedCounts,
    stats,
    isLoading: isLoadingSubmissions
  } = useUserSubmissions(userData?.id || '');

  // Get pending submissions for admin
  const {
    pendingSubmissions,
    isLoading: isLoadingPending
  } = usePendingSubmissions();

  // Show loading state
  if (userLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#F33F32" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if no user data
  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load profile data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshUserData}>
            <RefreshCw size={16} color="#F33F32" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pickProfileImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8, // Compress for better upload performance
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        
        const imageUri = result.assets[0].uri;
        
        // Upload image to Supabase storage
        const uploadResult = await uploadProfileImage(userData.id, imageUri);
        
        if (!uploadResult.success) {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload image');
          return;
        }

        // Update user avatar in database
        const updateResult = await updateUserAvatar(userData.id, uploadResult.url!);
        
        if (!updateResult.success) {
          Alert.alert('Update Failed', updateResult.error || 'Failed to update profile');
          return;
        }

        // Refresh user data to show new avatar
        await refreshUserData();
        
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating your profile picture.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const shareProfile = () => {
    Alert.alert('Share Profile', 'Share your profile with friends!');
  };


  const handleBecomeMember = () => {
    router.push('/tasks');
  };



  const getGreeting = () => {
    if (userData.role === 'admin') {
      return 'Welcome Admin';
    }
    return userData.fullName || userData.username || 'User';
  };

  const calculateBadgeCount = () => {
    // Calculate badges based on approved submissions
    let badgeCount = 0;
    const milestones = [1, 5, 10, 25, 50]; // Badge milestones
    
    // Count activity badges
    badgeCount += milestones.filter(milestone => approvedCounts.total >= milestone).length;
    // Count cafe badges  
    badgeCount += milestones.filter(milestone => approvedCounts.cafe >= milestone).length;
    // Count restaurant badges
    badgeCount += milestones.filter(milestone => approvedCounts.restaurant >= milestone).length;
    
    return badgeCount;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {/* Profile Menu Setting */}
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowSettingsOverlay(true)}>
            <Menu size={24} color="#1e293b" />
          </TouchableOpacity>
          {/* Invitation Friend Button */}
          <TouchableOpacity style={styles.shareButton} onPress={shareProfile}>
            <Share2 size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer} 
            onPress={pickProfileImage}
            disabled={isUploadingImage}
          >
            <Image 
              source={{ 
                uri: userData.avatarUrl || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400' 
              }} 
              style={styles.profileImage} 
            />
            <View style={[styles.cameraIcon, isUploadingImage && styles.cameraIconLoading]}>
              {isUploadingImage ? (
                <ActivityIndicator size={16} color="white" />
              ) : (
                <Camera size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.userInfoContainer}>
            <Text style={styles.userName}>{getGreeting()}</Text>
            <Text style={styles.userEmail}>{userData.email}</Text>
          </View>
        </View>

        {/* Role-based Content */}
        {userData.role === 'subscriber' ? (
          // Subscriber: Show "Become a Member" button
          <View style={styles.section}>
            <TouchableOpacity style={styles.becomeMemberButton} onPress={handleBecomeMember}>
              <Text style={styles.becomeMemberText}>Become a Member</Text>
              <ChevronRight size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : userData.role === 'admin' ? (
          // Admin: Show only pending submissions count
          <View style={styles.section}>
            <View style={styles.adminStatsContainer}>
              <View style={styles.adminStatItem}>
                <Clock size={32} color="#F59E0B" />
                <Text style={styles.adminStatNumber}>
                  {isLoadingPending ? '...' : pendingSubmissions.length}
                </Text>
                <Text style={styles.adminStatLabel}>Pending Submissions</Text>
              </View>
            </View>
          </View>
        ) : (
          // Member & Affiliate: Show full stats section
          <View style={styles.section}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <SquareCheckBig size={20} color="#22C55E" />
                <Text style={styles.statNumber}>
                  {isLoadingSubmissions ? '...' : stats.approved}
                </Text>
                <Text style={styles.statLabel}>Task Done</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Trophy size={20} color="#F59E0B" />
                <Text style={styles.statNumber}>
                  {isLoadingSubmissions ? '...' : calculateBadgeCount()}
                </Text>
                <Text style={styles.statLabel}>Badges</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <SquareLibrary size={20} color="#64748B" />
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Collection</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Settings Overlay */}
      <SettingsOverlay
        visible={showSettingsOverlay}
        onClose={() => setShowSettingsOverlay(false)}
        userData={userData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
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
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  menuButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    gap: 24,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#e2e8f0',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#206E56',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconLoading: {
    backgroundColor: '#64748B',
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
  },
  pointBalanceContainer: {
    backgroundColor: '#206E56',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  pointBalanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointBalanceIcon: {
    fontSize: 20,
  },
  pointBalanceNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  pointBalanceLabel: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  becomeMemberButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#206E56',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 12,
  },
  becomeMemberText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  adminStatsContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  adminStatItem: {
    alignItems: 'center',
  },
  adminStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginTop: 8,
    marginBottom: 8,
  },
  adminStatLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  illustrationImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});