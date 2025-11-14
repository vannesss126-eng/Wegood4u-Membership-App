import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file');
}

// Constants for storage management
const SECURE_STORE_MAX_SIZE = 2048;
const CHUNK_PREFIX = 'supabase_chunk_';
const CHUNK_COUNT_KEY = 'supabase_chunk_count_';

// Helper function to check if value is too large for SecureStore
const isValueTooLarge = (value: string): boolean => {
  return new Blob([value]).size > SECURE_STORE_MAX_SIZE;
};

// Helper function to split large values into chunks
const splitIntoChunks = (value: string, chunkSize: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }
  return chunks;
};

// Helper function to reconstruct value from chunks
const reconstructFromChunks = async (key: string): Promise<string | null> => {
  try {
    const chunkCountStr = await AsyncStorage.getItem(CHUNK_COUNT_KEY + key);
    if (!chunkCountStr) return null;
    
    const chunkCount = parseInt(chunkCountStr, 10);
    if (isNaN(chunkCount) || chunkCount <= 0) return null;
    
    let reconstructed = '';
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await AsyncStorage.getItem(CHUNK_PREFIX + key + '_' + i);
      if (chunk === null) return null;
      reconstructed += chunk;
    }
    
    return reconstructed;
  } catch (error) {
    console.error('Error reconstructing chunks:', error);
    return null;
  }
};

// Helper function to store value in chunks
const storeInChunks = async (key: string, value: string): Promise<void> => {
  try {
    // Clear any existing chunks first
    await clearChunks(key);
    
    const chunkSize = SECURE_STORE_MAX_SIZE - 100; // Leave some buffer
    const chunks = splitIntoChunks(value, chunkSize);
    
    // Store chunk count
    await AsyncStorage.setItem(CHUNK_COUNT_KEY + key, chunks.length.toString());
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      await AsyncStorage.setItem(CHUNK_PREFIX + key + '_' + i, chunks[i]);
    }
  } catch (error) {
    console.error('Error storing chunks:', error);
    throw error;
  }
};

// Helper function to clear chunks
const clearChunks = async (key: string): Promise<void> => {
  try {
    const chunkCountStr = await AsyncStorage.getItem(CHUNK_COUNT_KEY + key);
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      if (!isNaN(chunkCount)) {
        // Remove all chunks
        for (let i = 0; i < chunkCount; i++) {
          await AsyncStorage.removeItem(CHUNK_PREFIX + key + '_' + i);
        }
      }
      // Remove chunk count
      await AsyncStorage.removeItem(CHUNK_COUNT_KEY + key);
    }
  } catch (error) {
    console.error('Error clearing chunks:', error);
  }
};

