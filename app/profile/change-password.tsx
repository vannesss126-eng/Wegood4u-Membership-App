import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MAX_PASSWORD_LENGTH, PASSWORD_RULES, getPasswordErrors } from '@/lib/passwordPolicy';

export default function ChangePasswordScreen() {
  const { forceClearAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    // Input validation
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    const passwordErrors = getPasswordErrors(newPassword);
    if (passwordErrors.length > 0) {
      Alert.alert(
        'Invalid Password',
        `Your password still needs:\n• ${passwordErrors.join('\n• ')}`
      );
      return;
    }

    setIsLoading(true);
    console.log('Starting password change process...');

    try {
      // This call used to be fired WITHOUT await, followed by a blind 3 second
      // sleep and an unconditional success alert. Any server-side failure (weak
      // password rejected, expired session, no network) was therefore reported to
      // the user as "Password Changed Successfully" and they were signed out —
      // leaving them unable to log in with either the old or the new password,
      // which is exactly the "password features don't work" report we chased.
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      setNewPassword('');
      setConfirmPassword('');
      console.log('Password change confirmed by server, showing success alert');

      // Show success alert with logout option
      Alert.alert(
        'Password Changed Successfully',
        'Your password has been updated. Please log in again with your new password.',
        [
          {
            text: 'OK',
            onPress: async () => {
              console.log('User pressed OK, starting logout process...');
              setIsLoading(true);
              
              try {
                // Step 5: Force clear auth state first
                await forceClearAuth();
                console.log('Auth state cleared, navigating to login...');
                
                // Step 6: Navigate to login
                router.replace('/login');
              } catch (error) {
                console.error('Error during logout process:', error);
                // Force navigation even if logout fails
                router.replace('/login');
              } finally {
                setIsLoading(false);
              }
            }
          }
        ],
        { cancelable: false }
      );
      
    } catch (error: any) {
      console.error('Password change error:', error);

      const message: string = error?.message ?? '';

      // A stale session can't update a password. Say so and route them to a
      // fresh login rather than showing a generic failure they can only retry.
      if (
        message.includes('session_not_found') ||
        message.includes('Auth session missing') ||
        message.includes('JWT expired')
      ) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again and then change your password.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
        return;
      }

      Alert.alert(
        'Password Not Changed',
        message || 'Failed to change password. Please try again.'
      );
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
          maxLength={MAX_PASSWORD_LENGTH}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconContainer}>
          <Lock size={48} color="#206E56" />
        </View>

        <Text style={styles.description}>
          Choose a new secure password for your account.
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
            {/* Rendered from the shared policy so this list cannot drift out of
                sync with what validation actually enforces. */}
            {PASSWORD_RULES.map((rule) => (
              <Text key={rule.id} style={styles.requirementItem}>
                • {rule.label}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.changeButton, isLoading && styles.changeButtonDisabled]}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size={20} color="white" />
            ) : (
              <Text style={styles.changeButtonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
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
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
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
  changeButton: {
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  changeButtonDisabled: {
    opacity: 0.6,
  },
  changeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});