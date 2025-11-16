import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
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
      console.log('Supabase data response received: ', data);
      if (error) {
        console.log('Supabase error response received: ', error);
        throw error;
      }
      
      // Manual state update for immediate sync
      setSession(data.session);
      setUser (data.user ?? null);
      setIsLoading(false);
      
      console.log('Login successful');
      console.log('Session:', data.session ? data.session : 'missing');
      console.log('User :', data.user ? data.user : 'missing');
    } catch (error: any) {
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      setIsLoading(false); // Make sure to set loading to false on error
      throw new Error(error.message || 'Login failed');
    }
  };

  const signUp = async (email: string, password: string, displayName: string, dateOfBirth: string, gender: string, invitationCode?: string) => {
    console.log('AuthContext: signUp called');
    setIsLoading(true);
    
    try {
      // First, check if invitation code exists (if provided)
      let inviterId: string | undefined;
      if (invitationCode) {
        console.log('Checking invitation code:', invitationCode);
        const { data: inviteData, error: inviteError } = await supabase
          .from('invitation_codes')
          .select('user_id')
          .eq('code', invitationCode)
          .eq('is_active', true)
          .single();

        if (inviteError) {
          console.error('Invalid invitation code:', inviteError);
          throw new Error('Invalid invitation code');
        }
        inviterId = inviteData.user_id;
        console.log('Valid invitation code, inviter ID:', inviterId);
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
            dob: dateOfBirth,
            gender: gender,
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

      // Manual state update for immediate sync (session may be null for email confirm flow)
      setSession(data.session);
      setUser (data.user ?? null);
      console.log('User  created successfully:', data.user.id);

      // If invitation code was provided, update the profile with inviter_id after trigger creates it
      if (inviterId) {
        console.log('Waiting for profile creation trigger...');
        // Wait a moment for the trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Updating profile with inviter ID...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ inviter_id: inviterId })
          .eq('id', data.user.id);

        if (updateError) {
          console.log('Error setting inviter:', updateError);
          // Don't throw error here - profile was created successfully
        } else {
          console.log('Inviter ID set successfully');
        }
      }

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