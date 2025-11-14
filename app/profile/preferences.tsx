import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import DropdownWithOthers from '@/components/DropdownWithOthers';
import type { UserPreferenceData } from '@/types';
import { countries } from '@/data/countries';

// Get countries with fallback
const getCountries = () => {
  if (countries && countries.length > 0) {
    return countries;
  }
  
  // Comprehensive fallback countries if import fails
  return [
    // Prioritized countries (Malaysia and Thailand first)
    { name: 'Malaysia', code: 'MY', phoneCode: '+60' },
    { name: 'Thailand', code: 'TH', phoneCode: '+66' },
    
    // Other Southeast Asian countries
    { name: 'Brunei', code: 'BN', phoneCode: '+673' },
    { name: 'Cambodia', code: 'KH', phoneCode: '+855' },
    { name: 'East Timor', code: 'TL', phoneCode: '+670' },
    { name: 'Indonesia', code: 'ID', phoneCode: '+62' },
    { name: 'Laos', code: 'LA', phoneCode: '+856' },
    { name: 'Myanmar', code: 'MM', phoneCode: '+95' },
    { name: 'Philippines', code: 'PH', phoneCode: '+63' },
    { name: 'Singapore', code: 'SG', phoneCode: '+65' },
    { name: 'Vietnam', code: 'VN', phoneCode: '+84' },
    
    // Major international countries
    { name: 'Argentina', code: 'AR', phoneCode: '+54' },
    { name: 'Australia', code: 'AU', phoneCode: '+61' },
    { name: 'Austria', code: 'AT', phoneCode: '+43' },
    { name: 'Bahrain', code: 'BH', phoneCode: '+973' },
    { name: 'Belgium', code: 'BE', phoneCode: '+32' },
    { name: 'Brazil', code: 'BR', phoneCode: '+55' },
    { name: 'Canada', code: 'CA', phoneCode: '+1' },
    { name: 'Chile', code: 'CL', phoneCode: '+56' },
    { name: 'China', code: 'CN', phoneCode: '+86' },
    { name: 'Colombia', code: 'CO', phoneCode: '+57' },
    { name: 'Denmark', code: 'DK', phoneCode: '+45' },
    { name: 'Egypt', code: 'EG', phoneCode: '+20' },
    { name: 'Fiji', code: 'FJ', phoneCode: '+679' },
    { name: 'Finland', code: 'FI', phoneCode: '+358' },
    { name: 'France', code: 'FR', phoneCode: '+33' },
    { name: 'Germany', code: 'DE', phoneCode: '+49' },
    { name: 'India', code: 'IN', phoneCode: '+91' },
    { name: 'Israel', code: 'IL', phoneCode: '+972' },
    { name: 'Italy', code: 'IT', phoneCode: '+39' },
    { name: 'Japan', code: 'JP', phoneCode: '+81' },
    { name: 'Jordan', code: 'JO', phoneCode: '+962' },
    { name: 'Kenya', code: 'KE', phoneCode: '+254' },
    { name: 'Kuwait', code: 'KW', phoneCode: '+965' },
    { name: 'Lebanon', code: 'LB', phoneCode: '+961' },
    { name: 'Mexico', code: 'MX', phoneCode: '+52' },
    { name: 'Morocco', code: 'MA', phoneCode: '+212' },
    { name: 'Netherlands', code: 'NL', phoneCode: '+31' },
    { name: 'New Zealand', code: 'NZ', phoneCode: '+64' },
    { name: 'Nigeria', code: 'NG', phoneCode: '+234' },
    { name: 'Norway', code: 'NO', phoneCode: '+47' },
    { name: 'Oman', code: 'OM', phoneCode: '+968' },
    { name: 'Papua New Guinea', code: 'PG', phoneCode: '+675' },
    { name: 'Peru', code: 'PE', phoneCode: '+51' },
    { name: 'Qatar', code: 'QA', phoneCode: '+974' },
    { name: 'Russia', code: 'RU', phoneCode: '+7' },
    { name: 'Saudi Arabia', code: 'SA', phoneCode: '+966' },
    { name: 'South Africa', code: 'ZA', phoneCode: '+27' },
    { name: 'South Korea', code: 'KR', phoneCode: '+82' },
    { name: 'Spain', code: 'ES', phoneCode: '+34' },
    { name: 'Sweden', code: 'SE', phoneCode: '+46' },
    { name: 'Switzerland', code: 'CH', phoneCode: '+41' },
    { name: 'Taiwan', code: 'TW', phoneCode: '+886' },
    { name: 'Turkey', code: 'TR', phoneCode: '+90' },
    { name: 'United Arab Emirates', code: 'AE', phoneCode: '+971' },
    { name: 'United Kingdom', code: 'GB', phoneCode: '+44' },
    { name: 'United States', code: 'US', phoneCode: '+1' },
  ];
};