// Enhanced storage adapter that handles large values
const EnhancedStorageAdapter = {
  getItem: (key: string) => {
    return new Promise<string | null>(async (resolve) => {
      try {
        // First try SecureStore for small values
        const secureValue = await SecureStore.getItemAsync(key);
        if (secureValue) {
          resolve(secureValue);
          return;
        }
        
        // If not in SecureStore, try reconstructing from chunks
        const chunkedValue = await reconstructFromChunks(key);
        resolve(chunkedValue);
      } catch (error) {
        console.error('Error getting item:', error);
        resolve(null);
      }
    });
  },
  
  setItem: (key: string, value: string) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Check if value is too large for SecureStore
        if (isValueTooLarge(value)) {
          // Store in chunks using AsyncStorage
          await storeInChunks(key, value);
          // Remove from SecureStore if it exists there
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (e) {
            // Ignore error if item doesn't exist
          }
        } else {
          // Store in SecureStore for small values
          await SecureStore.setItemAsync(key, value);
          // Clear any existing chunks
          await clearChunks(key);
        }
        resolve();
      } catch (error) {
        console.error('Error setting item:', error);
        reject(error);
      }
    });
  },
  
  removeItem: (key: string) => {
    return new Promise<void>(async (resolve) => {
      try {
        // Remove from SecureStore
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // Ignore error if item doesn't exist
        }
        
        // Clear any chunks
        await clearChunks(key);
        
        resolve();
      } catch (error) {
        console.error('Error removing item:', error);
        resolve(); // Don't reject on removal errors
      }
    });
  },
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: EnhancedStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (you can generate these later with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          inviter_id: string | null;
          full_name: string | null;
          dob: string | null;
          country_of_residence: string | null;
          gender: string | null;
          preferred_communication_channel: 'WhatsApp' | 'Telegram' | 'Line' | 'WeChat' | null;
          communication_contact_details: string | null;
          travel_destination_category: string | null;
          travel_destination_detail: string | null;
          travel_preference: string | null;
          accommodation_preference: string | null;
          travel_budget: string | null;
          role: 'subscriber' | 'member' | 'affiliate' | 'admin';
          verification_completed: boolean;
          affiliate_request_status: 'pending' | 'approved' | 'rejected' | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          inviter_id?: string | null;
          full_name?: string | null;
          dob?: string | null;
          country_of_residence?: string | null;
          gender?: string | null;
          preferred_communication_channel?: 'WhatsApp' | 'Telegram' | 'Line' | 'WeChat' | null;
          communication_contact_details?: string | null;
          travel_destination_category?: string | null;
          travel_destination_detail?: string | null;
          travel_preference?: string | null;
          accommodation_preference?: string | null;
          travel_budget?: string | null;
          role?: 'subscriber' | 'member' | 'affiliate' | 'admin';
          verification_completed?: boolean;
          affiliate_request_status?: 'pending' | 'approved' | 'rejected' | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          inviter_id?: string | null;
          full_name?: string | null;
          dob?: string | null;
          country_of_residence?: string | null;
          gender?: string | null;
          preferred_communication_channel?: 'WhatsApp' | 'Telegram' | 'Line' | 'WeChat' | null;
          communication_contact_details?: string | null;
          travel_destination_category?: string | null;
          travel_destination_detail?: string | null;
          travel_preference?: string | null;
          accommodation_preference?: string | null;
          travel_budget?: string | null;
          role?: 'subscriber' | 'member' | 'affiliate' | 'admin';
          verification_completed?: boolean;
          affiliate_request_status?: 'pending' | 'approved' | 'rejected' | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      submissions: {
        Row: {
          id: number;
          user_id: string;
          partner_store_name: string;
          partner_store_category: 'cafe' | 'restaurant' | 'others';
          status: 'pending' | 'approved' | 'rejected';
          selfie_url: string;
          receipt_url: string;
          admin_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          partner_store_name: string;
          partner_store_category: 'cafe' | 'restaurant' | 'others';
          status?: 'pending' | 'approved' | 'rejected';
          selfie_url: string;
          receipt_url: string;
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          user_id?: string;
          partner_store_name?: string;
          partner_store_category?: 'cafe' | 'restaurant' | 'others';
          status?: 'pending' | 'approved' | 'rejected';
          selfie_url?: string;
          receipt_url?: string;
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
      };
      badges: {
        Row: {
          id: number;
          name: string;
          category: 'activity' | 'cafe' | 'restaurant';
          required_count: number;
          image_url: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: number;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: number;
          earned_at?: string;
        };
      };
      invitation_codes: {
        Row: {
          user_id: string;
          code: string;
          usage_count: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          code: string;
          usage_count?: number;
          is_active?: boolean;
        };
        Update: {
          code?: string;
          usage_count?: number;
          is_active?: boolean;
        };
      };
    };
    Views: {
      user_stats: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          role: 'subscriber' | 'member' | 'affiliate' | 'admin';
          total_submissions: number;
          approved_submissions: number;
          pending_submissions: number;
          badge_count: number;
          direct_referrals: number;
          created_at: string;
        };
      };
      referral_tree: {
        Row: {
          affiliate_id: string;
          user_id: string;
          username: string | null;
          full_name: string | null;
          level: number;
          created_at: string;
        };
      };
    };
  };
};