import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveStoreReferralCode } from '@/lib/referrals';
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
      // The "Invitation Code" field accepts BOTH a user-to-user invitation code AND store referral code
      let inviterId: string | undefined;
      let referredByStoreId: string | null = null;

      if (invitationCode) {
        // Trim whitespace from the invitation code
        const trimmedCode = invitationCode.trim();

        const { data, error: resolveError } = await supabase
          .rpc('resolve_referral_code', { p_code: trimmedCode })
          .maybeSingle();
        const resolved = data as {
          kind: 'user' | 'store';
          user_id: string | null;
          partner_store_id: string | null;
        } | null;

        if (resolveError) {
          console.error('Error validating invitation code:', resolveError);
          throw new Error('Invalid invitation code');
        }

        if (!resolved) {
          // Matched neither invitation_codes nor store_referral_codes.
          throw new Error('Invalid invitation code');
        }

        if (resolved.kind === 'user') {
          inviterId = resolved.user_id ?? undefined;
        } else if (resolved.kind === 'store') {
          referredByStoreId = resolved.partner_store_id ?? null;
        }
      }

      // A deep-link `ref=` parameter (QR scan) also attributes the signup to an outlet.
      // Best-effort: it takes precedence over a manually typed store code, but an unknown
      // code here must NOT block signup (unlike the invitation code field above).
      if (outletRef) {
        const deepLinkStoreId = await resolveStoreReferralCode(outletRef);
        if (deepLinkStoreId) referredByStoreId = deepLinkStoreId;
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

      const userId = data.user.id;

      // 1) Manually create or ensure the profile exists (instead of relying on trigger timing)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            username: displayName,
            full_name: displayName,
            role: 'subscriber',
            dob: dateOfBirth ?? null, // assuming profiles.dob exists as date
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // 2) If invitation code was provided, set inviter_id on the profile
      if (inviterId) {
        console.log('Setting inviter_id on profile:', inviterId, 'for user:', userId);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ inviter_id: inviterId })
          .eq('id', userId);

        if (updateError) {
          console.error('Error setting inviter:', updateError);
          // Decide whether to fail signup or just log. For now, log and continue.
          // throw new Error(`Failed to set inviter: ${updateError.message}`);
        } else {
          console.log('Inviter ID set successfully for user:', userId);
        }
      }

      // 3) Attribute the signup to the outlet whose referral code/QR was used.
      //    Independent of inviter_id — both can be set. Non-fatal on error.
      if (referredByStoreId) {
        const { error: storeAttrError } = await supabase
          .from('profiles')
          .update({ referred_by_store_id: referredByStoreId })
          .eq('id', userId);

        if (storeAttrError) {
          console.error('Error setting referred_by_store_id:', storeAttrError);
        } else {
          console.log('referred_by_store_id set for user:', userId);
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