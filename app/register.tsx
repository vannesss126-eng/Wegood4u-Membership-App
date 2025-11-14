import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, ChevronDown } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  dateOfBirth: Date;
  gender: string;
  invitationCode: string;
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    dateOfBirth: new Date(),
    gender: '',
    invitationCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const updateFormData = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    
    if (!/[a-z]/.test(password)) {
      errors.push('lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('uppercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('digit');
    }
    
    return errors;
  };

  const handlePasswordChange = (text: string) => {
    updateFormData('password', text);
    setPasswordErrors(validatePassword(text));
  };

  const handleRegister = async () => {
    if (!formData.email || !formData.password || !formData.displayName || !formData.dateOfBirth || !formData.gender) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate date is not in the future
    const today = new Date();
    if (formData.dateOfBirth > today) {
      Alert.alert('Error', 'Date of birth cannot be in the future');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    const passwordValidationErrors = validatePassword(formData.password);
    if (passwordValidationErrors.length > 0) {
      Alert.alert(
        'Invalid Password', 
        `Password must contain: ${passwordValidationErrors.join(', ')}`
      );
      return;
    }

    try {
      setSubmitting(true);
      // Format date as YYYY-MM-DD for database
      const formattedDate = formData.dateOfBirth.toISOString().split('T')[0];
      await signUp(
        formData.email, 
        formData.password, 
        formData.displayName, 
        formattedDate, 
        formData.gender, 
        formData.invitationCode || undefined
      );
      
      Alert.alert(
        'Check your email to verify',
        'We sent a confirmation link to your inbox. Tap it to verify and log in.',
        [
          { text: 'OK', onPress: () => router.replace((`/confirm-email?email=${encodeURIComponent(formData.email)}` as any)) }
        ]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    }
    finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Fill your information below to register</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. John Doe"
              placeholderTextColor="#999"
              value={formData.displayName}
              onChangeText={(text) => updateFormData('displayName', text)}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="example@gmail.com"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.dateSelector}>
                <Text style={[styles.dateSelectorText, !formData.dateOfBirth && styles.placeholderText]}>
                  {formData.dateOfBirth ? formData.dateOfBirth.toLocaleDateString() : 'Select Date'}
                </Text>
                <ChevronDown size={20} color="#999" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowGenderDropdown(true)}
            >
              <View style={styles.genderSelector}>
                <Text style={[styles.genderSelectorText, !formData.gender && styles.placeholderText]}>
                  {formData.gender || 'Select Gender'}
                </Text>
                <ChevronDown size={20} color="#999" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="********"
                placeholderTextColor="#999"
                value={formData.password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#999" />
                ) : (
                  <Eye size={20} color="#999" />
                )}
              </TouchableOpacity>
            </View>
            {/* Password Requirements Display */}
            {formData.password.length > 0 && passwordErrors.length > 0 && (
              <View style={styles.passwordRequirements}>
                <Text style={styles.passwordRequirementsTitle}>Password must contain:</Text>
                {passwordErrors.map((error, index) => (
                  <Text key={index} style={styles.passwordRequirementItem}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}
            {/* Password Success Display */}
            {formData.password.length > 0 && passwordErrors.length === 0 && formData.password.length >= 6 && (
              <View style={styles.passwordSuccess}>
                <Text style={styles.passwordSuccessText}>✓ Password meets all requirements</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="********"
                placeholderTextColor="#999"
                value={formData.confirmPassword}
                onChangeText={(text) => updateFormData('confirmPassword', text)}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#999" />
                ) : (
                  <Eye size={20} color="#999" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Invitation Code (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter invitation code"
              placeholderTextColor="#999"
              value={formData.invitationCode}
              onChangeText={(text) => updateFormData('invitationCode', text)}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.registerButton, submitting && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={submitting}
          >
            <Text style={styles.registerButtonText}>
              {submitting ? 'Creating Account...' : 'Register'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={goToLogin}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkHighlight}>Sign In</Text> here
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.dateOfBirth}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              updateFormData('dateOfBirth', selectedDate);
            }
          }}
        />
      )}

      {/* Gender Selection Modal */}
      <Modal
        visible={showGenderDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGenderDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.genderModal}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderOption,
                  formData.gender === option && styles.selectedGenderOption
                ]}
                onPress={() => {
                  updateFormData('gender', option);
                  setShowGenderDropdown(false);
                }}
              >
                <Text style={[
                  styles.genderOptionText,
                  formData.gender === option && styles.selectedGenderOptionText
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowGenderDropdown(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 0,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateSelectorText: {
    fontSize: 16,
    color: '#000',
  },
  genderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genderSelectorText: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    color: '#999',
  },
  registerButton: {
    backgroundColor: '#4A9B8E',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#666',
    fontSize: 14,
  },
  loginLinkHighlight: {
    color: '#4A9B8E',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 20,
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    padding: 20,
    paddingBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  genderOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectedGenderOption: {
    backgroundColor: '#4A9B8E',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  selectedGenderOptionText: {
    color: 'white',
  },
  modalCloseButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  passwordRequirements: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
  },
  passwordRequirementsTitle: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 4,
  },
  passwordRequirementItem: {
    fontSize: 11,
    color: '#DC2626',
    marginLeft: 8,
  },
  passwordSuccess: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
  },
  passwordSuccessText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
  },
});