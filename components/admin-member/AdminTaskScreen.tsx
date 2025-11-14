import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck as CheckCircle, Circle as XCircle, Clock, User, Calendar, Store, Eye, RefreshCw } from 'lucide-react-native';
import { usePendingSubmissions } from '@/hooks/useSubmissions';

interface AdminTaskScreenProps {
  userData: any;
}

export default function AdminTaskScreen({ userData }: AdminTaskScreenProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Use the custom hook for pending submissions
  const {
    pendingSubmissions,
    isLoading,
    refetch,
    updateSubmissionStatus
  } = usePendingSubmissions();

  // Handle approve submission
  const handleApprove = (submission: any) => {
    Alert.alert(
      'Approve Submission',
      `Are you sure you want to approve this submission from ${submission.profiles?.username || 'Unknown User'} at ${submission.partner_store_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            const success = await updateSubmissionStatus(submission.id, 'approved', userData.id);
            if (success) {
              Alert.alert('Success', 'Submission approved successfully!');
            }
          }
        }
      ]
    );
  };

  // Handle reject submission
  const handleReject = (submission: any) => {
    Alert.alert(
      'Reject Submission',
      `Are you sure you want to reject this submission from ${submission.profiles?.username || 'Unknown User'} at ${submission.partner_store_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const success = await updateSubmissionStatus(submission.id, 'rejected', userData.id, 'Rejected by admin');
            if (success) {
              Alert.alert('Success', 'Submission rejected successfully!');
            }
          }
        }
      ]
    );
  };

  // View image in modal
  const viewImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cafe':
        return '#F59E0B';
      case 'restaurant':
        return '#EF4444';
      default:
        return '#8B5CF6';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <RefreshCw size={32} color="#F33F32" />
          <Text style={styles.loadingText}>Loading pending submissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Clock size={20} color="#E5C69E" />
            <Text style={styles.statNumber}>{pendingSubmissions.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetch(true)}
            colors={['#F33F32']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {pendingSubmissions.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyDescription}>
              No pending submissions to review at the moment.
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => refetch(true)}
            >
              <RefreshCw size={16} color="#206E56" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.submissionsList}>
            {pendingSubmissions.map((submission) => (
              <View key={submission.id} style={styles.submissionCard}>
                {/* Header */}
                <View style={styles.submissionHeader}>
                  <View style={styles.userInfo}>
                    <User size={16} color="#64748B" />
                    <Text style={styles.username}>
                      {submission.profiles?.full_name || submission.profiles?.username || 'Unknown User'}
                    </Text>
                  </View>
                  <View style={styles.submissionDate}>
                    <Calendar size={14} color="#94A3B8" />
                    <Text style={styles.dateText}>
                      {formatDate(submission.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Store Info */}
                <View style={styles.storeInfo}>
                  <Store size={18} color="#1E293B" />
                  <View style={styles.storeDetails}>
                    <Text style={styles.storeName}>{submission.partner_store_name}</Text>
                    <View style={[
                      styles.categoryBadge, 
                      { backgroundColor: `${getCategoryColor(submission.partner_store_category)}20` }
                    ]}>
                      <Text style={[
                        styles.categoryText,
                        { color: getCategoryColor(submission.partner_store_category) }
                      ]}>
                        {submission.partner_store_category}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Images */}
                <View style={styles.imagesSection}>
                  <Text style={styles.sectionTitle}>Submitted Photos</Text>
                  <View style={styles.imagesRow}>
                    <View style={styles.imageContainer}>
                      <Text style={styles.imageLabel}>Receipt</Text>
                      <TouchableOpacity 
                        style={styles.imageWrapper}
                        onPress={() => viewImage(submission.receipt_url)}
                      >
                        <Image 
                          source={{ uri: submission.receipt_url }} 
                          style={styles.submissionImage}
                        />
                        <View style={styles.imageOverlay}>
                          <Eye size={16} color="white" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.imageContainer}>
                      <Text style={styles.imageLabel}>Selfie</Text>
                      <TouchableOpacity 
                        style={styles.imageWrapper}
                        onPress={() => viewImage(submission.selfie_url)}
                      >
                        <Image 
                          source={{ uri: submission.selfie_url }} 
                          style={styles.submissionImage}
                        />
                        <View style={styles.imageOverlay}>
                          <Eye size={16} color="white" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(submission)}
                  >
                    <XCircle size={18} color="white" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApprove(submission)}
                  >
                    <CheckCircle size={18} color="white" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalClose}
            onPress={() => setImageModalVisible(false)}
          >
            <XCircle size={32} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  headerStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5C69E',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CBEED2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#206E56',
    gap: 8,
  },
  refreshButtonText: {
    color: '#206E56',
    fontSize: 14,
    fontWeight: '600',
  },
  submissionsList: {
    padding: 20,
    gap: 16,
  },
  submissionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  submissionDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  imagesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  imageContainer: {
    flex: 1,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  submissionImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },
});