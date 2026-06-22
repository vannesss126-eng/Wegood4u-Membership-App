import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronDown, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { optimizeSubmissionImage } from '@/lib/optimizeSubmissionImage';
import type { PartnerStore } from '@/types';
import ShareEarnCard from '@/components/submission/ShareEarnCard';

interface SubmissionProps {
  userData: any;
  selectedStore: PartnerStore | null;
  setSelectedStore: (store: PartnerStore | null) => void;
  setShowStoreDropdown: (show: boolean) => void;
  partnerStores: PartnerStore[];
  fetchSubmissions: (showRefreshIndicator?: boolean) => Promise<void>;
  onSubmitSuccess?: () => void;
}

const BAR_GREEN = '#206E56';
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Date validation window: 6 months back, no future. The AI auto-review
// has a tighter 21-day window — older receipts go to manual review.
const MAX_BACK_DAYS = 180;

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function SubmissionComponent({
  userData,
  selectedStore,
  setSelectedStore,
  setShowStoreDropdown,
  partnerStores,
  fetchSubmissions,
  onSubmitSuccess,
}: SubmissionProps) {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const yearOptions = useMemo(
    () => [currentYear, currentYear - 1],
    [currentYear]
  );

  const [day, setDay] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null); // 0-indexed
  const [year, setYear] = useState<number | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState<'day' | 'month' | 'year' | null>(null);

  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const dayOptions = useMemo(() => {
    const m = month ?? today.getMonth();
    const y = year ?? today.getFullYear();
    const max = daysInMonth(y, m);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [month, year, today]);

  // Re-validate whenever any part of the date changes.
  useEffect(() => {
    if (day === null || month === null || year === null) {
      setDateError(null);
      return;
    }
    const picked = new Date(year, month, day);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (picked.getTime() > now.getTime()) {
      setDateError('Date cannot be in the future.');
      return;
    }
    const diffMs = today.getTime() - picked.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_BACK_DAYS) {
      setDateError('Date cannot be older than 6 months.');
      return;
    }
    setDateError(null);
  }, [day, month, year, today]);

  const mapStoreCategory = (storeType: string): string => {
    const normalizedType = storeType.toLowerCase();
    // Buffet partners (e.g. Thai Geng Mookata) live in the Restaurant category — the
    // "buffet" behaviour (2 points, diner cap) is a per-store flag, not a category.
    if (normalizedType.includes('restaurant') || normalizedType.includes('buffet')) {
      return 'restaurant';
    } else if (
      normalizedType.includes('coffee') ||
      normalizedType.includes('dessert') ||
      normalizedType.includes('cafe')
    ) {
      return 'cafe';
    } else if (
      normalizedType.includes('bar') ||
      normalizedType.includes('beverage') ||
      normalizedType.includes('pub')
    ) {
      return 'bar';
    } else if (
      normalizedType.includes('hotel') ||
      normalizedType.includes('resort') ||
      normalizedType.includes('accommodation')
    ) {
      return 'hotel';
    } else {
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

  const uploadImageToSupabase = async (
    imageUri: string,
    bucketName: string,
    fileName: string,
    contentType: string
  ): Promise<string> => {
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

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

    // Buckets are private — store the object PATH. Display (admin review) resolves
    // short-lived signed URLs; the AI review edge fn downloads via the service role.
    return data.path;
  };

  const resetForm = () => {
    setSelectedStore(null);
    setReceiptPhoto(null);
    setSelfiePhoto(null);
    setDay(null);
    setMonth(null);
    setYear(null);
    setDateError(null);
  };

  const submitProof = async () => {
    if (day === null || month === null || year === null) {
      Alert.alert('Error', 'Please select the date you visited.');
      return;
    }
    if (dateError) {
      Alert.alert('Invalid date', dateError);
      return;
    }
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
      const timestamp = Date.now();
      // Folder-prefixed by user id so the storage ownership RLS policy
      // ((storage.foldername(name))[1] = auth.uid()) applies on these private buckets.
      const receiptFileName = `${userData.id}/receipt_${timestamp}.webp`;
      const selfieFileName = `${userData.id}/selfie_${timestamp}.webp`;
      const webpType = 'image/webp';

      const [receiptOptimizedUri, selfieOptimizedUri] = await Promise.all([
        optimizeSubmissionImage(receiptPhoto),
        optimizeSubmissionImage(selfiePhoto),
      ]);

      const [receiptUrl, selfieUrl] = await Promise.all([
        uploadImageToSupabase(receiptOptimizedUri, 'submitted-receipt', receiptFileName, webpType),
        uploadImageToSupabase(selfieOptimizedUri, 'submitted-selfie', selfieFileName, webpType),
      ]);

      const mappedCategory = mapStoreCategory(selectedStore.type);
      const visitDateIso = `${year}-${pad2(month + 1)}-${pad2(day)}`;

      const submissionData = {
        user_id: userData.id,
        partner_store_id: selectedStore.id,
        partner_store_name: selectedStore.name,
        partner_store_category: mappedCategory,
        status: 'pending' as const,
        selfie_url: selfieUrl,
        receipt_url: receiptUrl,
        receipt_date: visitDateIso,
      };

      const { error } = await supabase
        .from('submissions')
        .insert([submissionData])
        .select()
        .single();

      if (error) {
        console.error('Database insertion error:', error);
        throw new Error(`Failed to save submission: ${error.message}`);
      }

      await fetchSubmissions();
      setShowSuccess(true);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.message || 'Failed to submit proof of travel. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissSuccess = () => {
    setShowSuccess(false);
    resetForm();
    onSubmitSuccess?.();
  };

  const renderPickerModal = () => {
    if (!pickerOpen) return null;

    let options: Array<{ value: number; label: string }> = [];
    let selected: number | null = null;
    let onPick: (v: number) => void = () => {};
    let title = '';

    if (pickerOpen === 'day') {
      options = dayOptions.map((d) => ({ value: d, label: String(d) }));
      selected = day;
      onPick = (v) => setDay(v);
      title = 'Select Day';
    } else if (pickerOpen === 'month') {
      options = MONTHS.map((m, i) => ({ value: i, label: m }));
      selected = month;
      onPick = (v) => {
        setMonth(v);
        // If the chosen day no longer exists in the new month, clamp it.
        if (day !== null) {
          const max = daysInMonth(year ?? today.getFullYear(), v);
          if (day > max) setDay(max);
        }
      };
      title = 'Select Month';
    } else if (pickerOpen === 'year') {
      options = yearOptions.map((y) => ({ value: y, label: String(y) }));
      selected = year;
      onPick = (v) => {
        setYear(v);
        if (day !== null && month !== null) {
          const max = daysInMonth(v, month);
          if (day > max) setDay(max);
        }
      };
      title = 'Select Year';
    }

    return (
      <Modal
        transparent
        animationType="fade"
        visible={pickerOpen !== null}
        onRequestClose={() => setPickerOpen(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerOpen(null)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selected === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                    onPress={() => {
                      onPick(item.value);
                      setPickerOpen(null);
                    }}
                  >
                    <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (showSuccess) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successIconCircle}>
          <CheckCircle2 size={72} color={BAR_GREEN} />
        </View>
        <Text style={styles.successTitle}>Proof Submitted!</Text>
        <Text style={styles.successBody}>
          Your proof has been submitted — credits will land once an admin approves your proof.
        </Text>
        <TouchableOpacity style={styles.successButton} onPress={dismissSuccess}>
          <Text style={styles.successButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.submitContainer}>
      {/* Share & earn entry — surfaces only when the user has approved trips */}
      <ShareEarnCard />

      {/* 1. Date Visit */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.numberBubble}>
            <Text style={styles.numberBubbleText}>1</Text>
          </View>
          <Text style={styles.cardTitle}>Date Visit</Text>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setPickerOpen('day')}
          >
            <Text style={[styles.dateFieldText, day === null && styles.placeholderText]}>
              {day !== null ? String(day) : 'Date'}
            </Text>
            <ChevronDown size={16} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setPickerOpen('month')}
          >
            <Text style={[styles.dateFieldText, month === null && styles.placeholderText]}>
              {month !== null ? MONTHS[month] : 'Month'}
            </Text>
            <ChevronDown size={16} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setPickerOpen('year')}
          >
            <Text style={[styles.dateFieldText, year === null && styles.placeholderText]}>
              {year !== null ? String(year) : 'Year'}
            </Text>
            <ChevronDown size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        {dateError && <Text style={styles.errorText}>{dateError}</Text>}
      </View>

      {/* 2. Select a Partner Store */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.numberBubble}>
            <Text style={styles.numberBubbleText}>2</Text>
          </View>
          <Text style={styles.cardTitle}>Select a Partner Store</Text>
        </View>
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

      {/* 3. Upload Receipt */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.numberBubble}>
            <Text style={styles.numberBubbleText}>3</Text>
          </View>
          <Text style={styles.cardTitle}>Upload Receipt</Text>
        </View>
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

      {/* 4. Upload Selfie */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.numberBubble}>
            <Text style={styles.numberBubbleText}>4</Text>
          </View>
          <Text style={styles.cardTitle}>Upload Selfie</Text>
        </View>
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

      {/* 5. Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={submitProof}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </Text>
      </TouchableOpacity>

      {renderPickerModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  submitContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  numberBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BAR_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubbleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateFieldText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },

  // Store selector
  storeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storeSelectorText: {
    fontSize: 15,
    color: '#0F172A',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Photo upload
  photoUpload: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadedPhoto: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  uploadPlaceholderText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Submit
  submitButton: {
    backgroundColor: BAR_GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  warningText: {
    fontSize: 13,
    color: '#F59E0B',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
  },

  // Picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerRowSelected: {
    backgroundColor: '#E6F4EE',
  },
  pickerRowText: {
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'center',
  },
  pickerRowTextSelected: {
    color: BAR_GREEN,
    fontWeight: '700',
  },

  // Success screen
  successWrap: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E6F4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  successButton: {
    alignSelf: 'stretch',
    backgroundColor: BAR_GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
