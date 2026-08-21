import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { UserProvider } from '@/context/UserContext';

// Deep Link Handler Component
function DeepLinkHandler() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Handle deep links
    const handleDeepLink = (url: string) => {
      try {
        console.log('Deep link received:', url);
        
        // Parse the URL
        const parsedUrl = Linking.parse(url);
        
        // NOTE: there is deliberately no 'reset-password' branch here, and that
        // is NOT because recovery is website-only — app/reset-password.tsx
        // handles it in-app. Recovery arrives as a verified Universal Link /
        // App Link (https://wegood4u.com/reset-password?token_hash=...), which
        // expo-router routes by filename on its own; a manual branch here would
        // only race it. Same for /email-confirmed.
        // The old branch routed a wegood4u://reset-password deep link to a
        // /reset-confirm screen that could never work: the scheme was not
        // allow-listed, Supabase returns credentials in the URL fragment rather
        // than a `token` query param, and setSession() rejects the empty
        // refresh_token it passed. Both the branch and that screen are gone.

        // Check if it's an email confirmation link
        if (parsedUrl.path === 'confirm-email') {
          const { access_token, refresh_token, type } = parsedUrl.queryParams || {};
          
          if (type === 'signup' && access_token) {
            console.log('Email confirmation deep link detected');
            
            // Only navigate if user is not authenticated
            if (!isAuthenticated) {
              router.push(`/confirm-email?access_token=${access_token}&refresh_token=${refresh_token}&type=${type}`);
            } else {
              console.warn('Deep link ignored: User already authenticated');
            }
          }
        }
        // Check if it's an OAuth callback
        else if (parsedUrl.path === 'auth/callback' || url.includes('auth/callback')) {
          // Try to get tokens from query params first
          let access_token = parsedUrl.queryParams?.access_token as string | undefined;
          let refresh_token = parsedUrl.queryParams?.refresh_token as string | undefined;
          
          // If not in query params, check hash fragment (OAuth typically uses hash)
          if ((!access_token || !refresh_token) && url.includes('#')) {
            const hashIndex = url.indexOf('#');
            const fragment = url.substring(hashIndex + 1);
            const hashParams = new URLSearchParams(fragment);
            access_token = hashParams.get('access_token') || undefined;
            refresh_token = hashParams.get('refresh_token') || undefined;
          }
          
          if (access_token && refresh_token) {
            console.log('OAuth callback deep link detected');
            router.push(`/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`);
          } else {
            console.warn('OAuth callback detected but no tokens found in URL');
          }
        }
        // Add more path handlers here if needed (e.g., for other deep links)
      } catch (error) {
        console.error('Error handling deep link:', error);
        // Optional: Show user-friendly error (e.g., via toast) or ignore silently
      }
    };

    // Get initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for incoming deep links (when app is already open)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated]); // Include isAuthenticated in dependencies

  return null; // This component doesn't render anything
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <SafeAreaProvider>
        <AuthProvider>
          <UserProvider>
          <DeepLinkHandler />
          <Stack 
          initialRouteName="(tabs)"
          screenOptions={{ 
            headerShown: false,
            headerBackVisible: false,
            headerLeft: () => null,
            headerRight: () => null,
            headerTitle: () => null,
          }}
        >
          <Stack.Screen 
            name="login" 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="register" 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="forgot-password" 
            options={{ headerShown: false }}
          />
          {/* Receives the signup Universal Link / App Link
              (https://wegood4u.com/email-confirmed?token_hash=...). Distinct from
              "confirm-email/index" below, which is the in-app "check your inbox"
              waiting screen. */}
          <Stack.Screen
            name="email-confirmed"
            options={{ headerShown: false }}
          />
          {/* Receives the recovery Universal Link / App Link
              (https://wegood4u.com/reset-password?token_hash=...). */}
          <Stack.Screen
            name="reset-password"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="confirm-email/index"
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="auth/callback" 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="question/index" 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="(tabs)" 
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="invite-friends"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="favorites"
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="+not-found" 
            options={{ headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
        </UserProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}