export default function PreferencesScreen() {
  const { preferenceData, updatePreferences, isPreferenceLoading } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Filter countries based on search
  const filteredCountries = getCountries().filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );
  
  // Form state
  const [preferences, setPreferences] = useState<UserPreferenceData>({
    countryOfResidence: '',
    preferredCommunicationChannel: 'WhatsApp',
    communicationContactDetails: '',
    travelDestinationCategory: '',
    travelDestinationDetail: '',
    travelPreference: '',
    accommodationPreference: '',
    travelBudget: '',
  });

  const [originalPreferences, setOriginalPreferences] = useState<UserPreferenceData>({
    countryOfResidence: '',
    preferredCommunicationChannel: 'WhatsApp',
    communicationContactDetails: '',
    travelDestinationCategory: '',
    travelDestinationDetail: '',
    travelPreference: '',
    accommodationPreference: '',
    travelBudget: '',
  });

  const communicationChannels: ('WhatsApp' | 'Telegram' | 'Line' | 'WeChat')[] = ['WhatsApp', 'Telegram', 'Line', 'WeChat'];
  const travelDestinations = ['Beach Destinations', 'Cultural Destinations', 'Adventure Destinations', 'Urban Destinations'];
  const travelPreferenceOptions = ['Adventure Travel', 'Relaxation Travel', 'Cultural Travel', 'Family Travel', 'Solo Travel', 'Luxury Travel', 'Others'];
  const accommodationTypes = ['Hotels', 'Hostels', 'Vacation Rentals', 'Resorts', 'Bed and Breakfasts/Guesthouses', 'Alternative Accommodations', 'Others'];
  const budgetRanges = [
    'Budget Travel: $500 - $1,000',
    'Mid-range Travel: $1,000 - $3,000',
    'Luxury Travel: $3,000 - $10,000',
    'Ultra-Luxury Travel: $10,000 - $20,000',
    'Other (please specify)'
  ];

  useEffect(() => {
    if (preferenceData) {
      const loadedPreferences: UserPreferenceData = {
        countryOfResidence: preferenceData.countryOfResidence || '',
        preferredCommunicationChannel: preferenceData.preferredCommunicationChannel || 'WhatsApp',
        communicationContactDetails: preferenceData.communicationContactDetails || '',
        travelDestinationCategory: preferenceData.travelDestinationCategory || '',
        travelDestinationDetail: preferenceData.travelDestinationDetail || '',
        travelPreference: preferenceData.travelPreference || '',
        accommodationPreference: preferenceData.accommodationPreference || '',
        travelBudget: preferenceData.travelBudget || '',
      };
      
      setPreferences(loadedPreferences);
      setOriginalPreferences(loadedPreferences);
    }
  }, [preferenceData]);

  // Check for changes whenever preferences update
  useEffect(() => {
    const hasChangedValues = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
    setHasChanges(hasChangedValues);
  }, [preferences, originalPreferences]);

  const handleUpdatePreferences = async () => {
    setIsLoading(true);
    try {
      await updatePreferences(preferences);
      setOriginalPreferences(preferences); // Update original to match current
      setHasChanges(false);
      Alert.alert('Success', 'Your preferences have been updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
      console.error('Error updating preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = <K extends keyof UserPreferenceData>(
    key: K,
    value: UserPreferenceData[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const renderSimpleDropdown = (
    label: string,
    value: string,
    options: string[],
    onSelect: (value: string) => void
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.dropdownContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.dropdownOption,
              value === option && styles.selectedDropdownOption
            ]}
            onPress={() => onSelect(option)}
          >
            <Text style={[
              styles.dropdownOptionText,
              value === option && styles.selectedDropdownOptionText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (isPreferenceLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
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
        <Text style={styles.headerTitle}>Edit Preferences</Text>
        <TouchableOpacity 
          onPress={handleUpdatePreferences} 
          style={styles.saveButton} 
          disabled={isLoading || !hasChanges}
        >
          {isLoading ? (
            <ActivityIndicator size={20} color="#206E56" />
          ) : (
            <Save size={20} color={hasChanges ? "#206E56" : "#9CA3AF"} />
          )}
        </TouchableOpacity>
      </View>

      {hasChanges && (
        <View style={styles.changesIndicator}>
          <Text style={styles.changesText}>You have unsaved changes</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Country of Residence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country of Residence</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                console.log('Opening country modal');
                setCountrySearch(''); // Clear search when opening modal
                setShowCountryModal(true);
              }}
            >
              <Text style={styles.dropdownText}>
                {preferences.countryOfResidence || 'Select Country'}
              </Text>
              <ChevronDown size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Communication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          {renderSimpleDropdown(
            'Preferred Communication Channel',
            preferences.preferredCommunicationChannel || '',
            communicationChannels,
            (value) => updatePreference('preferredCommunicationChannel', value as any)
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Details</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your contact details"
              value={preferences.communicationContactDetails || ''}
              onChangeText={(text) => updatePreference('communicationContactDetails', text)}
            />
          </View>
        </View>

        {/* Travel Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Preferences</Text>
          {renderSimpleDropdown(
            'Travel Destination Category',
            preferences.travelDestinationCategory || '',
            travelDestinations,
            (value) => updatePreference('travelDestinationCategory', value)
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Specific Destination</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter specific destinations"
              value={preferences.travelDestinationDetail || ''}
              onChangeText={(text) => updatePreference('travelDestinationDetail', text)}
            />
          </View>
          
          <DropdownWithOthers
            label="Travel Style"
            value={preferences.travelPreference || ''}
            options={travelPreferenceOptions}
            onSelect={(value) => updatePreference('travelPreference', value)}
            placeholder="Enter your travel style"
          />
          
          <DropdownWithOthers
            label="Accommodation Preference"
            value={preferences.accommodationPreference || ''}
            options={accommodationTypes}
            onSelect={(value) => updatePreference('accommodationPreference', value)}
            placeholder="Enter your accommodation preference"
          />
          
          <DropdownWithOthers
            label="Travel Budget"
            value={preferences.travelBudget || ''}
            options={budgetRanges}
            onSelect={(value) => updatePreference('travelBudget', value)}
            placeholder="Enter your budget range"
          />
        </View>

        {/* Update Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.updateButton,
              (!hasChanges || isLoading) && styles.updateButtonDisabled
            ]}
            onPress={handleUpdatePreferences}
            disabled={!hasChanges || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size={24} color="white" />
            ) : (
              <>
                <Save size={20} color="white" />
                <Text style={styles.updateButtonText}>Update Preferences</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          console.log('Modal close requested');
          setShowCountryModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => {
                console.log('Modal Done button pressed');
                setShowCountryModal(false);
                setCountrySearch(''); // Clear search when closing
              }}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.countryList}>
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                renderItem={({ item: country, index }) => {
                  console.log(`Rendering country ${index + 1}:`, country.name);
                  return (
                    <TouchableOpacity
                      style={styles.countryOption}
                      onPress={() => {
                        console.log('Country selected:', country.name);
                        updatePreference('countryOfResidence', country.name);
                        setShowCountryModal(false);
                        setCountrySearch(''); // Clear search when selecting
                      }}
                    >
                      <Text style={styles.countryName}>{country.name}</Text>
                    </TouchableOpacity>
                  );
                }}
                showsVerticalScrollIndicator={true}
                style={{ flex: 1 }}
              />
            </View>
          </View>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    padding: 4,
  },
  changesIndicator: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },
  changesText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedDropdownOption: {
    backgroundColor: '#f0fdf4',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectedDropdownOptionText: {
    color: '#206E56',
    fontWeight: '600',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  updateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: 300, // Ensure minimum height
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalClose: {
    fontSize: 16,
    color: '#206E56',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  countryList: {
    flex: 1,
    maxHeight: 400,
    backgroundColor: 'white', // Ensure background
  },
  countryOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  countryName: {
    fontSize: 16,
    color: '#1f2937',
  },
});