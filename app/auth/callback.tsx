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

        let accessToken = params.access_token as string;
        let refreshToken = params.refresh_token as string;

        if (!accessToken || !refreshToken) {
          console.log('AuthCallback: No tokens in params, checking for hash fragment');
          
          if (typeof window !== 'undefined') {
            const hash = window.location.hash.substring(1);
            const hashParams = new URLSearchParams(hash);
            accessToken = hashParams.get('access_token') || '';
            refreshToken = hashParams.get('refresh_token') || '';
            console.log('AuthCallback: Extracted from hash - access:', !!accessToken, 'refresh:', !!refreshToken);
          }
        }

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
          console.error('AuthCallback: No tokens found in params or hash');
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
