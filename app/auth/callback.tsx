import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('AuthCallback: Received params:', params);

        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;

        if (accessToken && refreshToken) {
          console.log('AuthCallback: Setting session with tokens');
          
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('AuthCallback: Error setting session:', error);
            router.replace('/login');
            return;
          }

          console.log('AuthCallback: Session set successfully, redirecting to tabs');
          router.replace('/(tabs)');
        } else {
          console.error('AuthCallback: No tokens found in params');
          router.replace('/login');
        }
      } catch (error) {
        console.error('AuthCallback: Error handling callback:', error);
        router.replace('/login');
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A9B8E" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
