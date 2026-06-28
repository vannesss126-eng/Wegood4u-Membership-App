import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthErrorMessage } from '@/lib/authErrors';
import type { User, Session } from '@supabase/supabase-js';
import type { AuthContextType } from '@/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let initialized = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      console.log('AuthProvider: Initial session:', session ? 'present' : 'none');
      console.log('AuthProvider: Initial user:', session?.user ? 'present' : 'none');

      if (!initialized) {
        setIsLoading(false);
        initialized = true;
      }
    }).catch(err => {
      console.error('Initial session error:', err);
      if (!initialized) setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event);
        setSession(session);
        setUser  (session?.user ?? null);
        console.log('AuthProvider: New session:', session ? 'present' : 'none');
        
        // Ensure loading state resolves after auth changes (quick transitions)
        setIsLoading(false);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Supabase sign-in response received:', data.session ? 'session present' : 'no session');
      if (error) {
        console.log('Supabase error response received: ', error);
        throw error;
      }
      
      // Manual state update for immediate sync
      setSession(data.session);
      setUser (data.user ?? null);
      setIsLoading(false);
      
      console.log('Login successful');
      console.log('Session:', data.session ? 'present' : 'missing');
      console.log('User:', data.user ? 'present' : 'missing');
    } catch (error: any) {
      // Single quiet dev log (was two console.error calls, each of which popped
      // its own red-box LogBox error in dev). Throw a clear, user-facing message.
      if (__DEV__) console.log('signIn failed:', error?.code ?? error?.status ?? error?.message);
      setIsLoading(false); // Make sure to set loading to false on error
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    dateOfBirth?: string | null,
    gender?: string | null,
    invitationCode?: string,
    outletRef?: string
  ) => {
    console.log('AuthContext: signUp called');
    setIsLoading(true);
    
    try {
      // The "Invitation Code" field accepts BOTH a user-to-user invitation code
      // and a store referral code. We validate it here so an invalid code blocks
      // signup with a clear message, but no longer resolve/persist it on the
      // client — the handle_new_user trigger resolves referral_code + outlet_ref
      // (passed via signUp metadata below) and writes the profile server-side.
      if (invitationCode?.trim()) {
        const { data: resolved, error: resolveError } = await supabase
          .rpc('resolve_referral_code', { p_code: invitationCode.trim() })
          .maybeSingle();

        if (resolveError || !resolved) {
          if (resolveError) console.error('Error validating invitation code:', resolveError);
          throw new Error('Invalid invitation code');
        }
      }

      console.log('Creating user account...');
      // Create user account with metadata for trigger
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: displayName,
            full_name: displayName,
            dob: dateOfBirth ?? null,
            gender: gender ?? null,
            // Resolved + persisted server-side by the handle_new_user trigger.
            referral_code: invitationCode?.trim() || null,
            outlet_ref: outletRef ?? null,
          },
          emailRedirectTo: 'https://wegood4u.com/email-confirmed',
        },
      });

      if (error) {
        console.error('SignUp error:', error);
        throw error;
      }

      if (!data.user) {
        console.error('No user returned from signUp');
        throw new Error('Failed to create user account');
      }

      // The profile row — including inviter_id / referred_by_store_id resolved
      // from the referral_code + outlet_ref metadata above — is created
      // server-side by the handle_new_user trigger. The client no longer writes
      // to `profiles`, which lets the anon "manage profiles" RLS policy be dropped.
      setSession(data.session);
      setUser(data.user ?? null);
      console.log('User created successfully:', data.user.id);

    } catch (error: any) {
      console.error('SignUp error caught:', error);
      throw new Error(error.message);
    } finally {
      console.log('Setting isLoading to false (signUp)');
      setIsLoading(false);
    }
  };


  const signOut = async () => {
    console.log('AuthContext: signOut called');
    setIsLoading(true);
    
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('signOut: Failed to fetch current session', sessionError);
        throw sessionError;
      }

      if (!currentSession) {
        console.warn('signOut: No active session found, clearing local auth state only');
        setUser(null);
        setSession(null);
        console.log('signOut: Local auth state cleared');
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
        throw error;
      }
      console.log('SignOut successful');
    } catch (error: any) {
      console.error('SignOut error caught:', error);
      throw new Error(error.message);
    } finally {
      console.log('Setting isLoading to false (signOut)');
      setIsLoading(false);
    }
  };

  const forceClearAuth = async () => {
    console.log('AuthContext: forceClearAuth called');
    try {
      // Step 1: Clear local auth state immediately
      setUser(null);
      setSession(null);
      setIsLoading(false);

      // Step 2: Clear Supabase client session without waiting for server response
      // This bypasses the hanging promise issue
      supabase.auth.admin.signOut(session?.access_token || '').catch(() => {
        // Ignore errors - we're force clearing anyway
        console.log('Force clear: Ignored server signOut error');
      });

      console.log('AuthContext: forceClearAuth completed');
    } catch (error) {
      console.error('forceClearAuth error:', error);
      // Even if there's an error, we still clear the local state
      setUser(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!user.email_confirmed_at,
    signIn,
    signUp,
    signOut,
    forceClearAuth,
  };

  console.log('AuthProvider render - isAuthenticated:', !!user && !!user.email_confirmed_at, 'isLoading:', isLoading);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}