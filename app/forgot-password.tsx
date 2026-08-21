import React, { useEffect, useRef, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Lock } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Supabase stores a single recovery token per user, so every send REPLACES the
// previous link. Users who tapped "Resend Email" a few times and then opened the
// oldest email in their inbox got "invalid or expired link" and concluded the
// feature was broken. The cooldown makes repeat sends deliberate, and the copy
// below tells people to use the newest email.
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
  }, [cooldown]);

  // Belt-and-braces: never leave a timer running past unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleResetPassword = async () => {
    // Trim once and use the trimmed value everywhere. Previously the emptiness
    // check trimmed but the regex and the request did not, so a trailing space
    // pasted from a keyboard suggestion failed validation confusingly.
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        // wegood4u.com (Vercel) is the live site now — the old Firebase
        // wegood4u-web.web.app URL is not in Supabase's redirect allowlist, so it
        // fell back to the Site URL (the homepage). This URL IS allowlisted.
        redirectTo: 'https://wegood4u.com/reset-password',
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(
        'Reset Email Sent',
        'We have sent a password reset link to your email. Please check your inbox and tap the link to reset your password.',
        [
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send reset email. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0) return;
    await handleResetPassword();
  };

  const isResendDisabled = isLoading || cooldown > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Lock size={64} color="#206E56" />
          </View>

          {!emailSent ? (
            <>
              <Text style={styles.title}>Reset Your Password</Text>
              <Text style={styles.description}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </Text>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.emailContainer}>
                    <Mail size={20} color="#64748B" style={styles.emailIcon} />
                    <TextInput
                      style={styles.emailInput}
                      placeholder="Enter your email"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>
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
                      <Mail size={20} color="white" />
                      <Text style={styles.resetButtonText}>Send Reset Link</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.description}>
                We&apos;ve sent a password reset link to {email}. Please check your inbox and tap the link to reset your password.
              </Text>
              <Text style={[styles.description, styles.descriptionSpam]}>
                If you don&apos;t receive the email within a few minutes, please check your spam folder or contact our support team.
              </Text>
              <Text style={styles.descriptionNewest}>
                If you request another email, only the newest link will work.
              </Text>

              <View style={styles.successActions}>
                <TouchableOpacity
                  style={[styles.resendButton, isResendDisabled && styles.resendButtonDisabled]}
                  onPress={handleResendEmail}
                  disabled={isResendDisabled}
                >
                  {isLoading ? (
                    <ActivityIndicator size={16} color="#206E56" />
                  ) : (
                    <Text style={styles.resendButtonText}>
                      {cooldown > 0 ? `Resend Email (${cooldown}s)` : 'Resend Email'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.replace('/login')}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              If you don&apos;t receive the email within a few minutes, please check your spam folder or contact our support team.
            </Text>
          </View>
        </ScrollView>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 24,
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
    marginBottom: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  descriptionSpam: {
    marginBottom: 12,
    fontWeight: '600',
  },
  descriptionNewest: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 20,
    fontStyle: 'italic',
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
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emailIcon: {
    marginRight: 12,
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
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
  successActions: {
    gap: 16,
    marginBottom: 32,
  },
  resendButton: {
    backgroundColor: '#CBEED2',
    borderWidth: 1,
    borderColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    color: '#206E56',
    fontSize: 16,
    fontWeight: '600',
  },
  backToLoginButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
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
  },
});