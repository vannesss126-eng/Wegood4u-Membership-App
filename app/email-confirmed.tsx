import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, TriangleAlert } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * Receives the signup Universal Link / App Link
 * (https://wegood4u.com/email-confirmed?token_hash=...&type=signup).
 *
 * SECURITY: redeeming a token_hash signs this device in as whoever the token
 * belongs to. Because the link is a plain https:// URL that both platforms route
 * straight into the app, anyone can forward their own unused confirmation link to
 * someone else. If we redeemed it silently, the recipient's device would quietly
 * become the sender's account and every receipt/selfie they upload afterwards
 * would land in it. So:
 *   1. If a session already exists, we do NOT redeem until the user confirms the
 *      account switch.
 *   2. After redeeming we show WHICH address was confirmed and wait for a tap
 *      instead of dropping into the tabs on a timer.
 */
type Status = 'checking' | 'confirm-switch' | 'verifying' | 'confirmed' | 'failed';

export default function EmailConfirmedScreen() {
  const { token_hash: tokenHash, type } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string>('');
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  // The token is single-use, so never redeem the same one twice. Keyed on the
  // token itself rather than a plain "already ran" flag: if the deep-link params
  // resolve a render late, a boolean would lock the screen into the failure state
  // forever, whereas this lets the real token through when it arrives.
  const attemptedToken = useRef<string | null>(null);

  const isSupportedType = type === 'signup' || type === 'email';

  const redeem = useCallback(async () => {
    if (!tokenHash || !isSupportedType) return;

    setStatus('verifying');
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === 'signup' ? 'signup' : 'email',
      });

      if (error) {
        // Overwhelmingly the link was already used (people tap twice), in which
        // case the address IS confirmed and the only thing left is to sign in.
        setStatus('failed');
        setMessage(
          'This confirmation link has already been used or has expired. If you have already confirmed your email, just log in.'
        );
        return;
      }

      const { data } = await supabase.auth.getUser();
      setConfirmedEmail(data.user?.email ?? null);
      setStatus('confirmed');
    } catch {
      setStatus('failed');
      setMessage('Something went wrong confirming your email. Please try logging in.');
    }
  }, [tokenHash, type, isSupportedType]);

  useEffect(() => {
    if (!tokenHash || !isSupportedType) {
      // Deliberately does NOT mark the token as attempted — see attemptedToken.
      setStatus('failed');
      setMessage('This confirmation link is incomplete. Please open the link from your email again.');
      return;
    }

    if (attemptedToken.current === tokenHash) return;
    attemptedToken.current = tokenHash;

    (async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        // Someone is already signed in on this device. Redeeming now would
        // replace their session without them asking. Make it a decision.
        setSignedInEmail(data.session.user?.email ?? null);
        setStatus('confirm-switch');
        return;
      }

      await redeem();
    })();
  }, [tokenHash, isSupportedType, redeem]);

  if (status === 'checking' || status === 'verifying') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.title}>Confirming your email...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'confirm-switch') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <TriangleAlert size={64} color="#D97706" />
          <Text style={styles.title}>Switch accounts?</Text>
          <Text style={styles.description}>
            You&apos;re currently signed in
            {signedInEmail ? (
              <>
                {' '}as <Text style={styles.emailText}>{signedInEmail}</Text>
              </>
            ) : null}
            . Opening this confirmation link will sign you out and switch this device to the
            account the link was sent to.
          </Text>
          <Text style={styles.warning}>
            If you didn&apos;t request this link yourself, do not continue.
          </Text>
          <TouchableOpacity style={styles.button} onPress={redeem}>
            <Text style={styles.buttonText}>Continue and switch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.secondaryButtonText}>Stay signed in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'confirmed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <CheckCircle size={64} color="#206E56" />
          <Text style={styles.title}>Email confirmed</Text>
          <Text style={styles.description}>
            {confirmedEmail ? (
              <>
                You&apos;re signed in as <Text style={styles.emailText}>{confirmedEmail}</Text>.
              </>
            ) : (
              <>You&apos;re all set.</>
            )}
          </Text>
          {/* Deliberately a tap, not a timer: the address above is the user's
              only chance to notice they've been handed someone else's link. */}
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <XCircle size={64} color="#DC2626" />
        <Text style={styles.title}>Couldn&apos;t confirm</Text>
        <Text style={styles.description}>{message}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  warning: {
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#206E56',
    fontSize: 16,
    fontWeight: '600',
  },
});
