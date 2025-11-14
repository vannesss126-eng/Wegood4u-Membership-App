import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ResetConfirmScreen() {
  const { token, type } = useLocalSearchParams<{ token?: string; type?: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    // Verify we have the required parameters
    if (type === 'recovery' && token) {
      setIsValidToken(true);
      // Set the session with the recovery token
      supabase.auth.setSession({
        access_token: token,
        refresh_token: '', // Not needed for password reset
      });
    } else {
      Alert.alert(
        'Invalid Reset Link',
        'This password reset link is invalid or has expired. Please request a new one.',
        [
          { text: 'OK', onPress: () => router.replace('/forgot-password') }
        ]
      );
    }
  }, [token, type]);

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    
    if (password.length < 6) {
      errors.push('at least 6 characters');
    }
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

  const handleResetPassword = async () => {
    // Input validation
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      Alert.alert(
        'Invalid Password',
        `Password must contain: ${passwordErrors.join(', ')}`
      );
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password using the recovery session
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }

      // Clear form
      setNewPassword('');
      setConfirmPassword('');

      // Show success message and redirect to login
      Alert.alert(
        'Password Reset Successful',
        'Your password has been updated successfully. Please log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Sign out to clear the recovery session
              supabase.auth.signOut();
              router.replace('/login');
            }
          }
        ],
        { cancelable: false }
      );

    } catch (error: any) {
      console.error('Password reset error:', error);
      
      if (error.message?.includes('session_not_found') || error.message?.includes('invalid_token')) {
        Alert.alert(
          'Reset Link Expired',
          'This password reset link has expired. Please request a new one.',
          [
            { text: 'OK', onPress: () => router.replace('/forgot-password') }
          ]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to reset password. Please try again or request a new reset link.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    showPassword: boolean,
    toggleShow: () => void,
    placeholder: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={toggleShow} style={styles.eyeButton}>
          {showPassword ? (
            <EyeOff size={20} color="#64748B" />
          ) : (
            <Eye size={20} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isValidToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Lock size={64} color="#206E56" />
          </View>

          <Text style={styles.title}>Reset Your Password</Text>
          <Text style={styles.description}>
            Enter your new password below. Make sure it&apos;s secure and easy to remember.
          </Text>

          <View style={styles.form}>
            {renderPasswordInput(
              'New Password',
              newPassword,
              setNewPassword,
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
              'Enter new password'
            )}

            {renderPasswordInput(
              'Confirm New Password',
              confirmPassword,
              setConfirmPassword,
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
              'Confirm new password'
            )}

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={styles.requirementItem}>• At least 6 characters</Text>
              <Text style={styles.requirementItem}>• One uppercase letter</Text>
              <Text style={styles.requirementItem}>• One lowercase letter</Text>
              <Text style={styles.requirementItem}>• One number</Text>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size={20} color="white" />
              ) : (
                <>
                  <CheckCircle size={20} color="white" />
                  <Text style={styles.resetButtonText}>Reset Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              If you&apos;re having trouble resetting your password, please contact our support team.
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => router.push('/profile/contact')}
            >
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  eyeButton: {
    padding: 12,
  },
  passwordRequirements: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});