import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronLeft, Search, X } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { 
  FadeInDown, 
  FadeOutUp, 
  Layout 
} from 'react-native-reanimated';
import type { FormData } from '@/types';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/context/UserContext';
import { countries } from '@/data/countries';

// Get countries with fallback
const getCountries = () => {
  if (countries && countries.length > 0) {
    return countries;
  }
  
  // Comprehensive fallback countries
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

export default function QuestionnairePage() {
  const { userData, refreshUserData } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    communicationChannel: 'WhatsApp',
    whatsappNumber: '',
    whatsappCountryCode: '+60',
    telegramNumber: '',
    telegramCountryCode: '+60',
    lineId: '',
    wechatId: '',
    countryOfResidence: 'Malaysia',
    travelDestination: 'Beach Destinations',
    specificBeachDestination: '',
    specificCulturalDestination: '',
    specificAdventureDestination: '',
    specificUrbanDestination: '',
    travelPreferences: 'Adventure Travel',
    otherTravelPreference: '',
    accommodationType: 'Hotels',
    alternativeAccommodation: '',
    travelBudget: 'Budget Travel: $500 - $1,000',
    customBudget: '',
  });

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showPhoneCountryModal, setShowPhoneCountryModal] = useState(false);
  const [phoneCountryFor, setPhoneCountryFor] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [countrySearch, setCountrySearch] = useState('');

  const communicationChannels = ['WhatsApp', 'Telegram', 'Line', 'WeChat'];
  const travelDestinations = ['Beach Destinations', 'Cultural Destinations', 'Adventure Destinations', 'Urban Destinations'];
  const travelPreferenceOptions = ['Adventure Travel', 'Relaxation Travel', 'Cultural Travel', 'Family Travel', 'Solo Travel', 'Luxury Travel', 'Others'];
  const accommodationTypes = ['Hotels', 'Hostels', 'Vacation Rentals', 'Resorts', 'Bed and Breakfasts/Guesthouses', 'Alternative Accommodations'];
  const budgetRanges = [
    'Budget Travel: $500 - $1,000',
    'Mid-range Travel: $1,000 - $3,000',
    'Luxury Travel: $3,000 - $10,000',
    'Ultra-Luxury Travel: $10,000 - $20,000',
    'Other (please specify)'
  ];

  const filteredCountries = getCountries().filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const updateFormData = (key: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const selectCountry = (countryName: string) => {
    updateFormData('countryOfResidence', countryName);
    setShowCountryModal(false);
    setCountrySearch('');
  };

  const selectPhoneCountry = (phoneCode: string) => {
    if (phoneCountryFor === 'whatsapp') {
      updateFormData('whatsappCountryCode', phoneCode);
    } else {
      updateFormData('telegramCountryCode', phoneCode);
    }
    setShowPhoneCountryModal(false);
    setCountrySearch('');
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return false;
    }

    if (formData.communicationChannel === 'WhatsApp' && !formData.whatsappNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your WhatsApp number');
      return false;
    }

    if (formData.communicationChannel === 'Telegram' && !formData.telegramNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your Telegram number');
      return false;
    }

    if (formData.communicationChannel === 'Line' && !formData.lineId.trim()) {
      Alert.alert('Validation Error', 'Please enter your Line ID');
      return false;
    }

    if (formData.communicationChannel === 'WeChat' && !formData.wechatId.trim()) {
      Alert.alert('Validation Error', 'Please enter your WeChat ID');
      return false;
    }

    if (formData.travelBudget === 'Other (please specify)' && !formData.customBudget.trim()) {
      Alert.alert('Validation Error', 'Please specify your custom budget');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      if (!userData) {
        Alert.alert('Authentication Required', 'Please sign in to submit the questionnaire');
        return;
      }

      setIsSubmitting(true);

      try {
        // Prepare communication contact details based on selected channel
        let communicationContactDetails = '';
        switch (formData.communicationChannel) {
          case 'WhatsApp':
            communicationContactDetails = `${formData.whatsappCountryCode}${formData.whatsappNumber}`;
            break;
          case 'Telegram':
            communicationContactDetails = `${formData.telegramCountryCode}${formData.telegramNumber}`;
            break;
          case 'Line':
            communicationContactDetails = formData.lineId;
            break;
          case 'WeChat':
            communicationContactDetails = formData.wechatId;
            break;
        }

        // Prepare travel destination detail based on selected category
        let travelDestinationDetail = '';
        switch (formData.travelDestination) {
          case 'Beach Destinations':
            travelDestinationDetail = formData.specificBeachDestination;
            break;
          case 'Cultural Destinations':
            travelDestinationDetail = formData.specificCulturalDestination;
            break;
          case 'Adventure Destinations':
            travelDestinationDetail = formData.specificAdventureDestination;
            break;
          case 'Urban Destinations':
            travelDestinationDetail = formData.specificUrbanDestination;
            break;
        }

        // Prepare travel preference
        const travelPreference = formData.travelPreferences === 'Others' 
          ? formData.otherTravelPreference 
          : formData.travelPreferences;

        // Prepare accommodation preference
        const accommodationPreference = formData.accommodationType === 'Alternative Accommodations'
          ? formData.alternativeAccommodation
          : formData.accommodationType;

        // Prepare travel budget
        const travelBudget = formData.travelBudget === 'Other (please specify)'
          ? formData.customBudget
          : formData.travelBudget;

        // Insert or update profile data
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: userData.id,
            full_name: formData.fullName,
            country_of_residence: formData.countryOfResidence,
            preferred_communication_channel: formData.communicationChannel as any,
            communication_contact_details: communicationContactDetails,
            travel_destination_category: formData.travelDestination,
            travel_destination_detail: travelDestinationDetail,
            travel_preference: travelPreference,
            accommodation_preference: accommodationPreference,
            travel_budget: travelBudget,
            verification_completed: true,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Supabase error:', error);
          Alert.alert('Error', 'Failed to submit questionnaire. Please try again.');
        } else {
          // Refresh user data to get the latest verification status
          await refreshUserData();
          
          // Small delay to ensure the UI updates properly
          setTimeout(() => {
            Alert.alert('Success', 'Questionnaire submitted successfully!', [
              { text: 'OK', onPress: () => router.push('/tasks') }
            ]);
          }, 500);
        }
      } catch (error) {
        console.error('Submission error:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderRadioGroup = (
    options: string[], 
    selectedValue: string, 
    onSelect: (value: string) => void
  ) => (
    <View style={styles.radioGroup}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={styles.radioOption}
          onPress={() => onSelect(option)}
        >
          <View style={[
            styles.radioButton,
            selectedValue === option && styles.radioButtonSelected
          ]}>
            {selectedValue === option && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={styles.radioText}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderConditionalField = (condition: boolean, children: React.ReactNode) => (
    condition ? (
      <Animated.View 
        entering={FadeInDown.duration(300)}
        exiting={FadeOutUp.duration(200)}
        layout={Layout.springify()}
        style={styles.conditionalField}
      >
        {children}
      </Animated.View>
    ) : null
  );

  const renderCountryModal = () => (
    <Modal
      visible={showCountryModal || showPhoneCountryModal}
      animationType="slide"
      transparent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {showCountryModal ? 'Select Country' : 'Select Country Code'}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowCountryModal(false);
                setShowPhoneCountryModal(false);
                setCountrySearch('');
              }}
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item: country }) => (
              <TouchableOpacity
                style={styles.countryOption}
                onPress={() => {
                  if (showCountryModal) {
                    selectCountry(country.name);
                  } else {
                    selectPhoneCountry(country.phoneCode);
                  }
                }}
              >
                <Text style={styles.countryName}>
                  {showCountryModal ? country.name : `${country.name} ${country.phoneCode}`}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.countryList}
            showsVerticalScrollIndicator={true}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Travel Questionnaire</Text>
          <Text style={styles.subtitle}>Help us plan your perfect trip</Text>
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your full name"
              value={formData.fullName}
              onChangeText={(text) => updateFormData('fullName', text)}
            />
          </View>

          {/* Communication Channel */}
          <View style={styles.section}>
            <Text style={styles.label}>Preferred Communication Channel *</Text>
            {renderRadioGroup(
              communicationChannels,
              formData.communicationChannel,
              (value) => updateFormData('communicationChannel', value)
            )}

            {/* Conditional Communication Fields */}
            {renderConditionalField(formData.communicationChannel === 'WhatsApp', (
              <View style={styles.phoneInputContainer}>
                <Text style={styles.label}>WhatsApp Number *</Text>
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity
                    style={styles.countryCodeButton}
                    onPress={() => {
                      setPhoneCountryFor('whatsapp');
                      setShowPhoneCountryModal(true);
                    }}
                  >
                    <Text style={styles.countryCodeText}>{formData.whatsappCountryCode}</Text>
                    <ChevronDown size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                    value={formData.whatsappNumber}
                    onChangeText={(text) => updateFormData('whatsappNumber', text)}
                  />
                </View>
              </View>
            ))}

            {renderConditionalField(formData.communicationChannel === 'Telegram', (
              <View style={styles.phoneInputContainer}>
                <Text style={styles.label}>Telegram Number *</Text>
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity
                    style={styles.countryCodeButton}
                    onPress={() => {
                      setPhoneCountryFor('telegram');
                      setShowPhoneCountryModal(true);
                    }}
                  >
                    <Text style={styles.countryCodeText}>{formData.telegramCountryCode}</Text>
                    <ChevronDown size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                    value={formData.telegramNumber}
                    onChangeText={(text) => updateFormData('telegramNumber', text)}
                  />
                </View>
              </View>
            ))}

            {renderConditionalField(formData.communicationChannel === 'Line', (
              <View>
                <Text style={styles.label}>Line ID *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your Line ID"
                  value={formData.lineId}
                  onChangeText={(text) => updateFormData('lineId', text)}
                />
              </View>
            ))}

            {renderConditionalField(formData.communicationChannel === 'WeChat', (
              <View>
                <Text style={styles.label}>WeChat ID *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your WeChat ID"
                  value={formData.wechatId}
                  onChangeText={(text) => updateFormData('wechatId', text)}
                />
              </View>
            ))}
          </View>

          {/* Country of Residence */}
          <View style={styles.section}>
            <Text style={styles.label}>Country of Residence *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowCountryModal(true)}
            >
              <Text style={styles.dropdownText}>{formData.countryOfResidence}</Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Travel Destination */}
          <View style={styles.section}>
            <Text style={styles.label}>Preferred Travel Destination</Text>
            <Text style={styles.description}>
              Please select your preferred travel destinations from the following categories. You can also specify particular countries or cities within each category if you have specific preferences.
            </Text>
            <Text style={styles.subLabel}>Choose your Preferences</Text>
            {renderRadioGroup(
              travelDestinations,
              formData.travelDestination,
              (value) => updateFormData('travelDestination', value)
            )}

            {renderConditionalField(formData.travelDestination === 'Beach Destinations', (
              <View>
                <Text style={styles.label}>Beach Destination *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify beach destinations"
                  value={formData.specificBeachDestination}
                  onChangeText={(text) => updateFormData('specificBeachDestination', text)}
                />
              </View>
            ))}

            {renderConditionalField(formData.travelDestination === 'Cultural Destinations', (
              <View>
                <Text style={styles.label}>Cultural Destination *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify cultural destinations"
                  value={formData.specificCulturalDestination}
                  onChangeText={(text) => updateFormData('specificCulturalDestination', text)}
                />
              </View>
            ))}

            {renderConditionalField(formData.travelDestination === 'Adventure Destinations', (
              <View>
                <Text style={styles.label}>Adventure Destination *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify adventure destinations"
                  value={formData.specificAdventureDestination}
                  onChangeText={(text) => updateFormData('specificAdventureDestination', text)}
                />
              </View>
            ))}

            {renderConditionalField(formData.travelDestination === 'Urban Destinations', (
              <View>
                <Text style={styles.label}>Urban Destination *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify urban destinations"
                  value={formData.specificUrbanDestination}
                  onChangeText={(text) => updateFormData('specificUrbanDestination', text)}
                />
              </View>
            ))}
          </View>

          {/* Travel Preferences */}
          <View style={styles.section}>
            <Text style={styles.label}>Travel Preferences</Text>
            <Text style={styles.description}>
              Please select your travel interests or styles from the list below. You can also add any other preferences not listed here.
            </Text>
            <Text style={styles.subLabel}>Choose your Preferences</Text>
            {renderRadioGroup(
              travelPreferenceOptions,
              formData.travelPreferences,
              (value) => updateFormData('travelPreferences', value)
            )}

            {renderConditionalField(formData.travelPreferences === 'Others', (
              <View>
                <Text style={styles.label}>Other Travel Preference *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify your travel preference"
                  value={formData.otherTravelPreference}
                  onChangeText={(text) => updateFormData('otherTravelPreference', text)}
                />
              </View>
            ))}
          </View>

          {/* Accommodation Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Preferred Accommodation Type</Text>
            <Text style={styles.description}>
              Please select your top 3 preferred accommodation types from the list below.
            </Text>
            <Text style={styles.subLabel}>Choose your Preferences</Text>
            {renderRadioGroup(
              accommodationTypes,
              formData.accommodationType,
              (value) => updateFormData('accommodationType', value)
            )}

            {renderConditionalField(formData.accommodationType === 'Alternative Accommodations', (
              <View>
                <Text style={styles.label}>Alternative Accommodation *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Specify alternative accommodation"
                  value={formData.alternativeAccommodation}
                  onChangeText={(text) => updateFormData('alternativeAccommodation', text)}
                />
              </View>
            ))}
          </View>

          {/* Travel Budget */}
          <View style={styles.section}>
            <Text style={styles.label}>Travel Budget *</Text>
            {renderRadioGroup(
              budgetRanges,
              formData.travelBudget,
              (value) => updateFormData('travelBudget', value)
            )}

            {renderConditionalField(formData.travelBudget === 'Other (please specify)', (
              <View>
                <Text style={styles.label}>Specify Your Budget (USD $) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your budget in USD"
                  keyboardType="numeric"
                  value={formData.customBudget}
                  onChangeText={(text) => updateFormData('customBudget', text)}
                />
              </View>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderCountryModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#F38632',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 12,
    marginTop: 16,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
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
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#206E56',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#206E56',
  },
  radioText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  conditionalField: {
    marginTop: 16,
  },
  phoneInputContainer: {
    gap: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    minWidth: 80,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#1f2937',
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#206E56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  countryList: {
    flex: 1,
    backgroundColor: 'white',
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