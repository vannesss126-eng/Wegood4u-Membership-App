import React from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import GoogleAuthButton from './GoogleAuthButton';
import { useAuth } from '@/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function SocialAuthButtons() {
  const { signInWithProvider } = useAuth();

  const handleGoogleAuth = async () => {
    try {
      await signInWithProvider('google');
    } catch (error: any) {
      Alert.alert('Authentication Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <GoogleAuthButton onPress={handleGoogleAuth} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
});