import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Camera, ChevronDown, CircleCheck as CheckCircle, Clock, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TransformedSubmission, PartnerStore, Submission } from '@/types';

interface SubmissionProps {
  userData: any;
  selectedStore: PartnerStore | null;
  setSelectedStore: (store: PartnerStore | null) => void;
  setShowStoreDropdown: (show: boolean) => void;
  partnerStores: PartnerStore[];
  submissions: TransformedSubmission[];
  isLoadingSubmissions: boolean;
  fetchSubmissions: (showRefreshIndicator?: boolean) => Promise<void>;
}

export default function SubmissionComponent({ 
  userData, 
  selectedStore, 
  setSelectedStore, 
  setShowStoreDropdown,
  partnerStores,
  submissions,
  isLoadingSubmissions,
  fetchSubmissions
}: SubmissionProps) {
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to map partner store category
  const mapStoreCategory = (storeType: string): string => {
    const normalizedType = storeType.toLowerCase();
    
    if (normalizedType.includes('restaurant')) {
      return 'restaurant';
    } else if (normalizedType.includes('coffee') || normalizedType.includes('dessert')) {
      return 'cafe';
    } else {
      // Beverages and any other category
      return 'others';
    }
  };

  const pickImage = async (type: 'receipt' | 'selfie') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'receipt' ? [4, 3] : [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'receipt') {
        setReceiptPhoto(result.assets[0].uri);
      } else {
        setSelfiePhoto(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async (type: 'receipt' | 'selfie') => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: type === 'receipt' ? [4, 3] : [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'receipt') {
        setReceiptPhoto(result.assets[0].uri);
      } else {
        setSelfiePhoto(result.assets[0].uri);
      }
    }
  };

  const showImagePicker = (type: 'receipt' | 'selfie') => {
    Alert.alert(
      'Select Photo',
      'Choose how you want to add your photo',
      [
        { text: 'Camera', onPress: () => takePhoto(type) },
        { text: 'Gallery', onPress: () => pickImage(type) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Function to upload image to Supabase storage
  const uploadImageToSupabase = async (imageUri: string, bucketName: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Infer content type from response headers if available, fallback to jpeg
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, uint8Array, {
            contentType,
            upsert: false,
      });

      if (error || !data) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload image: ${error?.message ?? 'unknown'}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const submitProof = async () => {
    if (!selectedStore) {
      Alert.alert('Error', 'Please select a partner store');
      return;
    }
    if (!receiptPhoto) {
      Alert.alert('Error', 'Please upload your receipt photo');
      return;
    }
    if (!selfiePhoto) {
      Alert.alert('Error', 'Please upload your selfie photo');
      return;
    }
    if (!userData?.id) {
      Alert.alert('Error', 'User not found. Please try again.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Generate unique file names
      const timestamp = Date.now();
      const receiptFileName = `receipt_${userData.id}_${timestamp}.jpg`;
      const selfieFileName = `selfie_${userData.id}_${timestamp}.jpg`;

      console.log('Starting image uploads...');
      
      // Upload both images concurrently
      const [receiptUrl, selfieUrl] = await Promise.all([
        uploadImageToSupabase(receiptPhoto, 'submitted-receipt', receiptFileName),
        uploadImageToSupabase(selfiePhoto, 'submitted-selfie', selfieFileName)
      ]);

      console.log('Images uploaded successfully:', { receiptUrl, selfieUrl });

      // Map the store category according to the requirements
      const mappedCategory = mapStoreCategory(selectedStore.type);

      // Prepare submission data
      const submissionData = {
        user_id: userData.id,
        partner_store_name: selectedStore.name,
        partner_store_category: mappedCategory, // Use the mapped category
        status: 'pending' as const,
        selfie_url: selfieUrl,
        receipt_url: receiptUrl
      };

      console.log('Inserting submission data:', submissionData);

      // Insert submission into database
      const { data, error } = await supabase
        .from('submissions')
        .insert([submissionData])
        .select()
        .single();

      if (error) {
        console.error('Database insertion error:', error);
        throw new Error(`Failed to save submission: ${error.message}`);
      }

      console.log('Submission saved successfully:', data);

      // Show success message
      Alert.alert(
        'Success!', 
        'Your proof of travel has been submitted successfully. You will be notified once it\'s reviewed.',
        [
          { 
            text: 'OK', 
            onPress: async () => {
              // Reset form
              setSelectedStore(null);
              setReceiptPhoto(null);
              setSelfiePhoto(null);
              // Refresh submissions list
              await fetchSubmissions();
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Submission error:', error);
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to submit proof of travel. Please try again.';
      Alert.alert('Error', errorMessage);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: Submission['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={12} color="#22C55E" />;
      case 'rejected':
        return <X size={12} color="#EF4444" />;
      default:
        return <Clock size={12} color="#F59E0B" />;
    }
  };

  const getStatusBadgeStyle = (status: Submission['status']) => {
    switch (status) {
      case 'approved':
        return styles.approvedBadge;
      case 'rejected':
        return styles.rejectedBadge;
      default:
        return styles.pendingBadge;
    }
  };

  const getStatusTextStyle = (status: Submission['status']) => {
    switch (status) {
      case 'approved':
        return styles.approvedText;
      case 'rejected':
        return styles.rejectedText;
      default:
        return styles.pendingText;
    }
  };

  const getStatusText = (status: Submission['status']) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  return (
    <View style={styles.submitContainer}>
      {/* Partner Store Selection */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Select Partner Store</Text>
        <TouchableOpacity
          style={styles.storeSelector}
          onPress={() => setShowStoreDropdown(true)}
        >
          <Text style={[styles.storeSelectorText, !selectedStore && styles.placeholderText]}>
            {selectedStore ? `${selectedStore.name} (${selectedStore.city})` : 'Choose a partner store'}
          </Text>
          <ChevronDown size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Receipt Photo Upload */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Receipt Photo</Text>
        <TouchableOpacity
          style={styles.photoUpload}
          onPress={() => showImagePicker('receipt')}
        >
          {receiptPhoto ? (
            <Image source={{ uri: receiptPhoto }} style={styles.uploadedPhoto} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Camera size={32} color="#64748B" />
              <Text style={styles.uploadPlaceholderText}>Upload Receipt</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Selfie Photo Upload */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Selfie at Restaurant</Text>
        <TouchableOpacity
          style={styles.photoUpload}
          onPress={() => showImagePicker('selfie')}
        >
          {selfiePhoto ? (
            <Image source={{ uri: selfiePhoto }} style={styles.uploadedPhoto} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Camera size={32} color="#64748B" />
              <Text style={styles.uploadPlaceholderText}>Upload Selfie</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={submitProof}
        disabled={isSubmitting}
      >
        <Upload size={20} color="white" />
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Submit Proof'}
        </Text>
      </TouchableOpacity>

      {/* Submissions Table */}
      <View style={styles.tableSection}>
        <View style={styles.tableTitleContainer}>
          <Text style={styles.tableTitle}>Your Submissions</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => fetchSubmissions(true)}
            disabled={isLoadingSubmissions}
          >
            <Upload 
              size={18} 
              color="#64748B" 
              style={[isLoadingSubmissions && { opacity: 0.5 }]}
            />
          </TouchableOpacity>
        </View>
        
        {submissions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {isLoadingSubmissions ? 'Loading submissions...' : 'No submissions yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {!isLoadingSubmissions && 'Submit your first proof of travel above!'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.dateColumn]}>Date</Text>
                <Text style={[styles.tableHeaderText, styles.restaurantColumn]}>Restaurant</Text>
                <Text style={[styles.tableHeaderText, styles.categoryColumn]}>Category</Text>
                <Text style={[styles.tableHeaderText, styles.photoColumn]}>Receipt</Text>
                <Text style={[styles.tableHeaderText, styles.photoColumn]}>Selfie</Text>
                <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
              </View>

              {/* Table Rows */}
              {submissions.map((submission) => (
                <View key={submission.id} style={styles.tableRow}>
                  <Text style={[styles.tableCellText, styles.dateColumn]}>
                    {submission.submissionDate}
                  </Text>
                  <Text style={[styles.tableCellText, styles.restaurantColumn]} numberOfLines={2}>
                    {submission.restaurantName}
                  </Text>
                  <Text style={[styles.tableCellText, styles.categoryColumn]} numberOfLines={1}>
                    {submission.category}
                  </Text>
                  <View style={[styles.tableCell, styles.photoColumn]}>
                    {submission.receiptPhoto ? (
                      <Image source={{ uri: submission.receiptPhoto }} style={styles.tablePhoto} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderText}>No Image</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.tableCell, styles.photoColumn]}>
                    {submission.selfiePhoto ? (
                      <Image source={{ uri: submission.selfiePhoto }} style={styles.tablePhoto} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderText}>No Image</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.tableCell, styles.statusColumn]}>
                    <View style={[styles.statusBadge, getStatusBadgeStyle(submission.status)]}>
                      {getStatusIcon(submission.status)}
                      <Text style={[styles.statusText, getStatusTextStyle(submission.status)]}>
                        {getStatusText(submission.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  submitContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  storeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  storeSelectorText: {
    fontSize: 16,
    color: '#1e293b',
  },
  placeholderText: {
    color: '#64748b',
  },
  photoUpload: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  uploadedPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  uploadPlaceholderText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tableSection: {
    marginTop: 32,
  },
  tableTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#CBEED2',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  table: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 14,
    color: '#1e293b',
  },
  dateColumn: {
    width: 90,
  },
  restaurantColumn: {
    width: 120,
  },
  categoryColumn: {
    width: 80,
  },
  photoColumn: {
    width: 60,
  },
  statusColumn: {
    width: 80,
  },
  tablePhoto: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  photoPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  approvedBadge: {
    backgroundColor: '#f0fdf4',
  },
  pendingBadge: {
    backgroundColor: '#fefce8',
  },
  rejectedBadge: {
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  approvedText: {
    color: '#206E56',
  },
  pendingText: {
    color: '#E5C69E',
  },
  rejectedText: {
    color: '#EF4444',
  },
});