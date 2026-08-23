import React, { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, ChevronDown } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { MAX_PASSWORD_LENGTH, PASSWORD_RULES, getPasswordErrors } from '@/lib/passwordPolicy';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  dateOfBirth: Date | null;
  gender: string;
  invitationCode: string;
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    dateOfBirth: null,
    gender: '',
    invitationCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  // Live availability of the Name field. 'unknown' also covers "the RPC isn't
  // deployed yet", in which case we simply say nothing and let the submit-time
  // message handle it — a broken check must never block a valid signup.
  const [nameStatus, setNameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'unknown'
  >('idle');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Outlet referral code from the deep link (e.g. /register?ref=TG-BUKITJALIL).
  // Attributes this signup to the outlet whose QR was scanned. Phase 6 wires the QR.
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const outletRef = Array.isArray(ref) ? ref[0] : ref;

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const updateFormData = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Display order for the live requirements checklist. Labels MUST match the
  // Rules now come from lib/passwordPolicy so this screen, change-password and
  // the website's /reset-password page cannot disagree. They used to: signup
  // accepted 6 characters while the web reset page demanded more than 8, so a
  // password chosen here could be rejected during a reset.
  const PASSWORD_RULES_ORDER = PASSWORD_RULES.map((rule) => rule.label);

  const handlePasswordChange = (text: string) => {
    updateFormData('password', text);
    setPasswordErrors(getPasswordErrors(text));
  };

  // Debounced: one call after typing settles, not one per keystroke.
  useEffect(() => {
    const name = formData.displayName.trim();

    if (name.length < 2) {
      setNameStatus('idle');
      return;
    }

    setNameStatus('checking');
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', {
        p_username: name,
      });

      if (cancelled) return;

      // A missing function (migration not pushed) or any transport failure lands
      // here. Stay quiet rather than guessing — handleRegister still catches the
      // collision on submit.
      if (error) {
        setNameStatus('unknown');
        return;
      }

      setNameStatus(data === false ? 'taken' : 'available');
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.displayName]);

  const handleRegister = async () => {
    // Only require core fields
    if (!formData.email || !formData.password || !formData.displayName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate date is not in the future (if provided)
    if (formData.dateOfBirth) {
      const today = new Date();
      if (formData.dateOfBirth > today) {
        Alert.alert('Error', 'Date of birth cannot be in the future');
        return;
      }
    }

    if (nameStatus === 'taken') {
      Alert.alert(
        'Name Already Taken',
        `The name "${formData.displayName.trim()}" is already in use. Please choose a different name.`
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Length + character-class rules are all enforced by getPasswordErrors below.

    const passwordValidationErrors = getPasswordErrors(formData.password);
    if (passwordValidationErrors.length > 0) {
      Alert.alert(
        'Invalid Password',
        `Your password still needs:\n• ${passwordValidationErrors.join('\n• ')}`
      );
      return;
    }

    try {
      setSubmitting(true);
      // Format date as local YYYY-MM-DD for database if provided.
      // Avoids timezone shifting caused by `toISOString()`.
      const formatDateToYMD = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const formattedDate = formData.dateOfBirth ? formatDateToYMD(formData.dateOfBirth) : null;
      await signUp(
        formData.email,
        formData.password,
        formData.displayName,
        formattedDate,
        formData.gender || null,
        formData.invitationCode || undefined,
        outletRef || undefined
      );
      
      Alert.alert(
        'Check your email to verify',
        'We sent a confirmation link to your inbox. Tap it to verify and log in.',
        [
          { text: 'OK', onPress: () => router.replace((`/confirm-email?email=${encodeURIComponent(formData.email)}` as any)) }
        ]
      );
    } catch (error: any) {
      const message: string = error?.message ?? '';

      // "Database error saving new user" is GoTrue's generic wrapper for ANY
      // exception raised by the handle_new_user trigger. In practice it is almost
      // always the profiles_username_key UNIQUE constraint: the trigger writes
      // this Name straight into profiles.username, so a name someone already used
      // aborts the whole signup with a message that blames the database and tells
      // the user nothing they can act on.
      if (
        message.includes('Database error saving new user') ||
        message.includes('duplicate key') ||
        message.includes('profiles_username_key')
      ) {
        Alert.alert(
          'Name Already Taken',
          `The name "${formData.displayName.trim()}" is already in use. Please choose a different name — your email is fine.`
        );
        return;
      }

      Alert.alert('Registration Failed', message || 'Something went wrong. Please try again.');
    }
    finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    // Navigate to the login screen explicitly. `router.back()` was popping the
    // stack back to wherever the user came from (e.g. the Profile tab), not /login.
    router.replace('/login');
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
            {nameStatus === 'checking' && (
              <Text style={styles.nameHintChecking}>Checking availability...</Text>
            )}
            {nameStatus === 'taken' && (
              <Text style={styles.nameHintTaken}>
                That name is already taken — please choose another.
              </Text>
            )}
            {nameStatus === 'available' && (
              <Text style={styles.nameHintAvailable}>That name is available.</Text>
            )}
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
            <Text style={styles.inputLabel}>Date of Birth (Optional)</Text>
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
            <Text style={styles.inputLabel}>Gender (Optional)</Text>
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
                maxLength={MAX_PASSWORD_LENGTH}
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
            {/* Live password requirements checklist (✓ met / ✗ not yet) */}
            {formData.password.length > 0 && (
              <View style={styles.passwordRequirements}>
                {PASSWORD_RULES_ORDER.map((rule) => {
                  const met = !passwordErrors.includes(rule);
                  return (
                    <View key={rule} style={styles.passwordRequirementRow}>
                      <Text style={[styles.passwordRequirementMark, met ? styles.reqMet : styles.reqUnmet]}>
                        {met ? '✓' : '✗'}
                      </Text>
                      <Text style={[styles.passwordRequirementText, met ? styles.reqMetText : styles.reqUnmetText]}>
                        {rule}
                      </Text>
                    </View>
                  );
                })}
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
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Text style={styles.inputHint}>
              Codes are case-sensitive — enter it exactly as shown.
            </Text>
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
          value={formData.dateOfBirth || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            // `onChange` can fire multiple times on iOS; only close after a confirmed selection.
            // On Android it is also common to close immediately after `set`.
            const eventType = event?.type;
            if (eventType === 'dismissed') {
              setShowDatePicker(false);
              return;
            }

            if (selectedDate) {
              updateFormData('dateOfBirth', selectedDate);
            }

            if (Platform.OS === 'android' || eventType === 'set') {
              setShowDatePicker(false);
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
  nameHintChecking: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
  },
  nameHintTaken: {
    marginTop: 6,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  nameHintAvailable: {
    marginTop: 6,
    fontSize: 13,
    color: '#206E56',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  passwordRequirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  passwordRequirementMark: {
    width: 16,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
    textAlign: 'center',
  },
  passwordRequirementText: {
    fontSize: 12,
  },
  reqMet: { color: '#16A34A' },
  reqUnmet: { color: '#9CA3AF' },
  reqMetText: { color: '#15803D' },
  reqUnmetText: { color: '#6B7280' },
});