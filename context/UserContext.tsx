import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import type { UserData, UserPreferenceData, UserContextType } from '@/types';
import { useAuth } from './AuthContext';

type Profile = Database['public']['Tables']['profiles']['Row'];
const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [preferenceData, setPreferenceData] = useState<UserPreferenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreferenceLoading, setIsPreferenceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);

  const fetchUserData = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('User Context: Fetching data for user:', userId);

      // Use authUser  from context directly (no redundant API call)
      const authUserData = authUser ; // authUser  comes from useAuth()

      if (!authUserData) {
        console.log('User Context: No authenticated user found');
        setUserData(null);
        setPreferenceData(null);
        return;
      }

      // Verify userId matches authUser  to prevent mismatches
      if (authUserData.id !== userId) {
        console.warn('User Context: Mismatched userId; using authUser .id');
        // Optionally, return or throw; here we proceed with authUser .id for safety
      }

      // Fetch profile data with basic fields (excluding preferences)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          role,
          avatar_url,
          verification_completed,
          inviter_id,
          affiliate_request_status,
          dob,
          gender,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single();
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      // Combine auth and profile data (without preferences)
      const combinedUserData: UserData = {
        // Auth data
        id: authUserData.id,
        email: authUserData.email || '',
        emailConfirmedAt: authUserData.email_confirmed_at || null,

        // Profile data (with defaults if profile doesn't exist)
        username: profile?.username || null,
        fullName: profile?.full_name || null,
        role: profile?.role || 'subscriber',
        avatarUrl: profile?.avatar_url || null,
        verificationCompleted: profile?.verification_completed || false,
        inviterId: profile?.inviter_id || null,
        affiliateRequestStatus: profile?.affiliate_request_status || null,
        dob: profile?.dob || null,
        gender: profile?.gender || null,
        createdAt: profile?.created_at || authUserData.created_at || null, // Added null fallback for safety
        updatedAt: profile?.updated_at || null,
      };

      console.log('User Context: Combined user data:', combinedUserData);
      setUserData(combinedUserData);

      // Fetch preferences separately
      await fetchPreferenceData(userId);
      
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  const fetchPreferenceData = async (userId?: string) => {
    try {
      setIsPreferenceLoading(true);
      const targetUserId = userId || userData?.id;
      
      if (!targetUserId) {
        setPreferenceData(null);
        return;
      }

      // Fetch only preference-related fields
      const { data: preferences, error: preferencesError } = await supabase
        .from('profiles')
        .select(`
          country_of_residence,
          preferred_communication_channel,
          communication_contact_details,
          travel_destination_category,
          travel_destination_detail,
          travel_preference,
          accommodation_preference,
          travel_budget
        `)
        .eq('id', targetUserId)
        .single();

      if (preferencesError && preferencesError.code !== 'PGRST116') {
        console.error('Preferences fetch error:', preferencesError);
        throw preferencesError;
      }

      const preferenceData: UserPreferenceData = {
        countryOfResidence: preferences?.country_of_residence || null,
        preferredCommunicationChannel: preferences?.preferred_communication_channel || null,
        communicationContactDetails: preferences?.communication_contact_details || null,
        travelDestinationCategory: preferences?.travel_destination_category || null,
        travelDestinationDetail: preferences?.travel_destination_detail || null,
        travelPreference: preferences?.travel_preference || null,
        accommodationPreference: preferences?.accommodation_preference || null,
        travelBudget: preferences?.travel_budget || null,
      };

      console.log('Preference data:', preferenceData);
      setPreferenceData(preferenceData);
      
    } catch (err: any) {
      console.error('Error fetching preference data:', err);
      setError(err.message);
    } finally {
      setIsPreferenceLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (!authUser?.id) {
      console.log('UserContext: Cannot refresh - no authenticated user');
      return;
    }
    console.log('UserContext: Refreshing user data...');
    await fetchUserData(authUser.id);
  };

  const refreshPreferenceData = async () => {
    console.log('Refreshing preference data...');
    await fetchPreferenceData();
  };

  const updatePreferences = async (preferences: Partial<UserPreferenceData>) => {
    try {
      if (!userData?.id) {
        throw new Error('No user ID found');
      }

      // Convert to database column names
      const dbUpdates: any = {};
      
      if (preferences.countryOfResidence !== undefined) {
        dbUpdates.country_of_residence = preferences.countryOfResidence;
      }
      if (preferences.preferredCommunicationChannel !== undefined) {
        dbUpdates.preferred_communication_channel = preferences.preferredCommunicationChannel;
      }
      if (preferences.communicationContactDetails !== undefined) {
        dbUpdates.communication_contact_details = preferences.communicationContactDetails;
      }
      if (preferences.travelDestinationCategory !== undefined) {
        dbUpdates.travel_destination_category = preferences.travelDestinationCategory;
      }
      if (preferences.travelDestinationDetail !== undefined) {
        dbUpdates.travel_destination_detail = preferences.travelDestinationDetail;
      }
      if (preferences.travelPreference !== undefined) {
        dbUpdates.travel_preference = preferences.travelPreference;
      }
      if (preferences.accommodationPreference !== undefined) {
        dbUpdates.accommodation_preference = preferences.accommodationPreference;
      }
      if (preferences.travelBudget !== undefined) {
        dbUpdates.travel_budget = preferences.travelBudget;
      }

      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userData.id)
        .select()
        .single();

      if (error) throw error;

      console.log('Preferences updated:', data);
      // Refresh preference data to get the latest changes
      await refreshPreferenceData();
      
      return data;
    } catch (err: any) {
      console.error('Error updating preferences:', err);
      throw new Error(err.message);
    }
  };

  // Set up real-time subscription for profile changes
  // Set up real-time subscription for profile changes
  const setupRealtimeSubscription = (userId: string) => {
    // Clean up existing subscription
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }
    // Create new subscription for profile changes
    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async (payload: any) => { // Note: Added 'async' for await support
          console.log('Profile updated in real-time:', payload);
          try {
            // Refresh both user data and preferences when profile changes
            await fetchUserData(userId); // Fixed: Pass userId and await
          } catch (err: any) {
            console.error('Realtime refresh failed:', err.message || err);
            // Optionally, setError(err.message) if you want to expose to UI
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
    setRealtimeChannel(channel);
  };

  const resendEmailConfirmation = async () => {
    try {
      if (!userData?.email) {
        throw new Error('No email address found');
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userData.email,
        options: {
          emailRedirectTo: 'https://wegood4u.com/email-confirmed',
        },
      });

      if (error) throw error;
      
      return Promise.resolve();
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  // Update profile data (non-preference fields)
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!userData?.id) {
        throw new Error('No user ID found');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userData.id)
        .select()
        .single();

      if (error) throw error;

      console.log('Profile updated:', data);
      // Refresh user data to get the latest changes
      await refreshUserData();
      
      return data;
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message);
    }
  };

  // Set up real-time subscription for profile changes
  useEffect(() => {
    if (userData?.id) {
      setupRealtimeSubscription(userData.id);
    }

    // Cleanup on unmount or user change
    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [userData?.id]);

  // Main effect: Only fetch user data when auth is ready and user is authenticated
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      console.log('UserContext: Waiting for auth to finish loading...');
      return;
    }

    // If no authenticated user, clear user data
    if (!authUser) {
      console.log('UserContext: No authenticated user, clearing data');
      setUserData(null);
      setPreferenceData(null);
      setIsLoading(false);

      // Clean up realtime subscription
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        setRealtimeChannel(null);
      }
      return;
    }

    // User is authenticated, fetch their data
    console.log('UserContext: User authenticated, fetching data');
    fetchUserData(authUser.id);
  }, [authUser, authLoading]);

  const value: UserContextType = {
    userData,
    preferenceData,
    isLoading,
    isPreferenceLoading,
    error,
    refreshUserData,
    refreshPreferenceData,
    updatePreferences,
    resendEmailConfirmation,
    updateProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}