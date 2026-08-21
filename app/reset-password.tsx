import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, TriangleAlert } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MAX_PASSWORD_LENGTH, PASSWORD_RULES, getPasswordErrors } from '@/lib/passwordPolicy';

/**
 * Password recovery, completed inside the app.
 *
 * The route name matches the website's path deliberately: with the App Link /
 * Universal Link association covering /reset-password, tapping "Reset my
 * password" in the email opens
 * `https://wegood4u.com/reset-password?token_hash=...&type=recovery` HERE instead
 * of a browser, and expo-router maps it by filename.
 *
 * The same URL still serves everyone — desktop and phones without the app get the
 * website, which does the same job. Only one side ever redeems the single-use
 * token.
 *
 * Replaces the old `reset-confirm.tsx`, which could never work: it expected a
 * `token` query param when Supabase returns credentials in the URL fragment, and
 * called setSession() with an empty refresh_token, which supabase-js rejects.
 */
type Stage = 'verifying' | 'confirm-switch' | 'ready' | 'invalid' | 'saving' | 'done';

export default function ResetPasswordScreen() {
  const { token_hash: tokenHash, type } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();

  const [stage, setStage] = useState<Stage>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // The token is single-use, so a re-delivered deep link must not redeem twice.
  // Keyed on the token itself rather than a plain "already ran" flag: if the
  // deep-link params resolve a render late, a boolean would lock this screen into
  // the failure state permanently instead of letting the real token through.
  const attemptedToken = useRef<string | null>(null);

  // True only once verifyOtp has actually established a recovery session.
  const redeemedRef = useRef(false);

  // Cleared on unmount so the post-success redirect can't fire at a screen the
  // user has already navigated away from.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  const fail = useCallback(async (message: string) => {
    // Only tear down a session THIS screen created. Signing out unconditionally
    // destroyed the user's own valid session whenever they tapped a stale reset
    // link — locking out the very person who could not remember their password.
    if (redeemedRef.current) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Nothing useful to do; still show the user the failure.
      }
      redeemedRef.current = false;
    }
    setErrorMessage(message);
    setStage('invalid');
  }, []);

  const redeem = useCallback(async () => {
    if (!tokenHash || type !== 'recovery') return;

    setStage('verifying');
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });

      if (error) {
        await fail(
          'This reset link is no longer valid. Links expire, and requesting a new one replaces the old link — please use the most recent email.'
        );
        return;
      }

      redeemedRef.current = true;

      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        await fail('Could not confirm who this link belongs to. Please request a new one.');
        return;
      }

      setEmail(data.user.email ?? null);
      setStage('ready');
    } catch {
      await fail('Something went wrong. Please request a new reset link.');
    }
  }, [tokenHash, type, fail]);

  useEffect(() => {
    if (!tokenHash || type !== 'recovery') {
      // No signOut here: nothing was redeemed, so there is no recovery session to
      // clear — only the user's own, which is not ours to end. Also deliberately
      // does not mark the token attempted, so late-arriving params still work.
      setErrorMessage(
        'This reset link is incomplete. Please request a new one from the login screen.'
      );
      setStage('invalid');
      return;
    }

    if (attemptedToken.current === tokenHash) return;
    attemptedToken.current = tokenHash;

    (async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        // Redeeming replaces whoever is signed in on this device. Since the link
        // is a plain https:// URL anyone can forward, that switch has to be the
        // user's decision, not a side effect of opening a link.
        setSignedInEmail(data.session.user?.email ?? null);
        setStage('confirm-switch');
        return;
      }

      await redeem();
    })();
  }, [tokenHash, type, redeem]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const passwordErrors = getPasswordErrors(password);
    if (passwordErrors.length > 0) {
      Alert.alert('Invalid Password', `Your password still needs:\n• ${passwordErrors.join('\n• ')}`);
      return;
    }

    setStage('saving');

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setPassword('');
      setConfirmPassword('');
      setStage('done');

      // verifyOtp already established a session and the user just proved they
      // control the inbox, so send them into the app rather than making them
      // retype the password they set two seconds ago. AuthContext's
      // onAuthStateChange has the session already.
      doneTimer.current = setTimeout(() => router.replace('/(tabs)'), 1200);
    } catch (error: any) {
      setStage('ready');
      Alert.alert(
        'Password Not Changed',
        error?.message || 'Failed to reset your password. Please try again.'
      );
    }
  };

  if (stage === 'verifying') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'confirm-switch') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <TriangleAlert size={64} color="#D97706" />
          <Text style={styles.title}>Switch accounts?</Text>
          <Text style={styles.description}>
            You&apos;re currently signed in
            {signedInEmail ? (
              <>
                {' '}as <Text style={styles.emailText}>{signedInEmail}</Text>
              </>
            ) : null}
            . Continuing will sign you out and switch this device to the account this reset
            link was sent to.
          </Text>
          <Text style={styles.warning}>
            If you didn&apos;t request this reset yourself, do not continue.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={redeem}>
            <Text style={styles.primaryButtonText}>Continue and switch</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.secondaryButtonText}>Stay signed in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'invalid') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <XCircle size={64} color="#DC2626" />
          <Text style={styles.title}>Reset link not valid</Text>
          <Text style={styles.description}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/forgot-password')}
          >
            <Text style={styles.primaryButtonText}>Request a new link</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <CheckCircle size={64} color="#206E56" />
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.description}>Signing you in...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSaving = stage === 'saving';
  const unmetRules = getPasswordErrors(password);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <Lock size={64} color="#206E56" />
          </View>

          <Text style={styles.title}>Set a new password</Text>
          {email && (
            <Text style={styles.description}>
              Resetting the password for <Text style={styles.emailText}>{email}</Text>
            </Text>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={MAX_PASSWORD_LENGTH}
                  editable={!isSaving}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                  {showPassword ? (
                    <EyeOff size={20} color="#64748B" />
                  ) : (
                    <Eye size={20} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={MAX_PASSWORD_LENGTH}
                  editable={!isSaving}
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeButton}>
                  {showConfirm ? (
                    <EyeOff size={20} color="#64748B" />
                  ) : (
                    <Eye size={20} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Live checklist from the shared policy, so this can never disagree
                with what validation enforces or with the website. */}
            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              {PASSWORD_RULES.map((rule) => {
                const met = password.length > 0 && !unmetRules.includes(rule.label);
                return (
                  <View key={rule.id} style={styles.requirementRow}>
                    <Text style={[styles.requirementMark, met ? styles.met : styles.unmet]}>
                      {met ? '✓' : '✗'}
                    </Text>
                    <Text style={[styles.requirementText, met ? styles.met : styles.unmet]}>
                      {rule.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size={20} color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>Update password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: { fontSize: 16, color: '#64748B' },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  emailText: { fontWeight: '600', color: '#1e293b' },
  warning: {
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryButtonText: { color: '#206E56', fontSize: 16, fontWeight: '600' },
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
  inputGroup: { marginBottom: 20 },
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
  eyeButton: { padding: 12 },
  requirements: {
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
  requirementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  requirementMark: { fontSize: 14, width: 20 },
  requirementText: { fontSize: 14 },
  met: { color: '#206E56' },
  unmet: { color: '#DC2626' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
